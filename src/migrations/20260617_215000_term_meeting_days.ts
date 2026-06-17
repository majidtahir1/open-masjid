import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_terms_meeting_day" RENAME TO "enum_terms_meeting_days";
  CREATE TABLE "terms_meeting_days" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_terms_meeting_days",
  	"id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "terms_meeting_days" ADD CONSTRAINT "terms_meeting_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "terms_meeting_days_order_idx" ON "terms_meeting_days" USING btree ("order");
  CREATE INDEX "terms_meeting_days_parent_idx" ON "terms_meeting_days" USING btree ("parent_id");`)

  // Backfill: copy each term's single meeting_day into the new join table
  await db.execute(sql`
    INSERT INTO "terms_meeting_days" ("order", "parent_id", "value")
    SELECT 1, "id", "meeting_day"::text::"enum_terms_meeting_days"
    FROM "terms"
    WHERE "meeting_day" IS NOT NULL
  `)

  await db.execute(sql`
   ALTER TABLE "terms" DROP COLUMN "meeting_day";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "terms" ADD COLUMN "meeting_day" "enum_terms_meeting_days" DEFAULT 'sunday' NOT NULL;`)

  // Best-effort restore: take the first meeting day from the join table (lowest order)
  await db.execute(sql`
    UPDATE "terms" t
    SET "meeting_day" = md."value"
    FROM (
      SELECT DISTINCT ON ("parent_id") "parent_id", "value"
      FROM "terms_meeting_days"
      ORDER BY "parent_id", "order"
    ) md
    WHERE t."id" = md."parent_id"
  `)

  await db.execute(sql`
   DROP TABLE "terms_meeting_days" CASCADE;
  ALTER TYPE "public"."enum_terms_meeting_days" RENAME TO "enum_terms_meeting_day";`)
}
