import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  CREATE INDEX "form_submissions_deleted_at_idx" ON "form_submissions" USING btree ("deleted_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "form_submissions_deleted_at_idx";
  ALTER TABLE "form_submissions" DROP COLUMN "deleted_at";`)
}
