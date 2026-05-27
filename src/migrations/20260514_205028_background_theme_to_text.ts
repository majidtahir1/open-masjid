import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "carousel_slides" ALTER COLUMN "background_theme" SET DATA TYPE varchar;
  ALTER TABLE "carousel_slides" ALTER COLUMN "background_theme" SET DEFAULT 'clean';
  DROP TYPE "public"."enum_carousel_slides_background_theme";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_carousel_slides_background_theme" AS ENUM('clean', 'subtle-texture', 'teal-corners', 'navy-accents', 'full-ambiance', 'ornate-frame', 'desert-oasis', 'islamic_pattern', 'pink-tech', 'blue-tech', 'chess-theme', 'quran-theme', 'ramadan');
  ALTER TABLE "carousel_slides" ALTER COLUMN "background_theme" SET DEFAULT 'clean'::"public"."enum_carousel_slides_background_theme";
  ALTER TABLE "carousel_slides" ALTER COLUMN "background_theme" SET DATA TYPE "public"."enum_carousel_slides_background_theme" USING "background_theme"::"public"."enum_carousel_slides_background_theme";`)
}
