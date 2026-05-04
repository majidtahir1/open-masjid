import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" ADD COLUMN "show_in_nav" boolean DEFAULT false;
  ALTER TABLE "pages" ADD COLUMN "nav_order" numeric;
  ALTER TABLE "_pages_v" ADD COLUMN "version_show_in_nav" boolean DEFAULT false;
  ALTER TABLE "_pages_v" ADD COLUMN "version_nav_order" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" DROP COLUMN IF EXISTS "show_in_nav";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "nav_order";
  ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_show_in_nav";
  ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_nav_order";`)
}
