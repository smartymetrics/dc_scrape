import requests
from bs4 import BeautifulSoup
import logging
import re

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Copying the function from telegram_bot.py to ensure identical logic
def fetch_product_images(url, max_images=3):
    """
    Attempts to scrape high-res product images from a URL.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.google.com/'
    }
    
    images = []
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code != 200:
            logger.warning(f"Failed to load page: {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Priority 0: Meta Tags (The most reliable verification)
        skip_keywords = ['logo', 'icon', 'banner', 'button', 'sprite', 'loading']
        
        for meta in soup.find_all('meta'):
            prop = meta.get('property', '')
            name = meta.get('name', '')
            if prop in ['og:image', 'twitter:image'] or name in ['og:image', 'twitter:image']:
                 meta_url = meta.get('content')
                 if meta_url and meta_url.startswith('http') and not any(k in meta_url.lower() for k in skip_keywords):
                     images.append({
                        'url': meta_url,
                        'alt': 'Meta Tag Image',
                        'priority': 1000 # Super high priority
                     })
                     
        # Priority 1: Look for product images in data attributes and meta tags
        for img in soup.find_all('img'):
            img_url = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if not img_url: continue
            
            # Handle relative URLs
            if img_url.startswith('//'):
                img_url = 'https:' + img_url
            elif img_url.startswith('/'):
                from urllib.parse import urljoin
                img_url = urljoin(url, img_url)
                
            if not img_url.startswith('http'):
                continue
                
            if img_url.startswith('data:'):
                continue
            
            # 2a. HARD FILTER: Verify it looks like a product image
            # Discard tiny images which are likely icons
            if 'width' in img.attrs and 'height' in img.attrs:
                try:
                    w = int(str(img['width']).replace('px',''))
                    h = int(str(img['height']).replace('px',''))
                    if w < 100 or h < 100: continue # Too small to be a product
                except: pass
            
            # Skip if URL contains skip keywords
            img_url_lower = img_url.lower()
            if any(skip in img_url_lower for skip in skip_keywords):
                continue
            
            # Priority Scoring
            score = 0
            alt_text = img.get('alt', '').lower()
            
            if 'product' in img_url_lower or 'product' in alt_text: score += 50
            if 'main' in img_url_lower: score += 20
            if 'gallery' in img_url_lower: score += 10
            
            # Shopify specific
            if 'cdn.shopify.com' in img_url_lower:
                score += 30
                # Try to get high res
                # Shopify usually has _small.jpg, _medium.jpg etc. 
                # We want just .jpg or _1024x1024.jpg
                # But typically scraping the src gives what's there.
                
            if score > 0:
                images.append({'url': img_url, 'priority': score})

        # Sort by priority
        images.sort(key=lambda x: x['priority'], reverse=True)
        
        # Deduplicate
        seen = set()
        final_images = []
        for img in images:
            if img['url'] not in seen:
                seen.add(img['url'])
                final_images.append(img['url'])
                
        return final_images[:max_images]

    except Exception as e:
        logger.error(f"Scrape error: {e}")
        return []

test_urls = [
    "https://g3toys.co.uk/products/pokemon-tcg-tapu-koko-ex-jtg-051",
    "https://stellarcards.co.uk/products/pokmon-tcg-scarlet-violet-9-journey-together-booster-box",
    "https://www.hillscards.co.uk/trading-card-games-c78/sealed-products-c92/boosters-c98/pokemon-trading-card-game-scarlet-violet-black-bolt-1-sealed-booster-pack-p88480",
    "https://shop.jacstores.co.uk/products/pokemon-red-analogue-watch",
    "https://castlecomicsuk.co.uk/products/pokemon-scarlet-violet-7-stellar-crown-elite-trainer-box",
    "https://cosmiccollectables.co.uk/products/sword-and-shield-shining-fates-sv059-sv122-indeedee-shiny-vault-holo",
    "https://www.chiefcards.co.uk/products/pokemon-journey-together-booster-box",
    "https://www.overkillshop.com/products/stance-pokemon-box-set-socks-a556d25pok-mul-multi",
    "https://www.chaoscards.co.uk/prod/collection-boxes-pokemon/pokemon-charizard-ex-super-premium-collection",
    "https://eternacards.co.uk/products/pokemon-charizard-ex-super-premium-collection-cosmetic-damage",
    "https://remixcasuals.co.uk/products/sushi-bolts-allen-head-pk-8-black-1-in",
    "https://www.board-game.co.uk/product/one-piece-card-game-premium-booster-box-prb-01/",
    "https://minisoshop.co.uk/one-piece-trading-card-game-op-13-carrying-on-his-will-booster-pack"
]

print("Starting Diagnosis...")
for url in test_urls:
    print(f"\nScanning: {url}")
    results = fetch_product_images(url)
    print(f"Found {len(results)} images")
    for i, img in enumerate(results):
        print(f"  {i+1}: {img}")
