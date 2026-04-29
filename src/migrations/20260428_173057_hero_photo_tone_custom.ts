import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add a fourth `photoTone` enum value `'custom'` for editors who want to
 * pick a one-off color outside the tenant's brand/secondary/accent slots,
 * and add the sibling `customColor` text columns that store the chosen hex.
 *
 * `ALTER TYPE … ADD VALUE` is idempotent (`IF NOT EXISTS`) and avoids the
 * default-value dependency dance that DROP TYPE + CREATE TYPE would force.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_hero_slides_split_fields_photo_tone" ADD VALUE IF NOT EXISTS 'custom';
    ALTER TYPE "public"."enum_hero_slides_photo_fields_photo_tone" ADD VALUE IF NOT EXISTS 'custom';
    ALTER TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone" ADD VALUE IF NOT EXISTS 'custom';
    ALTER TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone" ADD VALUE IF NOT EXISTS 'custom';

    ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "split_fields_custom_color" varchar;
    ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "photo_fields_custom_color" varchar;
    ALTER TABLE "_hero_slides_v" ADD COLUMN IF NOT EXISTS "version_split_fields_custom_color" varchar;
    ALTER TABLE "_hero_slides_v" ADD COLUMN IF NOT EXISTS "version_photo_fields_custom_color" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Postgres has no `DROP VALUE` for enums. The down path replaces each
  // affected enum with one that lacks `'custom'`, dropping the column
  // default first (it's reinstated after the cast). Any rows currently
  // using `'custom'` are coerced back to the schema default.
  await db.execute(sql`
    ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "split_fields_custom_color";
    ALTER TABLE "hero_slides" DROP COLUMN IF EXISTS "photo_fields_custom_color";
    ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_split_fields_custom_color";
    ALTER TABLE "_hero_slides_v" DROP COLUMN IF EXISTS "version_photo_fields_custom_color";

    ALTER TABLE "hero_slides" ALTER COLUMN "split_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "hero_slides" ALTER COLUMN "photo_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" DROP DEFAULT;
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" DROP DEFAULT;

    UPDATE "hero_slides" SET "split_fields_photo_tone" = 'secondary' WHERE "split_fields_photo_tone" = 'custom';
    UPDATE "hero_slides" SET "photo_fields_photo_tone" = 'brand'     WHERE "photo_fields_photo_tone" = 'custom';
    UPDATE "_hero_slides_v" SET "version_split_fields_photo_tone" = 'secondary' WHERE "version_split_fields_photo_tone" = 'custom';
    UPDATE "_hero_slides_v" SET "version_photo_fields_photo_tone" = 'brand'     WHERE "version_photo_fields_photo_tone" = 'custom';

    ALTER TABLE "public"."hero_slides" ALTER COLUMN "split_fields_photo_tone" SET DATA TYPE text;
    DROP TYPE "public"."enum_hero_slides_split_fields_photo_tone";
    CREATE TYPE "public"."enum_hero_slides_split_fields_photo_tone" AS ENUM('brand', 'secondary', 'accent');
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "split_fields_photo_tone" SET DATA TYPE "public"."enum_hero_slides_split_fields_photo_tone" USING "split_fields_photo_tone"::"public"."enum_hero_slides_split_fields_photo_tone";

    ALTER TABLE "public"."hero_slides" ALTER COLUMN "photo_fields_photo_tone" SET DATA TYPE text;
    DROP TYPE "public"."enum_hero_slides_photo_fields_photo_tone";
    CREATE TYPE "public"."enum_hero_slides_photo_fields_photo_tone" AS ENUM('brand', 'secondary', 'accent');
    ALTER TABLE "public"."hero_slides" ALTER COLUMN "photo_fields_photo_tone" SET DATA TYPE "public"."enum_hero_slides_photo_fields_photo_tone" USING "photo_fields_photo_tone"::"public"."enum_hero_slides_photo_fields_photo_tone";

    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" SET DATA TYPE text;
    DROP TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone";
    CREATE TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone" AS ENUM('brand', 'secondary', 'accent');
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" SET DATA TYPE "public"."enum__hero_slides_v_version_split_fields_photo_tone" USING "version_split_fields_photo_tone"::"public"."enum__hero_slides_v_version_split_fields_photo_tone";

    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" SET DATA TYPE text;
    DROP TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone";
    CREATE TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone" AS ENUM('brand', 'secondary', 'accent');
    ALTER TABLE "public"."_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" SET DATA TYPE "public"."enum__hero_slides_v_version_photo_fields_photo_tone" USING "version_photo_fields_photo_tone"::"public"."enum__hero_slides_v_version_photo_fields_photo_tone";

    ALTER TABLE "hero_slides" ALTER COLUMN "split_fields_photo_tone" SET DEFAULT 'secondary';
    ALTER TABLE "hero_slides" ALTER COLUMN "photo_fields_photo_tone" SET DEFAULT 'brand';
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_split_fields_photo_tone" SET DEFAULT 'secondary';
    ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_photo_fields_photo_tone" SET DEFAULT 'brand';
  `)
}
