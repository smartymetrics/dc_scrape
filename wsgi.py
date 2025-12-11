"""
WSGI entry point for production (Gunicorn)
Starts both Flask/SocketIO and Telegram bot in isolated threads
"""
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv()

# Import after .env is loaded
from app import app, socketio, telegram_bot, run_archiver_logic_async, stop_event

# Thread pool for running blocking Playwright code outside the event loop
executor = ThreadPoolExecutor(max_workers=1)

# Start Telegram Bot in background thread
if os.getenv("TELEGRAM_TOKEN"):
    t_bot = threading.Thread(target=telegram_bot.run_bot, daemon=True)
    t_bot.start()

# Start archiver in isolated thread (outside event loop)
def start_archiver():
    executor.submit(run_archiver_logic_async)

# Start archiver immediately on startup
start_archiver()

# Export app for Gunicorn
if __name__ != '__main__':
    # Running under Gunicorn
    application = app
