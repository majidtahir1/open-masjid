import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_form_submissions_status" AS ENUM('new', 'reviewed', 'archived');
  CREATE TYPE "public"."enum_form_submissions_payment_status" AS ENUM('na', 'pending_payment', 'paid', 'expired');
  CREATE TABLE IF NOT EXISTS "form_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"form_id" integer NOT NULL,
  	"submitter_email" varchar,
  	"submitter_name" varchar,
  	"data" jsonb NOT NULL,
  	"status" "enum_form_submissions_status" DEFAULT 'new' NOT NULL,
  	"payment_status" "enum_form_submissions_payment_status" DEFAULT 'na',
  	"amount_cents" numeric,
  	"currency" varchar,
  	"stripe_checkout_session_id" varchar,
  	"stripe_payment_intent_id" varchar,
  	"paid_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone NOT NULL,
  	"user_agent" varchar,
  	"ip_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "form_submissions_id" integer;
  DO $$ BEGIN
   ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "form_submissions_tenant_idx" ON "form_submissions" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "form_submissions_form_idx" ON "form_submissions" USING btree ("form_id");
  CREATE INDEX IF NOT EXISTS "form_submissions_stripe_checkout_session_id_idx" ON "form_submissions" USING btree ("stripe_checkout_session_id");
  CREATE INDEX IF NOT EXISTS "form_submissions_stripe_payment_intent_id_idx" ON "form_submissions" USING btree ("stripe_payment_intent_id");
  CREATE INDEX IF NOT EXISTS "form_submissions_updated_at_idx" ON "form_submissions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "form_submissions_created_at_idx" ON "form_submissions" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_submissions_fk" FOREIGN KEY ("form_submissions_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_form_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("form_submissions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "form_submissions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_form_submissions_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_form_submissions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "form_submissions_id";
  DROP TYPE "public"."enum_form_submissions_status";
  DROP TYPE "public"."enum_form_submissions_payment_status";`)
}
