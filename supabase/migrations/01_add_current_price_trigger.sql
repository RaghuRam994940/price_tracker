-- ==============================================================================
-- VECHI: Migration 01 - Add Current Price & Automatic Sync Trigger
-- Run this script in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Add current_price, lowest_platform, and lowest_url columns to tracked_products
ALTER TABLE public.tracked_products
ADD COLUMN IF NOT EXISTS current_price NUMERIC(12, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lowest_platform TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lowest_url TEXT DEFAULT NULL;

-- 2. Trigger Function: Automatically calculate & update the lowest current price
CREATE OR REPLACE FUNCTION public.sync_product_current_price()
RETURNS TRIGGER AS $$
DECLARE
    target_product_id UUID;
    min_price NUMERIC(12, 2);
    min_platform TEXT;
    min_url TEXT;
BEGIN
    -- Determine which product_id was affected
    IF TG_OP = 'DELETE' THEN
        target_product_id := OLD.product_id;
    ELSE
        target_product_id := NEW.product_id;
    END IF;

    -- Query lowest non-null price for this product
    SELECT last_price, platform, url
    INTO min_price, min_platform, min_url
    FROM public.product_links
    WHERE product_id = target_product_id
      AND last_price IS NOT NULL
      AND last_price > 0
    ORDER BY last_price ASC
    LIMIT 1;

    -- Update tracked_products with the current lowest price
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

-- 3. Create Trigger on product_links
DROP TRIGGER IF EXISTS trg_sync_product_current_price ON public.product_links;

CREATE TRIGGER trg_sync_product_current_price
AFTER INSERT OR UPDATE OF last_price, platform, url OR DELETE
ON public.product_links
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_current_price();

-- 4. Retroactively populate current_price for any existing products
DO $$
DECLARE
    prod RECORD;
    min_p NUMERIC(12, 2);
    min_plat TEXT;
    min_u TEXT;
BEGIN
    FOR prod IN SELECT id FROM public.tracked_products LOOP
        SELECT last_price, platform, url
        INTO min_p, min_plat, min_u
        FROM public.product_links
        WHERE product_id = prod.id
          AND last_price IS NOT NULL
          AND last_price > 0
        ORDER BY last_price ASC
        LIMIT 1;

        UPDATE public.tracked_products
        SET current_price = min_p,
            lowest_platform = min_plat,
            lowest_url = min_u
        WHERE id = prod.id;
    END LOOP;
END $$;
