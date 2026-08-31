import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ADD COLUMN "contact_info_zelle_qr_code_id" integer;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_contact_info_zelle_qr_code_id_media_id_fk" FOREIGN KEY ("contact_info_zelle_qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tenants_contact_info_contact_info_zelle_qr_code_idx" ON "tenants" USING btree ("contact_info_zelle_qr_code_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" DROP CONSTRAINT "tenants_contact_info_zelle_qr_code_id_media_id_fk";
  
  DROP INDEX "tenants_contact_info_contact_info_zelle_qr_code_idx";
  ALTER TABLE "tenants" DROP COLUMN "contact_info_zelle_qr_code_id";`)
}
