
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")
HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json'
}

async def search_token():
    # The token from the user's guide
    token = "ExponentPushToken[i2JGQJNaJJpGLjuc_rWNAX]"
    async with httpx.AsyncClient() as client:
        # Search for any user that contains this token in their push_tokens array
        # We'll use the cs (contains) operator if it's an array, or just fetch all and filter
        response = await client.get(
            f"{URL}/rest/v1/users?push_tokens=cs.{{\"{token}\"}}&select=id,email,push_tokens",
            headers=HEADERS
        )
        if response.status_code == 200:
            users = response.json()
            if users:
                print(f"Found {len(users)} users with this token:")
                for u in users:
                    print(f"ID: {u.get('id')} | Email: {u.get('email')}")
            else:
                print("No users found with this exact token.")
        else:
            # Fallback: search by email to see what token THEY have
            print(f"Error searching by token: {response.status_code}. Searching by email instead...")
            response = await client.get(
                f"{URL}/rest/v1/users?email=eq.smirhty@gmail.com&select=id,email,push_tokens",
                headers=HEADERS
            )
            if response.status_code == 200:
                users = response.json()
                if users:
                    print(f"User smirhty@gmail.com found. Tokens: {users[0].get('push_tokens')}")
                else:
                    print("User smirhty@gmail.com not found.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(search_token())
