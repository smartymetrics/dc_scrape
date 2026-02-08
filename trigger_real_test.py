
import asyncio
import os
import httpx
from dotenv import load_dotenv
from typing import List, Dict

load_dotenv()

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")
HEADERS = {
    'apikey': KEY, 
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json'
}

async def send_test_push(email: str):
    print(f"🚀 Starting Real Push Test for: {email}")
    
    async with httpx.AsyncClient() as client:
        # 1. Get User Tokens
        print(f"🔍 Looking up tokens for {email}...")
        response = await client.get(
            f"{URL}/rest/v1/users?email=eq.{email}&select=id,push_tokens",
            headers=HEADERS
        )
        
        if response.status_code != 200 or not response.json():
            print(f"❌ Error: User not found or Supabase error ({response.status_code})")
            return
        
        user_data = response.json()[0]
        tokens = user_data.get("push_tokens") or []
        user_id = user_data.get("id")
        
        if not tokens:
            print(f"⚠️ No push tokens found for {email}. Please log in on the app first!")
            return
        
        print(f"✅ Found {len(tokens)} token(s): {tokens}")
        
        # 2. Build the "Pro" Notification
        title = "📉 25% OFF: Test Deal Alert! 🎉"
        body = "Now: $29.99 | Was: $39.99 | HollowScan HQ"
        data = {"product_id": "test_id_123"}
        
        print("📤 Sending to Expo...")
        
        for token in tokens:
            message = {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data,
                "badge": 1,
                "priority": "high",
                "channelId": "default"
            }
            
            expo_res = await client.post(
                "https://exp.host/--/api/v2/push/send",
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json=message
            )
            
            if expo_res.status_code == 200:
                print(f"✨ Push sent successfully to {token[:20]}...")
                print(f"Ticket: {expo_res.json()}")
            else:
                print(f"❌ Expo Error: {expo_res.text}")

if __name__ == "__main__":
    import sys
    target_email = sys.argv[1] if len(sys.argv) > 1 else "smirhty@gmail.com"
    asyncio.run(send_test_push(target_email))
