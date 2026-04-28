import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_hero_slides_photo_fields_photo_pattern" AS ENUM('arch', 'geometric', 'stars', 'lattice');
  CREATE TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_pattern" AS ENUM('arch', 'geometric', 'stars', 'lattice');
  ALTER TABLE "hero_slides" ADD COLUMN "photo_fields_photo_pattern" "enum_hero_slides_photo_fields_photo_pattern" DEFAULT 'arch';
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_photo_fields_photo_pattern" "enum__hero_slides_v_version_photo_fields_photo_pattern" DEFAULT 'arch';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_photo_pattern";
  ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_photo_pattern";
  DROP TYPE "public"."enum_hero_slides_photo_fields_photo_pattern";
  DROP TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_pattern";`)
}
