import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_registration_participant_model" AS ENUM('children', 'self');
  ALTER TABLE "forms" ADD COLUMN "registration_participant_model" "enum_forms_registration_participant_model" DEFAULT 'children';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms" DROP COLUMN "registration_participant_model";
  DROP TYPE "public"."enum_forms_registration_participant_model";`)
}
