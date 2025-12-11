"""
WSGI entry point for production (Gunicorn)
"""
import os
import threading
from dotenv import load_dotenv

load_dotenv()

# Import telegram_bot directly from the file
import telegram_bot
from app import app

# Start Telegram Bot in background thread
if os.getenv("TELEGRAM_TOKEN"):
    def run_telegram_safe():
        try:
            telegram_bot.run_bot()
        except Exception as e:
            print(f"Telegram bot error: {e}")
    
    t_bot = threading.Thread(target=run_telegram_safe, daemon=True)
    t_bot.start()

# Export application for Gunicorn
if __name__ != '__main__':
    application = app
else:
    app.run(host='0.0.0.0', port=5000)