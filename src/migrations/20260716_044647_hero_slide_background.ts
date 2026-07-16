import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_hero_slides_background" AS ENUM('default', 'brand');
  CREATE TYPE "public"."enum__hero_slides_v_version_background" AS ENUM('default', 'brand');
  ALTER TABLE "hero_slides" ADD COLUMN "background" "enum_hero_slides_background" DEFAULT 'default';
  ALTER TABLE "_hero_slides_v" ADD COLUMN "version_background" "enum__hero_slides_v_version_background" DEFAULT 'default';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hero_slides" DROP COLUMN "background";
  ALTER TABLE "_hero_slides_v" DROP COLUMN "version_background";
  DROP TYPE "public"."enum_hero_slides_background";
  DROP TYPE "public"."enum__hero_slides_v_version_background";`)
}
