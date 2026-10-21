-- ==============================================================================
-- VECHI: Multi-Store Price Tracker Database Schema
-- Supabase PostgreSQL with Strict Row Level Security (RLS)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tracked Products Table
CREATE TABLE IF NOT EXISTS public.tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    target_price NUMERIC(12, 2) NOT NULL CHECK (target_price > 0),
    current_price NUMERIC(12, 2) DEFAULT NULL,
    lowest_platform TEXT DEFAULT NULL,
    lowest_url TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

-- 4. Price Alert Logs Table (Deduplication & audit history)
CREATE TABLE IF NOT EXISTS public.price_alert_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
    notified_price NUMERIC(12, 2) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tracked_products_user_id ON public.tracked_products(user_id);
CREATE INDEX IF NOT EXISTS idx_product_links_product_id ON public.product_links(product_id);
CREATE INDEX IF NOT EXISTS idx_price_alert_logs_product_id_sent ON public.price_alert_logs(product_id, sent_at DESC);

-- 6. Automatically update updated_at timestamp
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

-- 7. Automatically synchronize tracked_products.current_price with lowest product_links.last_price
CREATE OR REPLACE FUNCTION public.sync_product_current_price()
RETURNS TRIGGER AS $$
DECLARE
    target_product_id UUID;
    min_price NUMERIC(12, 2);
    min_platform TEXT;
    min_url TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_product_id := OLD.product_id;
    ELSE
        target_product_id := NEW.product_id;
    END IF;

    SELECT last_price, platform, url
    INTO min_price, min_platform, min_url
    FROM public.product_links
    WHERE product_id = target_product_id
      AND last_price IS NOT NULL
      AND last_price > 0
    ORDER BY last_price ASC
    LIMIT 1;

    UPDATE public.tracked_products
    SET 
        current_price = min_price,
        lowest_platform = min_platform,
        lowest_url = min_url,
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
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alert_logs ENABLE ROW LEVEL SECURITY;

-- Tracked Products Policies (Single-tenant isolation by auth.uid())
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

-- Note: The background price checker runs with service_role key, bypassing RLS
-- to query all tracked items across all tenants and insert alert logs.
