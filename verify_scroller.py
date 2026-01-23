
import asyncio
from playwright.async_api import async_playwright
import os

async def verify_selector():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Testing on the most complex sidebar dump found
        filepath = r"C:\Users\HP USER\Documents\Data Analyst\discord\data\dom_inspection\channel_sidebar_1436352566987591762_channels_20260123_093448.html"
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        await page.set_content(content)
        
        print("--- Testing Selectors ---")
        
        # 1. New refined selector
        selector = 'nav[aria-label*="channel"]:not([aria-label*="server"]) [class*="scrollerBase"], [class*="sidebar"] nav [class*="scrollerBase"], [class*="channelsList"] [class*="scrollerBase"]'
        
        scrollers = page.locator(selector)
        count = await scrollers.count()
        print(f"Found {count} scrollers with refined selector.")
        
        if count > 0:
            for i in range(count):
                scroller = scrollers.nth(i)
                parent_nav = scroller.locator('xpath=./ancestor::nav').first
                label = await parent_nav.get_attribute("aria-label") or "Unknown"
                print(f"Scroller {i} Label: {label}")
                
        # 2. Server list selector (to compare)
        server_selector = 'nav[aria-label*="Servers"] [class*="scrollerBase"]'
        server_scrollers = page.locator(server_selector)
        print(f"Found {await server_scrollers.count()} server scrollers.")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_selector())
