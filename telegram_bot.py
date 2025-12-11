import os
import json
import logging
import asyncio
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

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
# CRITICAL FIX: Silence httpx logger to prevent Token leak in logs
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
        
        # Ensure data dir exists
        os.makedirs("data", exist_ok=True)
        self._load_state()

    def _load_state(self):
        try:
            data = supabase_utils.download_file(self.local_users_path, self.remote_users_path, SUPABASE_BUCKET)
            if data:
                self.users = json.loads(data)
                logger.info(f"Loaded {len(self.users)} subscribers.")
        except Exception as e:
            logger.warning(f"Failed to load users: {e}")

        try:
            data = supabase_utils.download_file(self.local_codes_path, self.remote_codes_path, SUPABASE_BUCKET)
            if data:
                self.codes = json.loads(data)
        except Exception as e:
            logger.warning(f"Failed to load codes: {e}")

    def _sync_state(self):
        try:
            with open(self.local_users_path, 'w') as f:
                json.dump(self.users, f)
            supabase_utils.upload_file(self.local_users_path, SUPABASE_BUCKET, self.remote_users_path, debug=False)
            
            with open(self.local_codes_path, 'w') as f:
                json.dump(self.codes, f)
            supabase_utils.upload_file(self.local_codes_path, SUPABASE_BUCKET, self.remote_codes_path, debug=False)
        except Exception as e:
            logger.error(f"Failed to sync state: {e}")

    def generate_code(self, days: int) -> str:
        import secrets
        code = secrets.token_hex(4).upper()
        with self.lock:
            self.codes[code] = days
            self._sync_state()
        return code

    def redeem_code(self, user_id: str, username: str, code: str) -> bool:
        with self.lock:
            if code not in self.codes:
                return False
            
            days = self.codes.pop(code)
            current_expiry = datetime.utcnow()
            
            if str(user_id) in self.users:
                try:
                    old_expiry = datetime.fromisoformat(self.users[str(user_id)]["expiry"])
                    if old_expiry > datetime.utcnow():
                        current_expiry = old_expiry
                except: pass
            
            new_expiry = current_expiry + timedelta(days=days)
            
            self.users[str(user_id)] = {
                "expiry": new_expiry.isoformat(),
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
                    expiry = datetime.fromisoformat(data["expiry"])
                    if expiry > now:
                        active.append(uid)
                except: pass
        return active

    def get_expiry(self, user_id: str) -> Optional[str]:
        if str(user_id) in self.users:
            return self.users[str(user_id)]["expiry"]
        return None

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
            if data:
                data_json = json.loads(data)
                self.last_scraped_at = data_json.get("last_scraped_at")
                logger.info(f"Loaded cursor: {self.last_scraped_at}")
            
            if not self.last_scraped_at:
                # Default to 24 hours ago if no cursor exists
                self.last_scraped_at = (datetime.utcnow() - timedelta(hours=24)).isoformat()
                
        except Exception as e:
            logger.error(f"Failed to init cursor: {e}")
            self.last_scraped_at = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    def _save_cursor(self):
        try:
            with open(self.local_cursor_path, 'w') as f:
                json.dump({"last_scraped_at": self.last_scraped_at}, f)
            supabase_utils.upload_file(self.local_cursor_path, SUPABASE_BUCKET, self.remote_cursor_path, debug=False)
        except Exception as e:
            logger.error(f"Failed to save cursor: {e}")

    def poll_new_messages(self):
        try:
            # Ensure valid timestamp
            if not self.last_scraped_at:
                self.last_scraped_at = (datetime.utcnow() - timedelta(minutes=5)).isoformat()

            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}"
            }
            
            # Using Supabase REST API
            url = f"{self.supabase_url}/rest/v1/discord_messages"
            params = {
                "scraped_at": f"gt.{self.last_scraped_at}",
                "order": "scraped_at.asc"
            }
            
            res = requests.get(url, headers=headers, params=params, timeout=10)
            
            if res.status_code != 200:
                logger.error(f"Supabase returned status {res.status_code}: {res.text}")
                return []

            messages = res.json()
            
            # Handle case where result isn't a list (shouldn't happen on select, but safe to check)
            if not isinstance(messages, list):
                logger.error(f"Unexpected response format: {messages}")
                return []

            if messages:
                # Update cursor to the very last message's time
                new_last = messages[-1].get('scraped_at')
                if new_last:
                    self.last_scraped_at = new_last
                    self._save_cursor()
                
            return messages
        except Exception as e:
            logger.error(f"Polling error: {e}")
            # Print traceback to debug that '-1' error or similar obscure issues
            traceback.print_exc()
            return []

# --- Bot Logic ---
sm = SubscriptionManager()
poller = MessagePoller()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("👋 Discord Alert Bot Active.\n/redeem <CODE> to subscribe.")

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = str(update.effective_user.id)
    expiry = sm.get_expiry(uid)
    if expiry:
        await update.message.reply_text(f"✅ Active until: {expiry}")
    else:
        await update.message.reply_text("❌ Not subscribed.")

async def redeem(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /redeem <CODE>")
        return
    
    code = args[0].strip().upper()
    uid = str(update.effective_user.id)
    username = update.effective_user.username
    
    if sm.redeem_code(uid, username, code):
        expiry = sm.users[uid]["expiry"]
        await update.message.reply_text(f"🎉 Subscribed until {expiry}")
    else:
        await update.message.reply_text("❌ Invalid code.")

async def gen_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = str(update.effective_user.id)
    # Check if string ID matches
    if uid != str(ADMIN_USER_ID): 
        return

    args = context.args
    try:
        days = int(args[0])
        code = sm.generate_code(days)
        await update.message.reply_text(f"🔑 Code: `{code}` ({days} days)")
    except:
        await update.message.reply_text("Usage: /gen <days>")

# Background job (Async)
async def broadcast_job(context: ContextTypes.DEFAULT_TYPE):
    try:
        new_msgs = poller.poll_new_messages()
        if not new_msgs:
            return

        active_users = sm.get_active_users()
        if not active_users:
            return

        for msg in new_msgs:
            raw_data = msg.get("raw_data", {}) or {}
            content = msg.get("content", "")
            author = raw_data.get("author", "Unknown")
            channel = raw_data.get("channel_url", "").split('/')[-1] # simple ID
            
            # Construct text
            text = f"📢 <b>{author}</b> in #{channel}\n\n{content}"
            if len(text) > 4000: text = text[:4000] + "..."

            media_list = raw_data.get("media", {})
            images = media_list.get("images", [])

            for uid in active_users:
                try:
                    await context.bot.send_message(
                        chat_id=uid, 
                        text=text, 
                        parse_mode=ParseMode.HTML,
                        disable_web_page_preview=True,
                        connect_timeout=5,
                        read_timeout=10
                    )
                    # Send first image if available
                    if images and "url" in images[0]:
                        try:
                            await context.bot.send_photo(
                                chat_id=uid,
                                photo=images[0]["url"],
                                connect_timeout=5,
                                read_timeout=10
                            )
                        except Exception as e:
                            logger.warning(f"Failed to send photo to {uid}: {e}")
                except Exception as e:
                    logger.error(f"Failed send to {uid}: {e}")

    except Exception as e:
        logger.error(f"Broadcast Job Error: {e}")
        traceback.print_exc()

def run_bot():
    """Entry point used by app.py thread"""
    if not TELEGRAM_TOKEN:
        logger.error("No TELEGRAM_TOKEN. Bot disabled.")
        return

    app = Application.builder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(CommandHandler("redeem", redeem))
    app.add_handler(CommandHandler("gen", gen_code))

    # Add job queue
    if app.job_queue:
        app.job_queue.run_repeating(broadcast_job, interval=POLL_INTERVAL, first=10)
    
    logger.info("🤖 Bot started (Polling mode)")
    try:
        app.run_polling(allowed_updates=Update.ALL_TYPES)
    except Exception as e:
        logger.error(f"Bot error: {e}")
    finally:
        logger.info("🤖 Bot shutdown gracefully")

if __name__ == "__main__":
    run_bot()