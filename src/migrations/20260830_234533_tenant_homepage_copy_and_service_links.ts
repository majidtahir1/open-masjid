import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_link_type" AS ENUM('none', 'page', 'url');
  CREATE TYPE "public"."enum__services_v_version_link_type" AS ENUM('none', 'page', 'url');
  CREATE TYPE "public"."enum_tenants_homepage_copy_services_layout" AS ENUM('cards', 'compact');
  ALTER TABLE "services" ADD COLUMN "link_type" "enum_services_link_type" DEFAULT 'none';
  ALTER TABLE "services" ADD COLUMN "link_page_id" integer;
  ALTER TABLE "services" ADD COLUMN "link_url" varchar;
  ALTER TABLE "_services_v" ADD COLUMN "version_link_type" "enum__services_v_version_link_type" DEFAULT 'none';
  ALTER TABLE "_services_v" ADD COLUMN "version_link_page_id" integer;
  ALTER TABLE "_services_v" ADD COLUMN "version_link_url" varchar;
  ALTER TABLE "tenants" ADD COLUMN "branding_header_arabic_line" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_events_eyebrow" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_events_heading" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_events_subcopy" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_services_eyebrow" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_services_heading" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_services_subcopy" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_services_layout" "enum_tenants_homepage_copy_services_layout" DEFAULT 'cards';
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_donate_eyebrow" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_donate_quote" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_donate_citation" varchar;
  ALTER TABLE "tenants" ADD COLUMN "homepage_copy_donate_button_label" varchar;
  ALTER TABLE "tenants" ADD COLUMN "contact_info_zelle" varchar;
  ALTER TABLE "tenants" ADD COLUMN "footer_legal_note" varchar;
  ALTER TABLE "services" ADD CONSTRAINT "services_link_page_id_pages_id_fk" FOREIGN KEY ("link_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_link_page_id_pages_id_fk" FOREIGN KEY ("version_link_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "services_link_page_idx" ON "services" USING btree ("link_page_id");
  CREATE INDEX "_services_v_version_version_link_page_idx" ON "_services_v" USING btree ("version_link_page_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DROP CONSTRAINT "services_link_page_id_pages_id_fk";
  
  ALTER TABLE "_services_v" DROP CONSTRAINT "_services_v_version_link_page_id_pages_id_fk";
  
  DROP INDEX "services_link_page_idx";
  DROP INDEX "_services_v_version_version_link_page_idx";
  ALTER TABLE "services" DROP COLUMN "link_type";
  ALTER TABLE "services" DROP COLUMN "link_page_id";
  ALTER TABLE "services" DROP COLUMN "link_url";
  ALTER TABLE "_services_v" DROP COLUMN "version_link_type";
  ALTER TABLE "_services_v" DROP COLUMN "version_link_page_id";
  ALTER TABLE "_services_v" DROP COLUMN "version_link_url";
  ALTER TABLE "tenants" DROP COLUMN "branding_header_arabic_line";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_events_eyebrow";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_events_heading";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_events_subcopy";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_services_eyebrow";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_services_heading";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_services_subcopy";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_services_layout";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_donate_eyebrow";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_donate_quote";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_donate_citation";
  ALTER TABLE "tenants" DROP COLUMN "homepage_copy_donate_button_label";
  ALTER TABLE "tenants" DROP COLUMN "contact_info_zelle";
  ALTER TABLE "tenants" DROP COLUMN "footer_legal_note";
  DROP TYPE "public"."enum_services_link_type";
  DROP TYPE "public"."enum__services_v_version_link_type";
  DROP TYPE "public"."enum_tenants_homepage_copy_services_layout";`)
}
