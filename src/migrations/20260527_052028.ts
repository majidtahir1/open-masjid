import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_prayer_display_content_kind" AS ENUM('ayah', 'hadith', 'dua', 'bismillah');
  CREATE TABLE "prayer_display_content" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_prayer_display_content_kind" DEFAULT 'ayah' NOT NULL,
  	"arabic" varchar NOT NULL,
  	"english" varchar NOT NULL,
  	"citation" varchar,
  	"active" boolean DEFAULT true,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tenants" ADD COLUMN "prayer_display_display_city" varchar;
  ALTER TABLE "tenants" ADD COLUMN "prayer_display_dwell_seconds" numeric DEFAULT 10;
  ALTER TABLE "tenants" ADD COLUMN "prayer_display_salah_holdover_minutes" numeric DEFAULT 15;
  ALTER TABLE "tenants" ADD COLUMN "prayer_display_salah_manual_until" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "prayer_display_salah_manual_cleared_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "prayer_display_content_id" integer;
  ALTER TABLE "prayer_display_content" ADD CONSTRAINT "prayer_display_content_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "prayer_display_content_tenant_idx" ON "prayer_display_content" USING btree ("tenant_id");
  CREATE INDEX "prayer_display_content_updated_at_idx" ON "prayer_display_content" USING btree ("updated_at");
  CREATE INDEX "prayer_display_content_created_at_idx" ON "prayer_display_content" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prayer_display_content_fk" FOREIGN KEY ("prayer_display_content_id") REFERENCES "public"."prayer_display_content"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_prayer_display_content_id_idx" ON "payload_locked_documents_rels" USING btree ("prayer_display_content_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "prayer_display_content" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "prayer_display_content" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_prayer_display_content_fk";
  
  DROP INDEX "payload_locked_documents_rels_prayer_display_content_id_idx";
  ALTER TABLE "tenants" DROP COLUMN "prayer_display_display_city";
  ALTER TABLE "tenants" DROP COLUMN "prayer_display_dwell_seconds";
  ALTER TABLE "tenants" DROP COLUMN "prayer_display_salah_holdover_minutes";
  ALTER TABLE "tenants" DROP COLUMN "prayer_display_salah_manual_until";
  ALTER TABLE "tenants" DROP COLUMN "prayer_display_salah_manual_cleared_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "prayer_display_content_id";
  DROP TYPE "public"."enum_prayer_display_content_kind";`)
}
