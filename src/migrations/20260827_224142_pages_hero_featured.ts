import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_hero_accent" AS ENUM('cream', 'teal', 'navy', 'gold');
  CREATE TYPE "public"."enum__pages_v_version_hero_accent" AS ENUM('cream', 'teal', 'navy', 'gold');
  ALTER TABLE "pages" ADD COLUMN "featured" boolean DEFAULT false;
  ALTER TABLE "pages" ADD COLUMN "hero_excerpt" varchar;
  ALTER TABLE "pages" ADD COLUMN "hero_accent" "enum_pages_hero_accent";
  ALTER TABLE "_pages_v" ADD COLUMN "version_featured" boolean DEFAULT false;
  ALTER TABLE "_pages_v" ADD COLUMN "version_hero_excerpt" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_hero_accent" "enum__pages_v_version_hero_accent";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" DROP COLUMN "featured";
  ALTER TABLE "pages" DROP COLUMN "hero_excerpt";
  ALTER TABLE "pages" DROP COLUMN "hero_accent";
  ALTER TABLE "_pages_v" DROP COLUMN "version_featured";
  ALTER TABLE "_pages_v" DROP COLUMN "version_hero_excerpt";
  ALTER TABLE "_pages_v" DROP COLUMN "version_hero_accent";
  DROP TYPE "public"."enum_pages_hero_accent";
  DROP TYPE "public"."enum__pages_v_version_hero_accent";`)
}
