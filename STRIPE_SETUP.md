# Definitive Stripe Activation Guide (Contabo VPS)

Follow these steps exactly to activate automated payments for the bot.

## Step 1: Create Your Subscription Plans
You need two recurring products in your Stripe Dashboard.
1. Go to **Stripe Dashboard -> Product Catalog -> Add Product**.
2. **Monthly Plan**:
   - Name: `Hollowscan Monthly`
   - Pricing: `Recurring`
   - Interval: `Monthly`
   - Save the product and copy the **Price ID** (starts with `price_...`).
3. **Yearly Plan**:
   - Name: `Hollowscan Yearly`
   - Pricing: `Recurring`
   - Interval: `Yearly`
   - Save the product and copy the **Price ID**.

## Step 2: Get Your Secret API Key
1. Go to **Stripe Dashboard -> Developers -> API Keys**.
2. Copy your **Secret Key** (starts with `sk_live_...` or `sk_test_...`). 
   > [!IMPORTANT]
   > Use Test Keys first to verify everything works before switching to Live.

## Step 3: Set Up the Webhook
This tells Stripe to notify the bot when a payment is successful.
1. Go to **Stripe Dashboard -> Developers -> Webhooks**.
2. Click **Add Endpoint**.
3. **Endpoint URL**: `http://YOUR_VPS_IP:5000/webhook/stripe` (Replace `YOUR_VPS_IP` with your actual Contabo IP).
4. **Select Events**: You MUST select these three:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
5. Click **Add Endpoint**.
6. Find the **Signing Secret** on this new webhook page (starts with `whsec_...`) and copy it.

## Step 4: Configure the VPS Environment
Update the `.env` file on the VPS with the following:

```env
# Stripe Settings
STRIPE_SECRET_KEY=sk_test_... # From Step 2
STRIPE_WEBHOOK_SECRET=whsec_... # From Step 3
STRIPE_PRICE_ID_MONTHLY=price_... # From Step 1
STRIPE_PRICE_ID_YEARLY=price_... # From Step 1

# VPS Settings
DOMAIN=http://YOUR_VPS_IP:5000 # Replace with your IP
```

## Step 5: Start the Bot
Run these commands on the VPS:
```bash
git pull origin main
pip install stripe
python app.py
```

## Step 6: Verification
1. Open the bot on Telegram.
2. Click **💎 Subscribe (Automated Billing)** or run `/subscribe`.
3. Choose a plan.
4. Click the link generated. If it opens the Stripe Checkout page, **Success!**
