import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_status" AS ENUM('draft', 'published', 'closed');
  CREATE TYPE "public"."enum_forms_payment_mode" AS ENUM('fixed', 'suggested');
  CREATE TYPE "public"."enum_forms_payment_currency" AS ENUM('usd', 'cad', 'gbp');
  CREATE TABLE IF NOT EXISTS "forms_settings_notification_emails" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "forms_payment_suggested_amounts_cents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric
  );
  
  CREATE TABLE IF NOT EXISTS "forms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"status" "enum_forms_status" DEFAULT 'draft' NOT NULL,
  	"description" jsonb,
  	"schema" jsonb DEFAULT '{"steps":[{"id":"s1","fields":[]}]}'::jsonb NOT NULL,
  	"settings_submit_button_label" varchar DEFAULT 'Submit',
  	"settings_success_message" jsonb,
  	"settings_capacity" numeric,
  	"settings_closed_message" varchar DEFAULT 'This form is closed. Thank you for your interest.',
  	"settings_send_confirmation" boolean DEFAULT false,
  	"settings_confirmation_subject" varchar,
  	"settings_confirmation_body" varchar,
  	"payment_enabled" boolean DEFAULT false,
  	"payment_mode" "enum_forms_payment_mode" DEFAULT 'suggested',
  	"payment_price_cents" numeric,
  	"payment_allow_custom_amount" boolean DEFAULT true,
  	"payment_currency" "enum_forms_payment_currency" DEFAULT 'usd',
  	"payment_description" varchar,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pages" ADD COLUMN "seo_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "seo_description" varchar;
  ALTER TABLE "pages" ADD COLUMN "seo_og_image_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_title" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_description" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_seo_og_image_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "forms_id" integer;
  DO $$ BEGIN
   ALTER TABLE "forms_settings_notification_emails" ADD CONSTRAINT "forms_settings_notification_emails_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "forms_payment_suggested_amounts_cents" ADD CONSTRAINT "forms_payment_suggested_amounts_cents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "forms_settings_notification_emails_order_idx" ON "forms_settings_notification_emails" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "forms_settings_notification_emails_parent_id_idx" ON "forms_settings_notification_emails" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "forms_payment_suggested_amounts_cents_order_idx" ON "forms_payment_suggested_amounts_cents" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "forms_payment_suggested_amounts_cents_parent_id_idx" ON "forms_payment_suggested_amounts_cents" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "forms_slug_idx" ON "forms" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "forms_tenant_idx" ON "forms" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "forms_updated_at_idx" ON "forms" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "forms_created_at_idx" ON "forms" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forms_fk" FOREIGN KEY ("forms_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_seo_version_seo_og_image_idx" ON "_pages_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_forms_id_idx" ON "payload_locked_documents_rels" USING btree ("forms_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms_settings_notification_emails" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_payment_suggested_amounts_cents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "forms_settings_notification_emails" CASCADE;
  DROP TABLE "forms_payment_suggested_amounts_cents" CASCADE;
  DROP TABLE "forms" CASCADE;
  ALTER TABLE "pages" DROP CONSTRAINT "pages_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_forms_fk";
  
  DROP INDEX IF EXISTS "pages_seo_seo_og_image_idx";
  DROP INDEX IF EXISTS "_pages_v_version_seo_version_seo_og_image_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_forms_id_idx";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "seo_title";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "seo_description";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "seo_og_image_id";
  ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_seo_title";
  ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_seo_description";
  ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_seo_og_image_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "forms_id";
  DROP TYPE "public"."enum_forms_status";
  DROP TYPE "public"."enum_forms_payment_mode";
  DROP TYPE "public"."enum_forms_payment_currency";`)
}
