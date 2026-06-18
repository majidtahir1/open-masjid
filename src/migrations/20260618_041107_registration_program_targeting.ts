import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms" ADD COLUMN "registration_program_id" integer;
  ALTER TABLE "students" ADD COLUMN "registered_program_id" integer;
  ALTER TABLE "forms" ADD CONSTRAINT "forms_registration_program_id_terms_id_fk" FOREIGN KEY ("registration_program_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "students" ADD CONSTRAINT "students_registered_program_id_terms_id_fk" FOREIGN KEY ("registered_program_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "forms_registration_program_idx" ON "forms" USING btree ("registration_program_id");
  CREATE INDEX "students_registered_program_idx" ON "students" USING btree ("registered_program_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms" DROP CONSTRAINT "forms_registration_program_id_terms_id_fk";
  
  ALTER TABLE "students" DROP CONSTRAINT "students_registered_program_id_terms_id_fk";
  
  DROP INDEX "forms_registration_program_idx";
  DROP INDEX "students_registered_program_idx";
  ALTER TABLE "forms" DROP COLUMN "registration_program_id";
  ALTER TABLE "students" DROP COLUMN "registered_program_id";`)
}
