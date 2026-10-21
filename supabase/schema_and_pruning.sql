-- ==============================================================================
-- OMNIDROP V2: Enterprise Multi-Store Price Tracker Database Schema & Pruning
-- Optimized for Supabase Free-Tier Protection, RLS Isolation, and Zero-Cost Ops
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tracked Products Table (Multi-tenant with active state & quota tracking)
CREATE TABLE IF NOT EXISTS public.tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    target_price NUMERIC(12, 2) NOT NULL CHECK (target_price > 0),
    current_price NUMERIC(12, 2) DEFAULT NULL,
    lowest_platform TEXT DEFAULT NULL,
    lowest_url TEXT DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_price_change_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure backwards-compatible columns exist if upgrading from V1
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tracked_products' AND column_name = 'is_active') THEN
        ALTER TABLE public.tracked_products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tracked_products' AND column_name = 'last_price_change_at') THEN
        ALTER TABLE public.tracked_products ADD COLUMN last_price_change_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 3. Product Store Links Table (Supports multi-store comparison per product)
CREATE TABLE IF NOT EXISTS public.product_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('croma', 'amazon', 'flipkart', 'other')),
    url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    last_price NUMERIC(12, 2) DEFAULT NULL,
    last_checked_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Price Alert Logs Table (Audit trail, 24h deduplication, and 15-day auto-pruning)
CREATE TABLE IF NOT EXISTS public.price_alert_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    notified_price NUMERIC(12, 2) NOT NULL,
    threshold_price NUMERIC(12, 2) DEFAULT NULL,
    platform TEXT DEFAULT NULL,
    product_url TEXT DEFAULT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure backwards-compatible columns exist on price_alert_logs if upgrading
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_alert_logs' AND column_name = 'user_id') THEN
        ALTER TABLE public.price_alert_logs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_alert_logs' AND column_name = 'threshold_price') THEN
        ALTER TABLE public.price_alert_logs ADD COLUMN threshold_price NUMERIC(12, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_alert_logs' AND column_name = 'platform') THEN
        ALTER TABLE public.price_alert_logs ADD COLUMN platform TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_alert_logs' AND column_name = 'product_url') THEN
        ALTER TABLE public.price_alert_logs ADD COLUMN product_url TEXT;
    END IF;
END $$;

-- 5. Search Cache Table (Caches Google Custom Search results to preserve 100/day free quota)
CREATE TABLE IF NOT EXISTS public.search_cache (
    query_key TEXT PRIMARY KEY,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now() + INTERVAL '24 hours')
);

-- ==============================================================================
-- 6. INDEXING (Fast lookups, deduplication, and zero compute waste)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_tracked_products_user_id ON public.tracked_products(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_products_active ON public.tracked_products(is_active);
CREATE INDEX IF NOT EXISTS idx_tracked_products_user_active ON public.tracked_products(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_product_links_product_id ON public.product_links(product_id);
CREATE INDEX IF NOT EXISTS idx_product_links_platform ON public.product_links(platform);
CREATE INDEX IF NOT EXISTS idx_price_alert_logs_dedup ON public.price_alert_logs(product_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_alert_logs_sent_at ON public.price_alert_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON public.search_cache(expires_at);

-- ==============================================================================
-- 7. QUOTA ENFORCEMENT TRIGGER (Max 15 active tracked products per user)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_user_tracked_product_limit()
RETURNS TRIGGER AS $$
DECLARE
    active_count INT;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM public.tracked_products
    WHERE user_id = NEW.user_id AND is_active = true;

    IF active_count >= 15 THEN
        RAISE EXCEPTION 'OmniDrop Free-Tier Quota Limit Exceeded: Maximum 15 active tracked items allowed per account.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_user_product_limit ON public.tracked_products;
CREATE TRIGGER trg_check_user_product_limit
    BEFORE INSERT ON public.tracked_products
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_tracked_product_limit();

-- ==============================================================================
-- 8. TIMESTAMPS & AUTOMATED PRICE SYNCHRONIZATION TRIGGERS
-- ==============================================================================

-- Update updated_at automatically on product change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tracked_products_updated_at ON public.tracked_products;
CREATE TRIGGER set_tracked_products_updated_at
    BEFORE UPDATE ON public.tracked_products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Automatically synchronize tracked_products.current_price with lowest product_links.last_price
CREATE OR REPLACE FUNCTION public.sync_product_current_price()
RETURNS TRIGGER AS $$
DECLARE
    target_product_id UUID;
    min_price NUMERIC(12, 2);
    min_platform TEXT;
    min_url TEXT;
    old_current_price NUMERIC(12, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_product_id := OLD.product_id;
    ELSE
        target_product_id := NEW.product_id;
    END IF;

    -- Get current recorded price
    SELECT current_price INTO old_current_price
    FROM public.tracked_products
    WHERE id = target_product_id;

    -- Find the absolute lowest valid price across all linked stores
    SELECT last_price, platform, url
    INTO min_price, min_platform, min_url
    FROM public.product_links
    WHERE product_id = target_product_id
      AND last_price IS NOT NULL
      AND last_price > 0
    ORDER BY last_price ASC
    LIMIT 1;

    -- Update parent product record with sync metadata
    UPDATE public.tracked_products
    SET 
        current_price = min_price,
        lowest_platform = min_platform,
        lowest_url = min_url,
        last_price_change_at = CASE 
            WHEN min_price IS DISTINCT FROM old_current_price THEN timezone('utc'::text, now())
            ELSE last_price_change_at
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = target_product_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_current_price ON public.product_links;
CREATE TRIGGER trg_sync_product_current_price
    AFTER INSERT OR UPDATE OF last_price, platform, url OR DELETE
    ON public.product_links
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_product_current_price();

-- ==============================================================================
-- 9. AUTO-PRUNING & STALE TRACKING SUSPENSION FUNCTIONS (Free-Tier Protection)
-- ==============================================================================

-- 1. Auto-prune alert logs older than 15 days to eliminate database bloat
CREATE OR REPLACE FUNCTION public.prune_price_alert_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_rows INTEGER;
BEGIN
    DELETE FROM public.price_alert_logs
    WHERE sent_at < timezone('utc'::text, now() - INTERVAL '15 days');
    
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Stale Tracking Suspension: Pause items untouched or price unchanged for > 60 days
CREATE OR REPLACE FUNCTION public.suspend_stale_tracking()
RETURNS INTEGER AS $$
DECLARE
    suspended_rows INTEGER;
BEGIN
    UPDATE public.tracked_products
    SET 
        is_active = false,
        updated_at = timezone('utc'::text, now())
    WHERE is_active = true 
      AND last_price_change_at < timezone('utc'::text, now() - INTERVAL '60 days');
      
    GET DIAGNOSTICS suspended_rows = ROW_COUNT;
    RETURN suspended_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Prune expired search cache rows
CREATE OR REPLACE FUNCTION public.clean_expired_search_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_rows INTEGER;
BEGIN
    DELETE FROM public.search_cache
    WHERE expires_at < timezone('utc'::text, now());
    
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

-- Tracked Products Policies (Strict single-tenant isolation by auth.uid())
DROP POLICY IF EXISTS "Users can view their own tracked products" ON public.tracked_products;
CREATE POLICY "Users can view their own tracked products"
    ON public.tracked_products
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own tracked products" ON public.tracked_products;
CREATE POLICY "Users can create their own tracked products"
    ON public.tracked_products
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tracked products" ON public.tracked_products;
CREATE POLICY "Users can update their own tracked products"
    ON public.tracked_products
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tracked products" ON public.tracked_products;
CREATE POLICY "Users can delete their own tracked products"
    ON public.tracked_products
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Product Links Policies (Cascade ownership verification via product_id)
DROP POLICY IF EXISTS "Users can view links for their own products" ON public.product_links;
CREATE POLICY "Users can view links for their own products"
    ON public.product_links
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tracked_products
            WHERE tracked_products.id = product_links.product_id
              AND tracked_products.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert links for their own products" ON public.product_links;
CREATE POLICY "Users can insert links for their own products"
    ON public.product_links
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tracked_products
            WHERE tracked_products.id = product_links.product_id
              AND tracked_products.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update links for their own products" ON public.product_links;
CREATE POLICY "Users can update links for their own products"
    ON public.product_links
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tracked_products
            WHERE tracked_products.id = product_links.product_id
              AND tracked_products.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete links for their own products" ON public.product_links;
CREATE POLICY "Users can delete links for their own products"
    ON public.product_links
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tracked_products
            WHERE tracked_products.id = product_links.product_id
              AND tracked_products.user_id = auth.uid()
        )
    );

-- Price Alert Logs Policies
DROP POLICY IF EXISTS "Users can view alert logs for their own products" ON public.price_alert_logs;
CREATE POLICY "Users can view alert logs for their own products"
    ON public.price_alert_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tracked_products
            WHERE tracked_products.id = price_alert_logs.product_id
              AND tracked_products.user_id = auth.uid()
        )
    );

-- Search Cache Policies (Authenticated users can read cached queries)
DROP POLICY IF EXISTS "Authenticated users can read search cache" ON public.search_cache;
CREATE POLICY "Authenticated users can read search cache"
    ON public.search_cache
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert into search cache" ON public.search_cache;
CREATE POLICY "Authenticated users can insert into search cache"
    ON public.search_cache
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Note: The background cron engine uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS,
-- ensuring seamless, autonomous 24/7 background operation for all users.
