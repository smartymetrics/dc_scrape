import os
import threading
import eventlet
eventlet.monkey_patch(all=False, socket=True, select=True, time=True)

from dotenv import load_dotenv
load_dotenv()

from concurrent.futures import ThreadPoolExecutor
# Import app and the new wrapper function
from app import app, telegram_bot, run_archiver_entrypoint

executor = ThreadPoolExecutor(max_workers=1)

# Start Bot
if os.getenv("TELEGRAM_TOKEN"):
    t_bot = threading.Thread(target=telegram_bot.run_bot, daemon=True)
    t_bot.start()

# Start Scraper
# Note: run_archiver_entrypoint inside app.py handles the asyncio.run() internally
def start_archiver():
    executor.submit(run_archiver_entrypoint)

start_archiver()

if __name__ != '__main__':
    application = app