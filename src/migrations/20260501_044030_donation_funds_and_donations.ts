import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Rename pre-existing 'stripe' rows over to 'connect'. The destination value
  // doesn't yet exist on the enum, so widen to text first, rename, then rebuild
  // the enum with the new label set and cast the column back. The column's
  // DEFAULT references the enum type, so drop+restore it around the rebuild.
  await db.execute(sql`ALTER TABLE "public"."tenants" ALTER COLUMN "donation_config_mode" DROP DEFAULT`)
  await db.execute(sql`ALTER TABLE "public"."tenants" ALTER COLUMN "donation_config_mode" SET DATA TYPE text`)
  await db.execute(
    sql`UPDATE tenants SET donation_config_mode = 'connect' WHERE donation_config_mode = 'stripe'`,
  )
  await db.execute(sql`DROP TYPE "public"."enum_tenants_donation_config_mode"`)
  await db.execute(sql`CREATE TYPE "public"."enum_tenants_donation_config_mode" AS ENUM('external', 'connect')`)
  await db.execute(
    sql`ALTER TABLE "public"."tenants" ALTER COLUMN "donation_config_mode" SET DATA TYPE "public"."enum_tenants_donation_config_mode" USING "donation_config_mode"::"public"."enum_tenants_donation_config_mode"`,
  )
  await db.execute(
    sql`ALTER TABLE "public"."tenants" ALTER COLUMN "donation_config_mode" SET DEFAULT 'external'::"public"."enum_tenants_donation_config_mode"`,
  )

  await db.execute(sql`
   CREATE TYPE "public"."enum_donations_frequency" AS ENUM('one_time', 'monthly');
  CREATE TYPE "public"."enum_donations_status" AS ENUM('succeeded', 'refunded', 'failed');
  CREATE TABLE IF NOT EXISTS "donation_funds_suggested_amounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "donation_funds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"zakat_eligible" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "donations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"fund_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd',
  	"frequency" "enum_donations_frequency" NOT NULL,
  	"status" "enum_donations_status" NOT NULL,
  	"stripe_payment_intent_id" varchar NOT NULL,
  	"stripe_charge_id" varchar,
  	"stripe_subscription_id" varchar,
  	"stripe_account_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tenants" ADD COLUMN "donation_config_stripe_account_connected_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "donation_config_stripe_charges_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "donation_config_stripe_payouts_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "donation_config_stripe_account_last_synced_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "donation_funds_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "donations_id" integer;
  DO $$ BEGIN
   ALTER TABLE "donation_funds_suggested_amounts" ADD CONSTRAINT "donation_funds_suggested_amounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."donation_funds"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "donation_funds" ADD CONSTRAINT "donation_funds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "donations" ADD CONSTRAINT "donations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "donations" ADD CONSTRAINT "donations_fund_id_donation_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."donation_funds"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "donation_funds_suggested_amounts_order_idx" ON "donation_funds_suggested_amounts" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "donation_funds_suggested_amounts_parent_id_idx" ON "donation_funds_suggested_amounts" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "donation_funds_tenant_idx" ON "donation_funds" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "donation_funds_slug_idx" ON "donation_funds" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "donation_funds_updated_at_idx" ON "donation_funds" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "donation_funds_created_at_idx" ON "donation_funds" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_slug_idx" ON "donation_funds" USING btree ("tenant_id","slug");
  CREATE INDEX IF NOT EXISTS "donations_tenant_idx" ON "donations" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "donations_fund_idx" ON "donations" USING btree ("fund_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "donations_stripe_payment_intent_id_idx" ON "donations" USING btree ("stripe_payment_intent_id");
  CREATE INDEX IF NOT EXISTS "donations_updated_at_idx" ON "donations" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "donations_created_at_idx" ON "donations" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_donation_funds_fk" FOREIGN KEY ("donation_funds_id") REFERENCES "public"."donation_funds"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_donations_fk" FOREIGN KEY ("donations_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_donation_funds_id_idx" ON "payload_locked_documents_rels" USING btree ("donation_funds_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_donations_id_idx" ON "payload_locked_documents_rels" USING btree ("donations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "donation_funds_suggested_amounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "donation_funds" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "donations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "donation_funds_suggested_amounts" CASCADE;
  DROP TABLE "donation_funds" CASCADE;
  DROP TABLE "donations" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_donation_funds_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_donations_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_donation_funds_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_donations_id_idx";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "donation_config_stripe_account_connected_at";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "donation_config_stripe_charges_enabled";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "donation_config_stripe_payouts_enabled";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "donation_config_stripe_account_last_synced_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "donation_funds_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "donations_id";
  ALTER TABLE "public"."tenants" ALTER COLUMN "donation_config_mode" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_donation_config_mode";
  CREATE TYPE "public"."enum_tenants_donation_config_mode" AS ENUM('external', 'stripe');
  ALTER TABLE "public"."tenants" ALTER COLUMN "donation_config_mode" SET DATA TYPE "public"."enum_tenants_donation_config_mode" USING "donation_config_mode"::"public"."enum_tenants_donation_config_mode";
  DROP TYPE "public"."enum_donations_frequency";
  DROP TYPE "public"."enum_donations_status";`)
}
