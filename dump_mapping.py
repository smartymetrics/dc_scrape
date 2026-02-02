import requests
import os
import json

def load_env():
    # Manual .env load
    if os.path.exists(".env"):
        with open(".env") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    parts = line.strip().split("=", 1)
                    if len(parts) == 2:
                        k, v = parts
                        os.environ[k] = v.strip("\"'")

def dump_mapping():
    load_env()
    URL = os.environ.get("SUPABASE_URL")
    KEY = os.environ.get("SUPABASE_KEY")
    if not URL or not KEY:
        print("Missing SUPABASE_URL or SUPABASE_KEY")
        return

    HEADERS = {
        'apikey': KEY,
        'Authorization': f'Bearer {KEY}'
    }

    # 1. Load Channels from local file
    try:
        with open("data/channels_.json", "r") as f:
            local_channels = json.load(f)
    except Exception as e:
        print(f"Error loading local channels: {e}")
        local_channels = []

    # 2. Fetch recent messages to find active channel IDs
    res = requests.get(f"{URL}/rest/v1/discord_messages?select=channel_id&order=scraped_at.desc&limit=500", headers=HEADERS)
    active_ids = {}
    if res.status_code == 200:
        for m in res.json():
            cid = str(m.get('channel_id'))
            active_ids[cid] = active_ids.get(cid, 0) + 1
    else:
        print(f"Error fetching messages: {res.status_code} {res.text}")
    
    # 3. Create report
    local_map = {c['id']: c for c in local_channels}
    
    print("| Channel ID | Name in channels.json | Category | Msg Count (last 500) |")
    print("|------------|----------------------|----------|----------------------|")
    
    # Show active channels
    for cid, count in sorted(active_ids.items(), key=lambda x: x[1], reverse=True):
        info = local_map.get(cid)
        if info:
            print(f"| {cid} | {info['name']} | {info['category']} | {count} |")
        else:
            print(f"| {cid} | **MISSING** | **MISSING** | {count} |")

if __name__ == "__main__":
    dump_mapping()
