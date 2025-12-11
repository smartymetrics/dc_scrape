import os
import json
import logging
import threading
import traceback
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes
import supabase_utils
from dotenv import load_dotenv

load_dotenv()

# --- Configurations ---
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
ADMIN_USER_ID = os.getenv("TELEGRAM_ADMIN_ID")
SUPABASE_BUCKET = "monitor-data"
USERS_FILE = "bot_users.json"
CODES_FILE = "active_codes.json"
POLL_INTERVAL = 30

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# --- Subscription Manager ---
class SubscriptionManager:
    def __init__(self):
        self.users: Dict[str, Dict] = {} 
        self.codes: Dict[str, int] = {}
        self.lock = threading.Lock()
        self.remote_users_path = f"discord_josh/{USERS_FILE}"
        self.remote_codes_path = f"discord_josh/{CODES_FILE}"
        self.local_users_path = f"data/{USERS_FILE}"
        self.local_codes_path = f"data/{CODES_FILE}"
        os.makedirs("data", exist_ok=True)
        self._load_state()

    def _load_state(self):
        try:
            data = supabase_utils.download_file(self.local_users_path, self.remote_users_path, SUPABASE_BUCKET)
            if data: self.users = json.loads(data)
            
            data = supabase_utils.download_file(self.local_codes_path, self.remote_codes_path, SUPABASE_BUCKET)
            if data: self.codes = json.loads(data)
        except Exception as e: logger.warning(f"Failed to load state: {e}")

    def _sync_state(self):
        try:
            with open(self.local_users_path, 'w') as f: json.dump(self.users, f)
            supabase_utils.upload_file(self.local_users_path, SUPABASE_BUCKET, self.remote_users_path, debug=False)
            
            with open(self.local_codes_path, 'w') as f: json.dump(self.codes, f)
            supabase_utils.upload_file(self.local_codes_path, SUPABASE_BUCKET, self.remote_codes_path, debug=False)
        except Exception: pass

    def generate_code(self, days: int) -> str:
        import secrets
        code = secrets.token_hex(4).upper()
        with self.lock:
            self.codes[code] = days
            self._sync_state()
        return code

    def redeem_code(self, user_id: str, username: str, code: str) -> bool:
        with self.lock:
            if code not in self.codes: return False
            days = self.codes.pop(code)
            current = datetime.utcnow()
            if str(user_id) in self.users:
                try:
                    old_exp = datetime.fromisoformat(self.users[str(user_id)]["expiry"])
                    if old_exp > current: current = old_exp
                except: pass
            
            self.users[str(user_id)] = {
                "expiry": (current + timedelta(days=days)).isoformat(),
                "username": username or "Unknown"
            }
            self._sync_state()
            return True

    def get_active_users(self) -> List[str]:
        active = []
        now = datetime.utcnow()
        with self.lock:
            for uid, data in self.users.items():
                try:
                    if datetime.fromisoformat(data["expiry"]) > now: active.append(uid)
                except: pass
        return active

# --- Message Poller ---
class MessagePoller:
    def __init__(self):
        self.last_scraped_at = None
        self.supabase_url, self.supabase_key = supabase_utils.get_supabase_config()
        self.cursor_file = "bot_cursor.json"
        self.local_cursor_path = f"data/{self.cursor_file}"
        self.remote_cursor_path = f"discord_josh/{self.cursor_file}"
        self._init_cursor()

    def _init_cursor(self):
        try:
            data = supabase_utils.download_file(self.local_cursor_path, self.remote_cursor_path, SUPABASE_BUCKET)
            if data: self.last_scraped_at = json.loads(data).get("last_scraped_at")
            if not self.last_scraped_at: self.last_scraped_at = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        except: self.last_scraped_at = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    def _save_cursor(self):
        try:
            with open(self.local_cursor_path, 'w') as f: json.dump({"last_scraped_at": self.last_scraped_at}, f)
            supabase_utils.upload_file(self.local_cursor_path, SUPABASE_BUCKET, self.remote_cursor_path, debug=False)
        except: pass

    def poll_new_messages(self):
        try:
            if not self.last_scraped_at: self.last_scraped_at = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
            headers = {"apikey": self.supabase_key, "Authorization": f"Bearer {self.supabase_key}"}
            url = f"{self.supabase_url}/rest/v1/discord_messages"
            params = {"scraped_at": f"gt.{self.last_scraped_at}", "order": "scraped_at.asc"}
            
            res = requests.get(url, headers=headers, params=params, timeout=10)
            if res.status_code != 200: return []
            
            messages = res.json()
            if isinstance(messages, list) and messages:
                self.last_scraped_at = messages[-1]['scraped_at']
                self._save_cursor()
            return messages if isinstance(messages, list) else []
        except: return []

sm = SubscriptionManager()
poller = MessagePoller()

# --- Bot Handlers ---
async def start(update: Update, context): await update.message.reply_text("👋 Bot Active.\n/redeem <CODE>")
async def status(update: Update, context):
    uid = str(update.effective_user.id)
    if uid in sm.users: await update.message.reply_text(f"✅ Active until: {sm.users[uid]['expiry']}")
    else: await update.message.reply_text("❌ Not subscribed.")

async def redeem(update: Update, context):
    if not context.args: return await update.message.reply_text("Usage: /redeem <CODE>")
    if sm.redeem_code(str(update.effective_user.id), update.effective_user.username, context.args[0].strip().upper()):
        await update.message.reply_text("🎉 Code redeemed!")
    else: await update.message.reply_text("❌ Invalid code.")

async def gen_code(update: Update, context):
    if str(update.effective_user.id) != str(ADMIN_USER_ID): return
    try:
        code = sm.generate_code(int(context.args[0]))
        await update.message.reply_text(f"🔑 `{code}`", parse_mode=ParseMode.MARKDOWN)
    except: await update.message.reply_text("Usage: /gen <days>")

async def broadcast_job(context):
    msgs = poller.poll_new_messages()
    users = sm.get_active_users()
    if not msgs or not users: return

    for msg in msgs:
        rd = msg.get("raw_data", {})
        text = f"📢 <b>{rd.get('author','?')}</b> in #{str(rd.get('channel_url','')).split('/')[-1]}\n\n{msg.get('content','')}"[:4000]
        img = rd.get("media", {}).get("images", [{}])[0].get("url")
        
        for uid in users:
            try:
                await context.bot.send_message(uid, text, parse_mode=ParseMode.HTML, disable_web_page_preview=True)
                if img: await context.bot.send_photo(uid, img)
            except: pass

def run_bot():
    if not TELEGRAM_TOKEN: return
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(CommandHandler("redeem", redeem))
    app.add_handler(CommandHandler("gen", gen_code))
    if app.job_queue: app.job_queue.run_repeating(broadcast_job, interval=POLL_INTERVAL, first=10)
    logger.info("🤖 Bot started.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    run_bot()