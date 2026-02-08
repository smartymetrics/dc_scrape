
import asyncio
import os
from typing import List, Dict
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# Simulation of the logic I just added to main_api.py
async def test_format_push(email: str, product_data: Dict, category_name: str, region: str):
    print(f"--- SIMULATING PRO FORMAT FOR: {email} ---")
    
    title_raw = str(product_data.get("title") or "Deal Alert")
    price = product_data.get("price")
    was_price = product_data.get("was_price") or product_data.get("resell")
    
    # 1. Build Title with Discount Info
    discount_prefix = "🎉 "
    try:
        if price and was_price:
            p_val = float(str(price).replace('$', '').replace(',', '').strip())
            w_val = float(str(was_price).replace('$', '').replace(',', '').strip())
            if w_val > p_val and p_val > 0:
                disc = int(((w_val - p_val) / w_val) * 100)
                if disc >= 10:
                    discount_prefix = f"📉 {disc}% OFF: "
    except Exception as e: 
        print(f"Error calculating discount: {e}")
    
    final_title = f"{discount_prefix}{title_raw[:45]}..." if len(title_raw) > 45 else f"{discount_prefix}{title_raw}"
    
    # 2. Build Body with Store & Prices
    body_parts = []
    if price and str(price) not in ["0.0", "N/A", "0"]:
        body_parts.append(f"Now: ${price}")
    if was_price and str(was_price) not in ["0.0", "N/A", "0"] and was_price != price:
        body_parts.append(f"Was: ${was_price}")
    
    store_label = category_name or "HollowScan"
    region_label = region.replace(" Stores", "")
    body_parts.append(f"{region_label} {store_label}".strip())
    
    final_body = " | ".join(body_parts)
    
    print(f"FINAL TITLE: {final_title}")
    print(f"FINAL BODY:  {final_body}")
    
    # Fetch token for testing (using your corrected one if found)
    URL = os.getenv("SUPABASE_URL")
    KEY = os.getenv("SUPABASE_KEY")
    HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}
    
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{URL}/rest/v1/users?email=eq.{email}&select=push_tokens", headers=HEADERS)
        if r.status_code == 200 and r.json():
            tokens = r.json()[0].get("push_tokens") or []
            if tokens:
                print(f"Found tokens: {tokens}. Sending test...")
                # We'll just print it for now to avoid accidental duplicate spam
                # return (final_title, final_body)
            else:
                print("No tokens found for user.")
        else:
            print(f"User not found or error: {r.status_code}")

    return final_title, final_body

if __name__ == "__main__":
    test_prod = {
        "title": "Charizard Ultra Premium Collection",
        "price": "109.99",
        "was_price": "159.00"
    }
    asyncio.run(test_format_push("smirhty@gmail.com", test_prod, "Pokemon Center", "USA Stores"))
