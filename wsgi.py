"""
WSGI entry point for production (Gunicorn)
Starts both Flask/SocketIO and Telegram bot in isolated threads
"""
import os
import threading
from dotenv import load_dotenv

load_dotenv()

# Import telegram_bot directly from the file
import telegram_bot
from app import app, stop_event

# Start Telegram Bot in background thread (isolated)
if os.getenv("TELEGRAM_TOKEN"):
    def run_telegram_safe():
        """Run telegram bot in isolated thread"""
        try:
            telegram_bot.run_bot()
        except Exception as e:
            print(f"Telegram bot error: {e}")
    
    t_bot = threading.Thread(target=run_telegram_safe, daemon=True)
    t_bot.start()

# Start archiver init in background
# (Optional: Only if you want it to autostart, otherwise let the user click start)
def start_archiver_init():
    import time
    time.sleep(2)
    print("[WSGI] Ready. Visit web interface to start archiver.")

init_thread = threading.Thread(target=start_archiver_init, daemon=True)
init_thread.start()

# Export application for Gunicorn
if __name__ != '__main__':
    application = app
else:
    # For direct execution (testing)
    app.run(host='0.0.0.0', port=5000)