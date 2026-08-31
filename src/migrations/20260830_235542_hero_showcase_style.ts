import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_hero_slides_style" ADD VALUE 'showcase';
  ALTER TYPE "public"."enum__hero_slides_v_version_style" ADD VALUE 'showcase';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hero_slides" ALTER COLUMN "style" SET DATA TYPE text;
  ALTER TABLE "hero_slides" ALTER COLUMN "style" SET DEFAULT 'original'::text;
  DROP TYPE "public"."enum_hero_slides_style";
  CREATE TYPE "public"."enum_hero_slides_style" AS ENUM('original', 'split', 'live', 'photo');
  ALTER TABLE "hero_slides" ALTER COLUMN "style" SET DEFAULT 'original'::"public"."enum_hero_slides_style";
  ALTER TABLE "hero_slides" ALTER COLUMN "style" SET DATA TYPE "public"."enum_hero_slides_style" USING "style"::"public"."enum_hero_slides_style";
  ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_style" SET DATA TYPE text;
  ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_style" SET DEFAULT 'original'::text;
  DROP TYPE "public"."enum__hero_slides_v_version_style";
  CREATE TYPE "public"."enum__hero_slides_v_version_style" AS ENUM('original', 'split', 'live', 'photo');
  ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_style" SET DEFAULT 'original'::"public"."enum__hero_slides_v_version_style";
  ALTER TABLE "_hero_slides_v" ALTER COLUMN "version_style" SET DATA TYPE "public"."enum__hero_slides_v_version_style" USING "version_style"::"public"."enum__hero_slides_v_version_style";`)
}
