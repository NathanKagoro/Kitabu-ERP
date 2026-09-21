CREATE TYPE "public"."business_mode" AS ENUM('genge', 'duka', 'biashara');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('proforma', 'delivery_note', 'invoice');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'sent', 'part_paid', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('nauli', 'ushuru', 'kodi', 'umeme', 'chakula', 'mishahara', 'nyingine');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'manager', 'cashier');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('sale', 'purchase', 'waste', 'adjust', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'mpesa', 'mixx', 'airtel', 'halopesa', 'bank', 'credit');--> statement-breakpoint
CREATE TYPE "public"."product_unit" AS ENUM('fungu', 'kg', 'kipande', 'bunda', 'debe', 'pakti', 'lita', 'dazeni', 'custom');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('complete', 'void');--> statement-breakpoint
CREATE TYPE "public"."vat_type" AS ENUM('standard', 'exempt', 'zero');--> statement-breakpoint
CREATE TYPE "public"."waste_reason" AS ENUM('imeoza', 'imeibiwa', 'imeharibika', 'nyingine');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"mode" "business_mode" DEFAULT 'genge' NOT NULL,
	"tin" text,
	"vrn" text,
	"phone" text,
	"logo_url" text,
	"locale" text DEFAULT 'sw' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "day_closings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"date" date NOT NULL,
	"opening_cash" bigint DEFAULT 0 NOT NULL,
	"expected_cash" bigint NOT NULL,
	"counted_cash" bigint NOT NULL,
	"difference" bigint NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_closings_day_uniq" UNIQUE("business_id","date")
);
--> statement-breakpoint
CREATE TABLE "document_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"unit_price" bigint NOT NULL,
	"vat_type" "vat_type" DEFAULT 'standard' NOT NULL,
	"line_total" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"number" text NOT NULL,
	"customer_id" uuid,
	"parent_id" uuid,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"vat" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"due_date" date,
	"created_by" uuid,
	"client_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "documents_number_uniq" UNIQUE("business_id","kind","number")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"category" "expense_category" DEFAULT 'nyingine' NOT NULL,
	"amount" bigint NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"note" text,
	"created_by" uuid,
	"client_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid,
	"user_id" uuid,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text,
	"phone" text,
	"role" "member_role" DEFAULT 'cashier' NOT NULL,
	"pin_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "members_business_user_uniq" UNIQUE("business_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid,
	"customer_id" uuid,
	"supplier_id" uuid,
	"purchase_id" uuid,
	"document_id" uuid,
	"direction" "payment_direction" DEFAULT 'in' NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" bigint NOT NULL,
	"reference" text,
	"note" text,
	"created_by" uuid,
	"client_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price" bigint NOT NULL,
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_history_day_uniq" UNIQUE("product_id","effective_date")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" "product_unit" DEFAULT 'kipande' NOT NULL,
	"unit_label" text,
	"price" bigint DEFAULT 0 NOT NULL,
	"cost" bigint,
	"track_stock" boolean DEFAULT false NOT NULL,
	"low_stock_level" numeric(12, 3),
	"icon" text,
	"photo_url" text,
	"sku" text,
	"barcode" text,
	"category" text,
	"vat_type" "vat_type" DEFAULT 'standard' NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "purchase_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"total_cost" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"supplier_id" uuid,
	"total" bigint NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"note" text,
	"created_by" uuid,
	"client_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sale_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text,
	"qty" numeric(12, 3) NOT NULL,
	"unit_price" bigint NOT NULL,
	"line_total" bigint NOT NULL,
	"unit_cost" bigint,
	"vat_type" "vat_type" DEFAULT 'standard' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid,
	"total" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"status" "sale_status" DEFAULT 'complete' NOT NULL,
	"void_reason" text,
	"receipt_token" text NOT NULL,
	"note" text,
	"created_by" uuid,
	"client_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_receipt_token_unique" UNIQUE("receipt_token")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"type" "movement_type" NOT NULL,
	"reason" "waste_reason",
	"ref_id" uuid,
	"unit_cost" bigint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waste_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"reason" "waste_reason" DEFAULT 'nyingine' NOT NULL,
	"cost_value" bigint DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" uuid,
	"client_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_closings" ADD CONSTRAINT "day_closings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_events" ADD CONSTRAINT "waste_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_events" ADD CONSTRAINT "waste_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_business_idx" ON "customers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "document_lines_doc_idx" ON "document_lines" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "expenses_time_idx" ON "expenses" USING btree ("business_id","client_created_at");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "payments_time_idx" ON "payments" USING btree ("business_id","client_created_at");--> statement-breakpoint
CREATE INDEX "products_business_idx" ON "products" USING btree ("business_id","active");--> statement-breakpoint
CREATE INDEX "purchase_lines_purchase_idx" ON "purchase_lines" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchases_time_idx" ON "purchases" USING btree ("business_id","client_created_at");--> statement-breakpoint
CREATE INDEX "sale_lines_sale_idx" ON "sale_lines" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_business_time_idx" ON "sales" USING btree ("business_id","client_created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE INDEX "suppliers_business_idx" ON "suppliers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "waste_time_idx" ON "waste_events" USING btree ("business_id","client_created_at");