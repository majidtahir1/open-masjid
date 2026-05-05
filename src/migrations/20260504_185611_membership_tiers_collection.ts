import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_membership_tiers_cadence" AS ENUM('monthly', 'yearly');
  CREATE TABLE IF NOT EXISTS "membership_tiers_archived_price_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"price_id" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "membership_tiers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"description" jsonb,
  	"amount_cents" numeric NOT NULL,
  	"cadence" "enum_membership_tiers_cadence" DEFAULT 'monthly' NOT NULL,
  	"active" boolean DEFAULT true,
  	"sort_order" numeric,
  	"stripe_product_id" varchar,
  	"stripe_price_id" varchar,
  	"last_stripe_sync_at" timestamp(3) with time zone,
  	"last_stripe_sync_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "membership_tiers_id" integer;
  DO $$ BEGIN
   ALTER TABLE "membership_tiers_archived_price_ids" ADD CONSTRAINT "membership_tiers_archived_price_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership_tiers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "membership_tiers" ADD CONSTRAINT "membership_tiers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "membership_tiers_archived_price_ids_order_idx" ON "membership_tiers_archived_price_ids" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "membership_tiers_archived_price_ids_parent_id_idx" ON "membership_tiers_archived_price_ids" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "membership_tiers_tenant_idx" ON "membership_tiers" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "membership_tiers_updated_at_idx" ON "membership_tiers" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "membership_tiers_created_at_idx" ON "membership_tiers" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_membership_tiers_fk" FOREIGN KEY ("membership_tiers_id") REFERENCES "public"."membership_tiers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_membership_tiers_id_idx" ON "payload_locked_documents_rels" USING btree ("membership_tiers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "membership_tiers_archived_price_ids" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_tiers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "membership_tiers_archived_price_ids" CASCADE;
  DROP TABLE "membership_tiers" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_membership_tiers_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_membership_tiers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "membership_tiers_id";
  DROP TYPE "public"."enum_membership_tiers_cadence";`)
}
