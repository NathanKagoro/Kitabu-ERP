CREATE TABLE "product_packs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text NOT NULL,
	"units" numeric(12, 3) NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD COLUMN "pack_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD COLUMN "pack_label" text;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD COLUMN "pack_qty" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "product_packs" ADD CONSTRAINT "product_packs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_packs" ADD CONSTRAINT "product_packs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_packs_product_idx" ON "product_packs" USING btree ("business_id","product_id");--> statement-breakpoint

-- Same rules as products: everyone in the business can read them, owners and
-- managers maintain them. No DELETE policy; packs are deactivated, not removed.
ALTER TABLE product_packs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY product_packs_select ON product_packs FOR SELECT
  USING (public.is_member(business_id));
--> statement-breakpoint
CREATE POLICY product_packs_insert ON product_packs FOR INSERT
  WITH CHECK (public.is_manager(business_id));
--> statement-breakpoint
CREATE POLICY product_packs_update ON product_packs FOR UPDATE
  USING (public.is_manager(business_id)) WITH CHECK (public.is_manager(business_id));
--> statement-breakpoint
CREATE TRIGGER product_packs_synced_at BEFORE INSERT OR UPDATE ON public.product_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_synced_at();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS product_packs_synced_idx ON public.product_packs (synced_at);
