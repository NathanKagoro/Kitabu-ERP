ALTER TABLE "customers" ADD COLUMN "offers_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "sets_qty" numeric(12, 3);