import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_members_status" AS ENUM('active', 'grace', 'inactive');
  CREATE TABLE IF NOT EXISTS "members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"tier_id" integer NOT NULL,
  	"status" "enum_members_status" DEFAULT 'inactive' NOT NULL,
  	"stripe_customer_id" varchar,
  	"stripe_subscription_id" varchar,
  	"stripe_subscription_status" varchar,
  	"joined_at" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"canceled_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "members_id" integer;
  DO $$ BEGIN
   ALTER TABLE "members" ADD CONSTRAINT "members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "members" ADD CONSTRAINT "members_tier_id_membership_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."membership_tiers"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "members_tenant_idx" ON "members" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "members_email_idx" ON "members" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "members_tier_idx" ON "members" USING btree ("tier_id");
  CREATE INDEX IF NOT EXISTS "members_updated_at_idx" ON "members" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "members_created_at_idx" ON "members" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenant_email_idx" ON "members" USING btree ("tenant_id","email");
  CREATE INDEX IF NOT EXISTS "tenant_status_idx" ON "members" USING btree ("tenant_id","status");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_members_id_idx" ON "payload_locked_documents_rels" USING btree ("members_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "members" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "members" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_members_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_members_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "members_id";
  DROP TYPE "public"."enum_members_status";`)
}
