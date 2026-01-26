import sys
import importlib

required_modules = [
    'flask', 'flask_socketio', 'playwright', 'requests', 'supabase', 
    'dotenv', 'eventlet', 'telegram', 'nest_asyncio', 'bs4', 'PIL', 'stripe'
]

missing = []
for mod in required_modules:
    try:
        importlib.import_module(mod)
        print(f"✅ {mod} found")
    except ImportError:
        print(f"❌ {mod} MISSING")
        missing.append(mod)

if missing:
    print("\n⚠️ Missing packages detected. Please run:")
    print("pip install -r requirements.txt")
    sys.exit(1)
else:
    print("\n✅ All dependencies appear to be installed.")
    sys.exit(0)
