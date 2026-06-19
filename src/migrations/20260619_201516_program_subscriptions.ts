import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_program_subscriptions_status" AS ENUM('active', 'past_due', 'canceled');
  CREATE TABLE "program_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"guardian_email" varchar NOT NULL,
  	"program_id" integer,
  	"stripe_customer_id" varchar,
  	"stripe_subscription_id" varchar,
  	"stripe_subscription_status" varchar,
  	"status" "enum_program_subscriptions_status" DEFAULT 'active' NOT NULL,
  	"current_period_end" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "students" ADD COLUMN "program_subscription_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "program_subscriptions_id" integer;
  ALTER TABLE "program_subscriptions" ADD CONSTRAINT "program_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "program_subscriptions" ADD CONSTRAINT "program_subscriptions_program_id_terms_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "program_subscriptions_tenant_idx" ON "program_subscriptions" USING btree ("tenant_id");
  CREATE INDEX "program_subscriptions_guardian_email_idx" ON "program_subscriptions" USING btree ("guardian_email");
  CREATE INDEX "program_subscriptions_program_idx" ON "program_subscriptions" USING btree ("program_id");
  CREATE INDEX "program_subscriptions_updated_at_idx" ON "program_subscriptions" USING btree ("updated_at");
  CREATE INDEX "tenant_stripeSubscriptionId_idx" ON "program_subscriptions" USING btree ("tenant_id","stripe_subscription_id");
  ALTER TABLE "students" ADD CONSTRAINT "students_program_subscription_id_program_subscriptions_id_fk" FOREIGN KEY ("program_subscription_id") REFERENCES "public"."program_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_program_subscriptions_fk" FOREIGN KEY ("program_subscriptions_id") REFERENCES "public"."program_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "students_program_subscription_idx" ON "students" USING btree ("program_subscription_id");
  CREATE INDEX "payload_locked_documents_rels_program_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("program_subscriptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "program_subscriptions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "program_subscriptions" CASCADE;
  ALTER TABLE "students" DROP CONSTRAINT "students_program_subscription_id_program_subscriptions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_program_subscriptions_fk";
  
  DROP INDEX "students_program_subscription_idx";
  DROP INDEX "payload_locked_documents_rels_program_subscriptions_id_idx";
  ALTER TABLE "students" DROP COLUMN "program_subscription_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "program_subscriptions_id";
  DROP TYPE "public"."enum_program_subscriptions_status";`)
}
