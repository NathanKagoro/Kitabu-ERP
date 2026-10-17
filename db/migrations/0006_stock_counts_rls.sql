-- stock_counts: the stock-check reports.
--
-- Everyone in the shop can read them (a cashier can see that the shelf was
-- counted); only owners and managers record one, because a count rewrites the
-- stock ledger. No DELETE policy, as everywhere: a wrong count is followed by
-- a new one, and the history of shortfalls is the point.

ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP TRIGGER IF EXISTS stock_counts_synced_at ON public.stock_counts;
--> statement-breakpoint
CREATE TRIGGER stock_counts_synced_at BEFORE INSERT OR UPDATE ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.touch_synced_at();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stock_counts_synced_idx ON public.stock_counts (synced_at);
--> statement-breakpoint

CREATE POLICY stock_counts_select ON public.stock_counts FOR SELECT
  USING (public.is_member(business_id));
--> statement-breakpoint
CREATE POLICY stock_counts_insert ON public.stock_counts FOR INSERT
  WITH CHECK (public.is_manager(business_id));
--> statement-breakpoint
CREATE POLICY stock_counts_update ON public.stock_counts FOR UPDATE
  USING (public.is_manager(business_id)) WITH CHECK (public.is_manager(business_id));
--> statement-breakpoint

ALTER TABLE public.stock_counts
  ADD CONSTRAINT stock_counts_kind_check CHECK (kind IN ('check', 'opening'));
