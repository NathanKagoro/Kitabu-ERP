CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text DEFAULT 'check' NOT NULL,
	"scope" text,
	"items_counted" bigint DEFAULT 0 NOT NULL,
	"lines_short" bigint DEFAULT 0 NOT NULL,
	"units_short" numeric(12, 3) DEFAULT 0 NOT NULL,
	"value_short_cost" bigint DEFAULT 0 NOT NULL,
	"value_short_price" bigint DEFAULT 0 NOT NULL,
	"units_over" numeric(12, 3) DEFAULT 0 NOT NULL,
	"value_over_cost" bigint DEFAULT 0 NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"created_by" uuid,
	"client_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "no_offers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_counts_business_idx" ON "stock_counts" USING btree ("business_id","client_created_at");