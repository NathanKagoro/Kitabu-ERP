-- Accounts are made by the operator, not by the public.
--
-- Kitabu is one app serving many shops. A shop exists because the operator
-- created it (the `accounts` Edge Function, running with the service role);
-- the owner signs in with the setup code they were given and picks a password.
-- Nobody can sign up, and nobody signed in can conjure a new business.

-- ---------------------------------------------------------------------------
-- No business is created from a phone. (The demo build has no server at all,
-- so this only ever applies to real shops.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS businesses_insert ON businesses;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- status: 'active' | 'paused', the operator's switch (e.g. an unpaid month).
-- An owner's phone syncs the whole business row whenever settings change, so
-- a phone's copy of `status` is simply ignored rather than refused: refusing
-- would leave that write stuck in the outbox forever.
-- ---------------------------------------------------------------------------

ALTER TABLE businesses
  ADD CONSTRAINT businesses_status_check CHECK (status IN ('active', 'paused'));
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.businesses_status_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS businesses_status_guard ON businesses;
--> statement-breakpoint
CREATE TRIGGER businesses_status_guard BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_status_guard();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- The account function finds an existing login by its sign-in address. Only
-- the service role may ask: to anyone else this would be a phone-number oracle.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM public;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM anon, authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Receipts carry the shop's address, colour and till numbers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_receipt(p_token text)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'business', json_build_object(
      'name', b.name, 'phone', b.phone, 'tin', b.tin,
      'footer', b.settings ->> 'receiptFooter',
      'address', b.settings ->> 'address',
      'brandColor', b.settings ->> 'brandColor',
      'tillNumbers', b.settings -> 'tillNumbers'
    ),
    'sale', json_build_object(
      'total', s.total, 'discount', s.discount, 'status', s.status,
      'createdAt', s.client_created_at
    ),
    'lines', coalesce((
      SELECT json_agg(json_build_object(
        'description', coalesce(l.description, ''), 'qty', l.qty,
        'unitPrice', l.unit_price, 'lineTotal', l.line_total
      ) ORDER BY l.id)
      FROM sale_lines l WHERE l.sale_id = s.id
    ), '[]'::json)
  )
  FROM sales s JOIN businesses b ON b.id = s.business_id
  WHERE s.receipt_token = p_token AND length(p_token) >= 8
  LIMIT 1;
$$;
