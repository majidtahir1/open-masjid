import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_carousel_slides_background_theme" AS ENUM('clean', 'geometric', 'arabesque', 'mihrab');
  CREATE TYPE "public"."enum_sponsor_slides_background_style" AS ENUM('gradient', 'solid', 'brand-primary', 'brand-secondary');
  CREATE TYPE "public"."enum_sponsor_slides_layout_template" AS ENUM('logo-left', 'logo-top-centered', 'logo-dominant', 'split-screen');
  CREATE TYPE "public"."enum_weekly_events_slides_entries_day" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
  CREATE TABLE "carousel_slides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"details1" varchar,
  	"details2" varchar,
  	"image_id" integer,
  	"background_theme" "enum_carousel_slides_background_theme" DEFAULT 'clean',
  	"prayer_timings_enabled" boolean DEFAULT false,
  	"display_duration_ms" numeric DEFAULT 10000,
  	"priority" numeric DEFAULT 5,
  	"active" boolean DEFAULT true,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"show_in_carousel" boolean DEFAULT true,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sponsor_slides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"tagline" varchar,
  	"logo_id" integer,
  	"brand_color_primary" varchar,
  	"brand_color_secondary" varchar,
  	"background_style" "enum_sponsor_slides_background_style" DEFAULT 'gradient',
  	"layout_template" "enum_sponsor_slides_layout_template" DEFAULT 'logo-left' NOT NULL,
  	"details1" varchar,
  	"details2" varchar,
  	"details3" varchar,
  	"contact_phone" varchar,
  	"contact_address" varchar,
  	"contact_website" varchar,
  	"cta_text" varchar,
  	"display_duration_ms" numeric DEFAULT 10000,
  	"priority" numeric DEFAULT 5,
  	"active" boolean DEFAULT true,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "weekly_events_slides_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "enum_weekly_events_slides_entries_day" NOT NULL,
  	"time" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"location" varchar,
  	"audience" varchar
  );
  
  CREATE TABLE "weekly_events_slides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Weekly Schedule' NOT NULL,
  	"display_duration_ms" numeric DEFAULT 15000,
  	"active" boolean DEFAULT true,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "kiosks_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"carousel_slides_id" integer,
  	"sponsor_slides_id" integer,
  	"weekly_events_slides_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "carousel_slides_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sponsor_slides_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "weekly_events_slides_id" integer;
  ALTER TABLE "carousel_slides" ADD CONSTRAINT "carousel_slides_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "carousel_slides" ADD CONSTRAINT "carousel_slides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sponsor_slides" ADD CONSTRAINT "sponsor_slides_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sponsor_slides" ADD CONSTRAINT "sponsor_slides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "weekly_events_slides_entries" ADD CONSTRAINT "weekly_events_slides_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."weekly_events_slides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "weekly_events_slides" ADD CONSTRAINT "weekly_events_slides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "kiosks_rels" ADD CONSTRAINT "kiosks_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."kiosks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "kiosks_rels" ADD CONSTRAINT "kiosks_rels_carousel_slides_fk" FOREIGN KEY ("carousel_slides_id") REFERENCES "public"."carousel_slides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "kiosks_rels" ADD CONSTRAINT "kiosks_rels_sponsor_slides_fk" FOREIGN KEY ("sponsor_slides_id") REFERENCES "public"."sponsor_slides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "kiosks_rels" ADD CONSTRAINT "kiosks_rels_weekly_events_slides_fk" FOREIGN KEY ("weekly_events_slides_id") REFERENCES "public"."weekly_events_slides"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "carousel_slides_image_idx" ON "carousel_slides" USING btree ("image_id");
  CREATE INDEX "carousel_slides_tenant_idx" ON "carousel_slides" USING btree ("tenant_id");
  CREATE INDEX "carousel_slides_updated_at_idx" ON "carousel_slides" USING btree ("updated_at");
  CREATE INDEX "carousel_slides_created_at_idx" ON "carousel_slides" USING btree ("created_at");
  CREATE INDEX "sponsor_slides_logo_idx" ON "sponsor_slides" USING btree ("logo_id");
  CREATE INDEX "sponsor_slides_tenant_idx" ON "sponsor_slides" USING btree ("tenant_id");
  CREATE INDEX "sponsor_slides_updated_at_idx" ON "sponsor_slides" USING btree ("updated_at");
  CREATE INDEX "sponsor_slides_created_at_idx" ON "sponsor_slides" USING btree ("created_at");
  CREATE INDEX "weekly_events_slides_entries_order_idx" ON "weekly_events_slides_entries" USING btree ("_order");
  CREATE INDEX "weekly_events_slides_entries_parent_id_idx" ON "weekly_events_slides_entries" USING btree ("_parent_id");
  CREATE INDEX "weekly_events_slides_tenant_idx" ON "weekly_events_slides" USING btree ("tenant_id");
  CREATE INDEX "weekly_events_slides_updated_at_idx" ON "weekly_events_slides" USING btree ("updated_at");
  CREATE INDEX "weekly_events_slides_created_at_idx" ON "weekly_events_slides" USING btree ("created_at");
  CREATE INDEX "kiosks_rels_order_idx" ON "kiosks_rels" USING btree ("order");
  CREATE INDEX "kiosks_rels_parent_idx" ON "kiosks_rels" USING btree ("parent_id");
  CREATE INDEX "kiosks_rels_path_idx" ON "kiosks_rels" USING btree ("path");
  CREATE INDEX "kiosks_rels_carousel_slides_id_idx" ON "kiosks_rels" USING btree ("carousel_slides_id");
  CREATE INDEX "kiosks_rels_sponsor_slides_id_idx" ON "kiosks_rels" USING btree ("sponsor_slides_id");
  CREATE INDEX "kiosks_rels_weekly_events_slides_id_idx" ON "kiosks_rels" USING btree ("weekly_events_slides_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_carousel_slides_fk" FOREIGN KEY ("carousel_slides_id") REFERENCES "public"."carousel_slides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sponsor_slides_fk" FOREIGN KEY ("sponsor_slides_id") REFERENCES "public"."sponsor_slides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_weekly_events_slides_fk" FOREIGN KEY ("weekly_events_slides_id") REFERENCES "public"."weekly_events_slides"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_carousel_slides_id_idx" ON "payload_locked_documents_rels" USING btree ("carousel_slides_id");
  CREATE INDEX "payload_locked_documents_rels_sponsor_slides_id_idx" ON "payload_locked_documents_rels" USING btree ("sponsor_slides_id");
  CREATE INDEX "payload_locked_documents_rels_weekly_events_slides_id_idx" ON "payload_locked_documents_rels" USING btree ("weekly_events_slides_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "carousel_slides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sponsor_slides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "weekly_events_slides_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "weekly_events_slides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "kiosks_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "carousel_slides" CASCADE;
  DROP TABLE "sponsor_slides" CASCADE;
  DROP TABLE "weekly_events_slides_entries" CASCADE;
  DROP TABLE "weekly_events_slides" CASCADE;
  DROP TABLE "kiosks_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_carousel_slides_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sponsor_slides_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_weekly_events_slides_fk";
  
  DROP INDEX "payload_locked_documents_rels_carousel_slides_id_idx";
  DROP INDEX "payload_locked_documents_rels_sponsor_slides_id_idx";
  DROP INDEX "payload_locked_documents_rels_weekly_events_slides_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "carousel_slides_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sponsor_slides_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "weekly_events_slides_id";
  DROP TYPE "public"."enum_carousel_slides_background_theme";
  DROP TYPE "public"."enum_sponsor_slides_background_style";
  DROP TYPE "public"."enum_sponsor_slides_layout_template";
  DROP TYPE "public"."enum_weekly_events_slides_entries_day";`)
}
