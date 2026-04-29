import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rename the per-slide `photoTone` enum from ICP-flavored palette names
 * (`teal | gold | navy`) to brand-neutral semantic slots
 * (`secondary | accent | brand`). Existing rows are translated 1:1 in place:
 *
 *   teal → secondary
 *   gold → accent
 *   navy → brand
 *
 * Postgres does not allow modifying enum values in place when there are
 * dependent columns, so the safe path is:
 *   1. Drop the column default that references the old enum.
 *   2. Cast the column to TEXT (preserves the row values verbatim).
 *   3. UPDATE rows from old labels to new labels.
 *   4. Drop the old enum, create the new enum, cast the column back.
 *   5. Restore a sensible default that matches the new enum.
 *
 * This is repeated for both the live table (`hero_slides`) and the
 * versions table (`_hero_slides_v`), and for both the split-card and
 * full-bleed photo-tone columns.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Drop column defaults so we can change the underlying type.
    ALTER TABLE "hero_slides" ALTER COLUMN "split_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "hero_slides" ALTER COLUMN "photo_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" DROP DEFAULT;

    -- 2. Cast columns to TEXT so we can rewrite values without enum constraint.
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "split_fields_photo_tone" SET DATA TYPE text;
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "photo_fields_photo_tone" SET DATA TYPE text;
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" SET DATA TYPE text;
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" SET DATA TYPE text;

    -- 3. Translate the old palette labels to brand-neutral slots.
    UPDATE "hero_slides" SET "split_fields_photo_tone" = 'secondary' WHERE "split_fields_photo_tone" = 'teal';
    UPDATE "hero_slides" SET "split_fields_photo_tone" = 'accent'    WHERE "split_fields_photo_tone" = 'gold';
    UPDATE "hero_slides" SET "split_fields_photo_tone" = 'brand'     WHERE "split_fields_photo_tone" = 'navy';
    UPDATE "hero_slides" SET "photo_fields_photo_tone" = 'secondary' WHERE "photo_fields_photo_tone" = 'teal';
    UPDATE "hero_slides" SET "photo_fields_photo_tone" = 'accent'    WHERE "photo_fields_photo_tone" = 'gold';
    UPDATE "hero_slides" SET "photo_fields_photo_tone" = 'brand'     WHERE "photo_fields_photo_tone" = 'navy';
    UPDATE "_hero_slides_v" SET "version_split_fields_photo_tone" = 'secondary' WHERE "version_split_fields_photo_tone" = 'teal';
    UPDATE "_hero_slides_v" SET "version_split_fields_photo_tone" = 'accent'    WHERE "version_split_fields_photo_tone" = 'gold';
    UPDATE "_hero_slides_v" SET "version_split_fields_photo_tone" = 'brand'     WHERE "version_split_fields_photo_tone" = 'navy';
    UPDATE "_hero_slides_v" SET "version_photo_fields_photo_tone" = 'secondary' WHERE "version_photo_fields_photo_tone" = 'teal';
    UPDATE "_hero_slides_v" SET "version_photo_fields_photo_tone" = 'accent'    WHERE "version_photo_fields_photo_tone" = 'gold';
    UPDATE "_hero_slides_v" SET "version_photo_fields_photo_tone" = 'brand'     WHERE "version_photo_fields_photo_tone" = 'navy';

    -- 4. Recreate the enums with the new label set, then cast columns back.
    DROP TYPE "public"."enum_hero_slides_split_fields_photo_tone";
    CREATE TYPE "public"."enum_hero_slides_split_fields_photo_tone" AS ENUM('secondary', 'accent', 'brand');
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "split_fields_photo_tone"
      SET DATA TYPE "public"."enum_hero_slides_split_fields_photo_tone"
      USING "split_fields_photo_tone"::"public"."enum_hero_slides_split_fields_photo_tone";

    DROP TYPE "public"."enum_hero_slides_photo_fields_photo_tone";
    CREATE TYPE "public"."enum_hero_slides_photo_fields_photo_tone" AS ENUM('brand', 'secondary', 'accent');
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "photo_fields_photo_tone"
      SET DATA TYPE "public"."enum_hero_slides_photo_fields_photo_tone"
      USING "photo_fields_photo_tone"::"public"."enum_hero_slides_photo_fields_photo_tone";

    DROP TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone";
    CREATE TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone" AS ENUM('secondary', 'accent', 'brand');
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone"
      SET DATA TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone"
      USING "version_split_fields_photo_tone"::"public"."enum__hero_slides_v_version_split_fields_photo_tone";

    DROP TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone";
    CREATE TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone" AS ENUM('brand', 'secondary', 'accent');
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone"
      SET DATA TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone"
      USING "version_photo_fields_photo_tone"::"public"."enum__hero_slides_v_version_photo_fields_photo_tone";

    -- 5. Restore defaults using the new labels.
    ALTER TABLE "hero_slides" ALTER COLUMN "split_fields_photo_tone" SET DEFAULT 'secondary';
    ALTER TABLE "hero_slides" ALTER COLUMN "photo_fields_photo_tone" SET DEFAULT 'brand';
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" SET DEFAULT 'secondary';
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" SET DEFAULT 'brand';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "hero_slides" ALTER COLUMN "split_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "hero_slides" ALTER COLUMN "photo_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" DROP DEFAULT;

    ALTER TABLE "public"."hero_slides" ALTER COLUMN "split_fields_photo_tone" SET DATA TYPE text;
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "photo_fields_photo_tone" SET DATA TYPE text;
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" SET DATA TYPE text;
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" SET DATA TYPE text;

    UPDATE "hero_slides" SET "split_fields_photo_tone" = 'teal' WHERE "split_fields_photo_tone" = 'secondary';
    UPDATE "hero_slides" SET "split_fields_photo_tone" = 'gold' WHERE "split_fields_photo_tone" = 'accent';
    UPDATE "hero_slides" SET "split_fields_photo_tone" = 'navy' WHERE "split_fields_photo_tone" = 'brand';
    UPDATE "hero_slides" SET "photo_fields_photo_tone" = 'teal' WHERE "photo_fields_photo_tone" = 'secondary';
    UPDATE "hero_slides" SET "photo_fields_photo_tone" = 'gold' WHERE "photo_fields_photo_tone" = 'accent';
    UPDATE "hero_slides" SET "photo_fields_photo_tone" = 'navy' WHERE "photo_fields_photo_tone" = 'brand';
    UPDATE "_hero_slides_v" SET "version_split_fields_photo_tone" = 'teal' WHERE "version_split_fields_photo_tone" = 'secondary';
    UPDATE "_hero_slides_v" SET "version_split_fields_photo_tone" = 'gold' WHERE "version_split_fields_photo_tone" = 'accent';
    UPDATE "_hero_slides_v" SET "version_split_fields_photo_tone" = 'navy' WHERE "version_split_fields_photo_tone" = 'brand';
    UPDATE "_hero_slides_v" SET "version_photo_fields_photo_tone" = 'teal' WHERE "version_photo_fields_photo_tone" = 'secondary';
    UPDATE "_hero_slides_v" SET "version_photo_fields_photo_tone" = 'gold' WHERE "version_photo_fields_photo_tone" = 'accent';
    UPDATE "_hero_slides_v" SET "version_photo_fields_photo_tone" = 'navy' WHERE "version_photo_fields_photo_tone" = 'brand';

    DROP TYPE "public"."enum_hero_slides_split_fields_photo_tone";
    CREATE TYPE "public"."enum_hero_slides_split_fields_photo_tone" AS ENUM('teal', 'gold', 'navy');
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "split_fields_photo_tone"
      SET DATA TYPE "public"."enum_hero_slides_split_fields_photo_tone"
      USING "split_fields_photo_tone"::"public"."enum_hero_slides_split_fields_photo_tone";

    DROP TYPE "public"."enum_hero_slides_photo_fields_photo_tone";
    CREATE TYPE "public"."enum_hero_slides_photo_fields_photo_tone" AS ENUM('navy', 'teal', 'gold');
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "photo_fields_photo_tone"
      SET DATA TYPE "public"."enum_hero_slides_photo_fields_photo_tone"
      USING "photo_fields_photo_tone"::"public"."enum_hero_slides_photo_fields_photo_tone";

    DROP TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone";
    CREATE TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone" AS ENUM('teal', 'gold', 'navy');
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone"
      SET DATA TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone"
      USING "version_split_fields_photo_tone"::"public"."enum__hero_slides_v_version_split_fields_photo_tone";

    DROP TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone";
    CREATE TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone" AS ENUM('navy', 'teal', 'gold');
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone"
      SET DATA TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone"
      USING "version_photo_fields_photo_tone"::"public"."enum__hero_slides_v_version_photo_fields_photo_tone";

    ALTER TABLE "hero_slides" ALTER COLUMN "split_fields_photo_tone" SET DEFAULT 'teal';
    ALTER TABLE "hero_slides" ALTER COLUMN "photo_fields_photo_tone" SET DEFAULT 'navy';
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" SET DEFAULT 'teal';
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" SET DEFAULT 'navy';
  `)
}
