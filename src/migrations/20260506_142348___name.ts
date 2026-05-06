import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_appearance_display_mode" AS ENUM('all-at-once', 'one-per-page');
  CREATE TYPE "public"."enum_forms_appearance_background_gradient_direction" AS ENUM('vertical', 'horizontal', 'diagonal');
  ALTER TABLE "forms" ADD COLUMN "appearance_display_mode" "enum_forms_appearance_display_mode" DEFAULT 'all-at-once';
  ALTER TABLE "forms" ADD COLUMN "appearance_intro_message" jsonb;
  ALTER TABLE "forms" ADD COLUMN "appearance_submission_message" jsonb;
  ALTER TABLE "forms" ADD COLUMN "appearance_background_color" varchar;
  ALTER TABLE "forms" ADD COLUMN "appearance_background_gradient_from" varchar;
  ALTER TABLE "forms" ADD COLUMN "appearance_background_gradient_to" varchar;
  ALTER TABLE "forms" ADD COLUMN "appearance_background_gradient_direction" "enum_forms_appearance_background_gradient_direction" DEFAULT 'vertical';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms" DROP COLUMN IF EXISTS "appearance_display_mode";
  ALTER TABLE "forms" DROP COLUMN IF EXISTS "appearance_intro_message";
  ALTER TABLE "forms" DROP COLUMN IF EXISTS "appearance_submission_message";
  ALTER TABLE "forms" DROP COLUMN IF EXISTS "appearance_background_color";
  ALTER TABLE "forms" DROP COLUMN IF EXISTS "appearance_background_gradient_from";
  ALTER TABLE "forms" DROP COLUMN IF EXISTS "appearance_background_gradient_to";
  ALTER TABLE "forms" DROP COLUMN IF EXISTS "appearance_background_gradient_direction";
  DROP TYPE "public"."enum_forms_appearance_display_mode";
  DROP TYPE "public"."enum_forms_appearance_background_gradient_direction";`)
}
