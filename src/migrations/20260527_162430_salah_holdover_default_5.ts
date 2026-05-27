import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ALTER COLUMN "prayer_display_salah_holdover_minutes" SET DEFAULT 5;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ALTER COLUMN "prayer_display_salah_holdover_minutes" SET DEFAULT 15;`)
}
