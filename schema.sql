-- ============================================
-- SQL Schema for SmartyMetrics App
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    apple_id VARCHAR(255) UNIQUE,
    
    -- Subscription
    subscription_status VARCHAR(20) DEFAULT 'free', -- 'free', 'active', 'expired', 'cancelled'
    subscription_source VARCHAR(20), -- 'apple', 'stripe', 'manual'
    subscription_end TIMESTAMPTZ,
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    apple_receipt_data TEXT,
    
    -- Settings
    notification_preferences JSONB DEFAULT '{}', -- Example: {"US": ["flips", "fba"], "UK": ["retail_arbitrage"]}
    alert_retention_days INTEGER DEFAULT 30,
    daily_free_alerts_viewed INTEGER DEFAULT 0,
    last_free_alert_reset TIMESTAMPTZ DEFAULT NOW(),
    
    -- Multi-Telegram feature
    max_telegram_links INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ
);

-- 2. USER_TELEGRAM_LINKS TABLE (1:N linking)
CREATE TABLE IF NOT EXISTS user_telegram_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    telegram_id VARCHAR(50) UNIQUE NOT NULL,
    telegram_username VARCHAR(100),
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SAVED_DEALS TABLE (Bookmarks)
CREATE TABLE IF NOT EXISTS saved_deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_id VARCHAR(255) NOT NULL,
    alert_data JSONB, -- Store full alert info for offline access
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, alert_id)
);

-- 4. TELEGRAM_LINK_TOKENS TABLE (Temporary)
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    token TEXT PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.1 EMAIL_VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS email_verifications (
    email TEXT PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATEGORIES TABLE (Dynamic)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code VARCHAR(10) NOT NULL, -- 'US', 'UK', 'EU', etc.
    category_name VARCHAR(100) NOT NULL, -- 'flips', 'fba', 'retail_arbitrage'
    display_name VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, category_name)
);

-- 6. ALERTS TABLE (For Product Posts)
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code VARCHAR(10) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    product_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AUTO-DISCOVERY TRIGGER
-- This function automatically adds new countries/categories to the 'categories' table
-- whenever a new product alert is posted by an admin.
CREATE OR REPLACE FUNCTION auto_discover_category()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categories (country_code, category_name, display_name)
    VALUES (
        NEW.country_code, 
        NEW.category_name, 
        UPPER(NEW.country_code) || ' ' || INITCAP(REPLACE(NEW.category_name, '_', ' '))
    )
    ON CONFLICT (country_code, category_name) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_discover_category
AFTER INSERT ON alerts
FOR EACH ROW
EXECUTE FUNCTION auto_discover_category();

-- 8. INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status, subscription_end);
CREATE INDEX IF NOT EXISTS idx_telegram_links_user ON user_telegram_links(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_telegram ON user_telegram_links(telegram_id);
CREATE INDEX IF NOT EXISTS idx_saved_deals_user ON saved_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_country ON categories(country_code);

-- 7. INITIAL DATA (Optional)
INSERT INTO categories (country_code, category_name, display_name) VALUES
('US', 'flips', 'US Flips'),
('US', 'fba', 'US FBA Deals'),
('UK', 'flips', 'UK Flips'),
('UK', 'fba', 'UK FBA Deals')
ON CONFLICT DO NOTHING;
