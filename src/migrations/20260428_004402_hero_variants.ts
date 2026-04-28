import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_hero_slides_style" AS ENUM('original', 'split', 'live', 'photo');
  CREATE TYPE "public"."enum_hero_slides_split_fields_photo_tone" AS ENUM('teal', 'gold', 'navy');
  CREATE TYPE "public"."enum_hero_slides_photo_fields_photo_tone" AS ENUM('navy', 'teal', 'gold');
  CREATE TYPE "public"."enum__hero_slides_v_version_style" AS ENUM('original', 'split', 'live', 'photo');
  CREATE TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone" AS ENUM('teal', 'gold', 'navy');
  CREATE TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone" AS ENUM('navy', 'teal', 'gold');
  ALTER TABLE "hero_slides" ADD COLUMN "style" "enum_hero_slides_style" DEFAULT 'original';
  ALTER TABLE "hero_slides" ADD COLUMN "split_fields_photo_label" varchar;
  ALTER TABLE "hero_slides" ADD COLUMN "split_fields_photo_tone" "enum_hero_slides_split_fields_photo_tone" DEFAULT 'teal';
  ALTER TABLE "hero_slides" ADD COLUMN "split_fields_card_tag" varchar;
  ALTER TABLE "hero_slides" ADD COLUMN "split_fields_card_title" varchar;
  ALTER TABLE "hero_slides" ADD COLUMN "split_fields_image_id" integer;
  ALTER TABLE "hero_slides" ADD COLUMN "photo_fields_photo_label" varchar;
  ALTER TABLE "hero_slides" ADD COLUMN "photo_fields_photo_tone" "enum_hero_slides_photo_fields_photo_tone" DEFAULT 'navy';
  ALTER TABLE "hero_slides" ADD COLUMN "photo_fields_image_id" integer;
  ALTER TABLE "hero_slides" ADD COLUMN "photo_fields_ayah_arabic" varchar;
  ALTER TABLE "hero_slides" ADD COLUMN "photo_fields_ayah_translation" varchar;
  ALTER TABLE "hero_slides" ADD COLUMN "photo_fields_ayah_citation" varchar;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_style" "enum__hero_slides_v_version_style" DEFAULT 'original';
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_split_fields_photo_label" varchar;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_split_fields_photo_tone" "enum__hero_slides_v_version_split_fields_photo_tone" DEFAULT 'teal';
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_split_fields_card_tag" varchar;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_split_fields_card_title" varchar;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_split_fields_image_id" integer;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_photo_fields_photo_label" varchar;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_photo_fields_photo_tone" "enum__hero_slides_v_version_photo_fields_photo_tone" DEFAULT 'navy';
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_photo_fields_image_id" integer;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_photo_fields_ayah_arabic" varchar;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_photo_fields_ayah_translation" varchar;
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_photo_fields_ayah_citation" varchar;
  DO $$ BEGIN
   ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_split_fields_image_id_media_id_fk" FOREIGN KEY ("split_fields_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_photo_fields_image_id_media_id_fk" FOREIGN KEY ("photo_fields_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_hero_slides_v" ADD CONSTRAINT "_hero_slides_v_version_split_fields_image_id_media_id_fk" FOREIGN KEY ("version_split_fields_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_hero_slides_v" ADD CONSTRAINT "_hero_slides_v_version_photo_fields_image_id_media_id_fk" FOREIGN KEY ("version_photo_fields_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "hero_slides_split_fields_split_fields_image_idx" ON "hero_slides" USING btree ("split_fields_image_id");
  CREATE INDEX IF NOT EXISTS "hero_slides_photo_fields_photo_fields_image_idx" ON "hero_slides" USING btree ("photo_fields_image_id");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_split_fields_version_split_fields_image_idx" ON "_hero_slides_v" USING btree ("version_split_fields_image_id");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_photo_fields_version_photo_fields_image_idx" ON "_hero_slides_v" USING btree ("version_photo_fields_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hero_slides" DROP CONSTRAINT "hero_slides_split_fields_image_id_media_id_fk";
  
  ALTER TABLE "hero_slides" DROP CONSTRAINT "hero_slides_photo_fields_image_id_media_id_fk";
  
  ALTER TABLE "_hero_slides_v" DROP CONSTRAINT "_hero_slides_v_version_split_fields_image_id_media_id_fk";
  
  ALTER TABLE "_hero_slides_v" DROP CONSTRAINT "_hero_slides_v_version_photo_fields_image_id_media_id_fk";
  
  DROP INDEX IF EXISTS "hero_slides_split_fields_split_fields_image_idx";
  DROP INDEX IF EXISTS "hero_slides_photo_fields_photo_fields_image_idx";
  DROP INDEX IF EXISTS "_hero_slides_v_version_split_fields_version_split_fields_image_idx";
  DROP INDEX IF EXISTS "_hero_slides_v_version_photo_fields_version_photo_fields_image_idx";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "style";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "split_fields_photo_label";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "split_fields_photo_tone";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "split_fields_card_tag";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "split_fields_card_title";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "split_fields_image_id";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_photo_label";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_photo_tone";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_image_id";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_ayah_arabic";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_ayah_translation";
  ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_ayah_citation";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_style";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_split_fields_photo_label";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_split_fields_photo_tone";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_split_fields_card_tag";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_split_fields_card_title";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_split_fields_image_id";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_photo_label";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_photo_tone";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_image_id";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_ayah_arabic";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_ayah_translation";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_ayah_citation";
  DROP TYPE "public"."enum_hero_slides_style";
  DROP TYPE "public"."enum_hero_slides_split_fields_photo_tone";
  DROP TYPE "public"."enum_hero_slides_photo_fields_photo_tone";
  DROP TYPE "public"."enum__hero_slides_v_version_style";
  DROP TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone";
  DROP TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone";`)
}
