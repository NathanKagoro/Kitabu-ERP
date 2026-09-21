-- Row Level Security, derived-balance views, and the few functions the app
-- calls directly. Written by hand: this is the security boundary between
-- businesses, and it should read as a policy document, not generated output.
--
-- Model: a user can touch a row only if they are an active member of the
-- business that owns it. Roles narrow that further (cashiers cannot void,
-- edit products, or close the day). There are no DELETE policies anywhere --
-- financial records are soft-deleted, and RLS enforces that, not just the UI.

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so that the policy on `members` can itself look
-- at `members` without recursing into its own policy.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_member(bid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE business_id = bid AND user_id = auth.uid() AND active AND deleted_at IS NULL
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.member_role(bid uuid)
RETURNS member_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM members
  WHERE business_id = bid AND user_id = auth.uid() AND active AND deleted_at IS NULL
  LIMIT 1;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_manager(bid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.member_role(bid) IN ('owner', 'manager'), false);
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.business_has_no_members(bid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM members WHERE business_id = bid);
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- synced_at: the pull cursor. Always the server's clock, on every write.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_synced_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.synced_at := clock_timestamp();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'businesses','members','products','price_history','stock_movements','customers',
    'suppliers','sales','sale_lines','payments','expenses','purchases','purchase_lines',
    'waste_events','day_closings','documents','document_lines','feedback'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_synced_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_synced_at BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.touch_synced_at()', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_synced_idx ON public.%I (synced_at)', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

CREATE POLICY businesses_select ON businesses FOR SELECT
  USING (public.is_member(id));
--> statement-breakpoint
-- Anyone signed in may create a business; they become its owner in the same sync.
CREATE POLICY businesses_insert ON businesses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
--> statement-breakpoint
-- Only the owner edits the business. (A new business is pushed as a plain
-- insert, so it never needs this policy before its owner row exists.)
CREATE POLICY businesses_update ON businesses FOR UPDATE
  USING (public.member_role(id) = 'owner')
  WITH CHECK (public.member_role(id) = 'owner');
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- members: owners manage staff; the very first row may be the creator making
-- themselves owner; anyone may update their own row (their PIN hash).
-- ---------------------------------------------------------------------------

CREATE POLICY members_select ON members FOR SELECT
  USING (public.is_member(business_id) OR user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY members_insert ON members FOR INSERT
  WITH CHECK (
    public.member_role(business_id) = 'owner'
    OR (public.business_has_no_members(business_id) AND user_id = auth.uid() AND role = 'owner')
  );
--> statement-breakpoint
CREATE POLICY members_update ON members FOR UPDATE
  USING (public.member_role(business_id) = 'owner' OR user_id = auth.uid())
  WITH CHECK (public.member_role(business_id) = 'owner' OR user_id = auth.uid());
--> statement-breakpoint

-- Updating your own row must not be a way to promote yourself.
CREATE OR REPLACE FUNCTION public.members_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.active IS DISTINCT FROM OLD.active
      OR NEW.business_id IS DISTINCT FROM OLD.business_id)
     AND coalesce(public.member_role(OLD.business_id)::text, '') <> 'owner' THEN
    RAISE EXCEPTION 'only an owner can change roles or membership';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER members_guard BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION public.members_guard();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tables every member writes to: selling, customers, expenses, stock ledger.
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales','sale_lines','payments','stock_movements','customers','expenses'] LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.is_member(business_id))', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (public.is_member(business_id))', t, t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Customers and expenses may be edited by anyone who can create them.
CREATE POLICY customers_update ON customers FOR UPDATE
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
--> statement-breakpoint
CREATE POLICY expenses_update ON expenses FOR UPDATE
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
--> statement-breakpoint

-- Changing a recorded sale or payment is voiding it: owners and managers only.
CREATE POLICY sales_update ON sales FOR UPDATE
  USING (public.is_manager(business_id)) WITH CHECK (public.is_manager(business_id));
--> statement-breakpoint
CREATE POLICY payments_update ON payments FOR UPDATE
  USING (public.is_manager(business_id)) WITH CHECK (public.is_manager(business_id));
--> statement-breakpoint
-- The ledger is append-only. There is deliberately no UPDATE policy on
-- stock_movements or sale_lines: corrections are new rows.

-- ---------------------------------------------------------------------------
-- Tables only owners and managers write to.
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','price_history','suppliers','purchases','purchase_lines',
    'waste_events','day_closings','documents','document_lines'
  ] LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.is_member(business_id))', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (public.is_manager(business_id))', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (public.is_manager(business_id)) WITH CHECK (public.is_manager(business_id))', t, t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- feedback: write-only for signed-in users.
-- ---------------------------------------------------------------------------

CREATE POLICY feedback_insert ON feedback FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (business_id IS NULL OR public.is_member(business_id)));
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Derived balances. security_invoker so the views obey the caller's RLS
-- instead of the view owner's -- otherwise a view would be a hole.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.customer_balances WITH (security_invoker = true) AS
SELECT
  c.business_id,
  c.id AS customer_id,
  c.name,
  coalesce(sum(p.amount) FILTER (
    WHERE p.method = 'credit' AND p.sale_id IS NOT NULL
  ), 0)
  - coalesce(sum(p.amount) FILTER (
    WHERE p.method <> 'credit' AND p.sale_id IS NULL
  ), 0) AS balance,
  max(p.client_created_at) FILTER (
    WHERE p.method <> 'credit' AND p.sale_id IS NULL
  ) AS last_paid_at
FROM customers c
LEFT JOIN payments p
  ON p.customer_id = c.id AND p.direction = 'in' AND p.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.business_id, c.id, c.name;
--> statement-breakpoint

CREATE OR REPLACE VIEW public.supplier_balances WITH (security_invoker = true) AS
SELECT
  s.business_id,
  s.id AS supplier_id,
  s.name,
  coalesce((
    SELECT sum(pu.total - pu.paid_amount) FROM purchases pu
    WHERE pu.supplier_id = s.id AND pu.deleted_at IS NULL
  ), 0)
  - coalesce((
    SELECT sum(pa.amount) FROM payments pa
    WHERE pa.supplier_id = s.id AND pa.direction = 'out'
      AND pa.purchase_id IS NULL AND pa.deleted_at IS NULL
  ), 0) AS balance
FROM suppliers s
WHERE s.deleted_at IS NULL;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- public_receipt(token): the only way an anonymous visitor reads anything.
-- Returns exactly one receipt for a token that cannot be guessed, and never
-- more than the receipt shows on paper.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_receipt(p_token text)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'business', json_build_object(
      'name', b.name, 'phone', b.phone, 'tin', b.tin,
      'footer', b.settings ->> 'receiptFooter'
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
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.public_receipt(text) FROM public;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.public_receipt(text) TO anon, authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- claim_invites(): a staff member's first sign-in attaches the invites that
-- an owner made out to their phone number.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_invites()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_phone text;
  claimed integer;
BEGIN
  SELECT regexp_replace(coalesce(phone, ''), '\D', '', 'g') INTO my_phone
  FROM auth.users WHERE id = auth.uid();
  IF my_phone IS NULL OR my_phone = '' THEN
    RETURN 0;
  END IF;

  UPDATE members
     SET user_id = auth.uid(), updated_at = now()
   WHERE user_id IS NULL
     AND active
     AND regexp_replace(coalesce(phone, ''), '\D', '', 'g') = my_phone;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.claim_invites() FROM public;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.claim_invites() TO authenticated;
