import requests
import os
import json
import re

# Manual .env load
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ[k] = v.strip("\"'")

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")
HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json'
}

def analyze():
    print("--- Loading local channels_.json ---")
    try:
        with open("data/channels_.json", "r") as f:
            channels = json.load(f)
    except Exception as e:
        print(f"Error loading channels_.json: {e}")
        return

    channel_map = {c['id']: c for c in channels}
    print(f"Loaded {len(channel_map)} channels from local file.")

    print("\n--- Fetching latest 100 messages from Supabase ---")
    res = requests.get(
        f"{URL}/rest/v1/discord_messages?select=channel_id,content,id&order=scraped_at.desc&limit=100",
        headers=HEADERS
    )
    if res.status_code != 200:
        print(f"Error fetching messages: {res.status_code} {res.text}")
        return
    
    messages = res.json()
    print(f"Fetched {len(messages)} messages.")

    stats = {}
    unknown_ids = set()

    for msg in messages:
        ch_id = str(msg.get("channel_id", ""))
        content = msg.get("content", "")
        
        info = channel_map.get(ch_id)
        if info:
            cat = info.get("category", "Unknown")
            name = info.get("name", "Unknown")
            key = f"{cat} | {name}"
            stats[key] = stats.get(key, 0) + 1
            
            # Check for region mismatch in content (heuristic)
            if "Stores" in cat:
                region = cat.split(" ")[0].upper()
                if region == "USA" and ("£" in content or "Canada" in content or "CA" in content):
                    # Potential mismatch if it's strictly US but has UK symbol or CA text
                    # Note: Amazon US can have CA resellers, but usually currency matches.
                    pass
        else:
            unknown_ids.add(ch_id)

    print("\n--- Channel Stats in last 100 messages ---")
    for key, count in sorted(stats.items()):
        print(f"{key}: {count} messages")

    if unknown_ids:
        print("\n--- Unknown Channel IDs in messages (not in channels_.json) ---")
        for uid in unknown_ids:
            # Count occurrences
            count = sum(1 for m in messages if str(m.get("channel_id")) == uid)
            print(f"ID: {uid} ({count} messages)")

if __name__ == "__main__":
    analyze()
