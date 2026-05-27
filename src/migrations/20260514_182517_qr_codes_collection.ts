import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "qr_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"target_url" varchar NOT NULL,
  	"fg_color" varchar DEFAULT '#000000',
  	"bg_color" varchar DEFAULT '#FFFFFF',
  	"generated_image_id" integer,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "carousel_slides" ADD COLUMN "qr_code_id" integer;
  ALTER TABLE "sponsor_slides" ADD COLUMN "qr_code_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "qr_codes_id" integer;
  ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_generated_image_id_media_id_fk" FOREIGN KEY ("generated_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "qr_codes_generated_image_idx" ON "qr_codes" USING btree ("generated_image_id");
  CREATE INDEX "qr_codes_tenant_idx" ON "qr_codes" USING btree ("tenant_id");
  CREATE INDEX "qr_codes_updated_at_idx" ON "qr_codes" USING btree ("updated_at");
  CREATE INDEX "qr_codes_created_at_idx" ON "qr_codes" USING btree ("created_at");
  ALTER TABLE "carousel_slides" ADD CONSTRAINT "carousel_slides_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sponsor_slides" ADD CONSTRAINT "sponsor_slides_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_qr_codes_fk" FOREIGN KEY ("qr_codes_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "carousel_slides_qr_code_idx" ON "carousel_slides" USING btree ("qr_code_id");
  CREATE INDEX "sponsor_slides_qr_code_idx" ON "sponsor_slides" USING btree ("qr_code_id");
  CREATE INDEX "payload_locked_documents_rels_qr_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("qr_codes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "qr_codes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "qr_codes" CASCADE;
  ALTER TABLE "carousel_slides" DROP CONSTRAINT "carousel_slides_qr_code_id_qr_codes_id_fk";
  
  ALTER TABLE "sponsor_slides" DROP CONSTRAINT "sponsor_slides_qr_code_id_qr_codes_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_qr_codes_fk";
  
  DROP INDEX "carousel_slides_qr_code_idx";
  DROP INDEX "sponsor_slides_qr_code_idx";
  DROP INDEX "payload_locked_documents_rels_qr_codes_id_idx";
  ALTER TABLE "carousel_slides" DROP COLUMN "qr_code_id";
  ALTER TABLE "sponsor_slides" DROP COLUMN "qr_code_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "qr_codes_id";`)
}
