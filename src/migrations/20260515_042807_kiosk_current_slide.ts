import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "kiosks" ADD COLUMN "current_slide_title" varchar;
  ALTER TABLE "kiosks" ADD COLUMN "current_slide_type" varchar;
  ALTER TABLE "kiosks" ADD COLUMN "current_slide_index" numeric;
  ALTER TABLE "kiosks" ADD COLUMN "current_slide_total" numeric;
  ALTER TABLE "kiosks" ADD COLUMN "current_slide_duration_ms" numeric;
  ALTER TABLE "kiosks" ADD COLUMN "current_slide_started_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "kiosks" DROP COLUMN "current_slide_title";
  ALTER TABLE "kiosks" DROP COLUMN "current_slide_type";
  ALTER TABLE "kiosks" DROP COLUMN "current_slide_index";
  ALTER TABLE "kiosks" DROP COLUMN "current_slide_total";
  ALTER TABLE "kiosks" DROP COLUMN "current_slide_duration_ms";
  ALTER TABLE "kiosks" DROP COLUMN "current_slide_started_at";`)
}
