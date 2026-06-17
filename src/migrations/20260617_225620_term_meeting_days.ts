import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_terms_meeting_days" AS ENUM('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');
  CREATE TABLE "terms_meeting_days" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_terms_meeting_days",
  	"id" serial PRIMARY KEY NOT NULL
  );

  ALTER TABLE "terms_meeting_days" ADD CONSTRAINT "terms_meeting_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "terms_meeting_days_order_idx" ON "terms_meeting_days" USING btree ("order");
  CREATE INDEX "terms_meeting_days_parent_idx" ON "terms_meeting_days" USING btree ("parent_id");`)

  // Backfill: copy each existing term's single meeting_day into the new join
  // table BEFORE the old column is dropped, so existing programs keep their day.
  await db.execute(sql`
    INSERT INTO "terms_meeting_days" ("order", "parent_id", "value")
    SELECT 1, "id", "meeting_day"::text::"public"."enum_terms_meeting_days"
    FROM "terms"
    WHERE "meeting_day" IS NOT NULL;`)

  await db.execute(sql`
  ALTER TABLE "terms" DROP COLUMN "meeting_day";
  DROP TYPE "public"."enum_terms_meeting_day";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_terms_meeting_day" AS ENUM('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');
  DROP TABLE "terms_meeting_days" CASCADE;
  ALTER TABLE "terms" ADD COLUMN "meeting_day" "enum_terms_meeting_day" DEFAULT 'sunday' NOT NULL;
  DROP TYPE "public"."enum_terms_meeting_days";`)
}
