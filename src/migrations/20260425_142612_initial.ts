import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('platformOwner', 'admin', 'staff');
  CREATE TYPE "public"."enum_tenants_social_links_platform" AS ENUM('facebook', 'instagram', 'youtube', 'twitter', 'linkedin');
  CREATE TYPE "public"."enum_tenants_site_type" AS ENUM('masjid', 'umbrella');
  CREATE TYPE "public"."enum_tenants_branding_display_font" AS ENUM('Fraunces', 'Playfair Display', 'Lora');
  CREATE TYPE "public"."enum_tenants_prayer_calc_method" AS ENUM('ISNA', 'MWL', 'Egyptian', 'UmmAlQura', 'Karachi', 'Tehran', 'Jafari');
  CREATE TYPE "public"."enum_tenants_prayer_calc_asr_madhab" AS ENUM('Standard', 'Hanafi');
  CREATE TYPE "public"."enum_tenants_donation_config_mode" AS ENUM('external', 'stripe');
  CREATE TYPE "public"."enum_events_audience" AS ENUM('families', 'sisters', 'youth', 'brothers', 'all');
  CREATE TYPE "public"."enum_events_tag" AS ENUM('weekly-class', 'ramadan', 'eid', 'sisters', 'youth', 'brothers', 'community');
  CREATE TYPE "public"."enum_events_display_mode" AS ENUM('image', 'template', 'text');
  CREATE TYPE "public"."enum_events_template_variant" AS ENUM('default', 'navy', 'gold');
  CREATE TYPE "public"."enum_events_hero_accent" AS ENUM('cream', 'teal', 'navy', 'gold');
  CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_version_audience" AS ENUM('families', 'sisters', 'youth', 'brothers', 'all');
  CREATE TYPE "public"."enum__events_v_version_tag" AS ENUM('weekly-class', 'ramadan', 'eid', 'sisters', 'youth', 'brothers', 'community');
  CREATE TYPE "public"."enum__events_v_version_display_mode" AS ENUM('image', 'template', 'text');
  CREATE TYPE "public"."enum__events_v_version_template_variant" AS ENUM('default', 'navy', 'gold');
  CREATE TYPE "public"."enum__events_v_version_hero_accent" AS ENUM('cream', 'teal', 'navy', 'gold');
  CREATE TYPE "public"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_hero_slides_ctas_link_type" AS ENUM('page', 'url');
  CREATE TYPE "public"."enum_hero_slides_ctas_page" AS ENUM('/', '/events', '/prayer-times', '/donate', '/about');
  CREATE TYPE "public"."enum_hero_slides_accent" AS ENUM('cream', 'teal', 'navy', 'gold');
  CREATE TYPE "public"."enum_hero_slides_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__hero_slides_v_version_ctas_link_type" AS ENUM('page', 'url');
  CREATE TYPE "public"."enum__hero_slides_v_version_ctas_page" AS ENUM('/', '/events', '/prayer-times', '/donate', '/about');
  CREATE TYPE "public"."enum__hero_slides_v_version_accent" AS ENUM('cream', 'teal', 'navy', 'gold');
  CREATE TYPE "public"."enum__hero_slides_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_prayer_schedules_iqamah_rules_fajr_mode" AS ENUM('absolute', 'offset');
  CREATE TYPE "public"."enum_prayer_schedules_iqamah_rules_zuhr_mode" AS ENUM('absolute', 'offset');
  CREATE TYPE "public"."enum_prayer_schedules_iqamah_rules_asr_mode" AS ENUM('absolute', 'offset');
  CREATE TYPE "public"."enum_prayer_schedules_iqamah_rules_maghrib_mode" AS ENUM('absolute', 'offset');
  CREATE TYPE "public"."enum_prayer_schedules_iqamah_rules_isha_mode" AS ENUM('absolute', 'offset');
  CREATE TYPE "public"."enum_announcements_priority" AS ENUM('normal', 'high');
  CREATE TYPE "public"."enum_announcements_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__announcements_v_version_priority" AS ENUM('normal', 'high');
  CREATE TYPE "public"."enum__announcements_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_services_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__services_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TABLE IF NOT EXISTS "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'staff' NOT NULL,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_custom_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_tenants_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"site_type" "enum_tenants_site_type" DEFAULT 'masjid' NOT NULL,
  	"branding_logo_id" integer,
  	"branding_favicon_id" integer,
  	"branding_primary_color" varchar,
  	"branding_secondary_color" varchar,
  	"branding_accent_color" varchar,
  	"branding_display_font" "enum_tenants_branding_display_font" DEFAULT 'Fraunces',
  	"location_lat" numeric,
  	"location_lng" numeric,
  	"location_timezone" varchar,
  	"prayer_calc_method" "enum_tenants_prayer_calc_method" DEFAULT 'ISNA',
  	"prayer_calc_asr_madhab" "enum_tenants_prayer_calc_asr_madhab" DEFAULT 'Standard',
  	"contact_info_phone" varchar,
  	"contact_info_email" varchar,
  	"contact_info_address" varchar,
  	"footer_tagline" varchar,
  	"donation_config_mode" "enum_tenants_donation_config_mode" DEFAULT 'external',
  	"donation_config_external_url" varchar,
  	"donation_config_stripe_account_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_favicon_url" varchar,
  	"sizes_favicon_width" numeric,
  	"sizes_favicon_height" numeric,
  	"sizes_favicon_mime_type" varchar,
  	"sizes_favicon_filesize" numeric,
  	"sizes_favicon_filename" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "events_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_events_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"short_description" varchar,
  	"description" jsonb,
  	"tag" "enum_events_tag",
  	"when" varchar,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"location" varchar,
  	"address" varchar,
  	"contact" varchar,
  	"display_mode" "enum_events_display_mode" DEFAULT 'text',
  	"flyer_image_id" integer,
  	"template_variant" "enum_events_template_variant",
  	"featured" boolean DEFAULT false,
  	"hero_accent" "enum_events_hero_accent",
  	"slug" varchar,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_events_status" DEFAULT 'draft'
  );
  
  CREATE TABLE IF NOT EXISTS "_events_v_version_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__events_v_version_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_short_description" varchar,
  	"version_description" jsonb,
  	"version_tag" "enum__events_v_version_tag",
  	"version_when" varchar,
  	"version_start_date" timestamp(3) with time zone,
  	"version_end_date" timestamp(3) with time zone,
  	"version_location" varchar,
  	"version_address" varchar,
  	"version_contact" varchar,
  	"version_display_mode" "enum__events_v_version_display_mode" DEFAULT 'text',
  	"version_flyer_image_id" integer,
  	"version_template_variant" "enum__events_v_version_template_variant",
  	"version_featured" boolean DEFAULT false,
  	"version_hero_accent" "enum__events_v_version_hero_accent",
  	"version_slug" varchar,
  	"version_tenant_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "hero_slides_ctas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"link_type" "enum_hero_slides_ctas_link_type" DEFAULT 'url',
  	"page" "enum_hero_slides_ctas_page",
  	"url" varchar,
  	"icon" varchar,
  	"primary" boolean DEFAULT false
  );
  
  CREATE TABLE IF NOT EXISTS "hero_slides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar,
  	"body" varchar,
  	"meta" varchar,
  	"accent" "enum_hero_slides_accent" DEFAULT 'cream',
  	"sort_order" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_hero_slides_status" DEFAULT 'draft'
  );
  
  CREATE TABLE IF NOT EXISTS "_hero_slides_v_version_ctas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"link_type" "enum__hero_slides_v_version_ctas_link_type" DEFAULT 'url',
  	"page" "enum__hero_slides_v_version_ctas_page",
  	"url" varchar,
  	"icon" varchar,
  	"primary" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_hero_slides_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_eyebrow" varchar,
  	"version_title" varchar,
  	"version_body" varchar,
  	"version_meta" varchar,
  	"version_accent" "enum__hero_slides_v_version_accent" DEFAULT 'cream',
  	"version_sort_order" numeric DEFAULT 0,
  	"version_active" boolean DEFAULT true,
  	"version_tenant_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__hero_slides_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "prayer_schedules_jummah_times" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "prayer_schedules_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"sunrise" varchar,
  	"fajr_adhan" varchar,
  	"fajr_iqamah" varchar,
  	"zuhr_adhan" varchar,
  	"zuhr_iqamah" varchar,
  	"asr_adhan" varchar,
  	"asr_iqamah" varchar,
  	"maghrib_adhan" varchar,
  	"maghrib_iqamah" varchar,
  	"isha_adhan" varchar,
  	"isha_iqamah" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "prayer_schedules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"iqamah_rules_fajr_mode" "enum_prayer_schedules_iqamah_rules_fajr_mode" DEFAULT 'absolute' NOT NULL,
  	"iqamah_rules_fajr_absolute_value" varchar,
  	"iqamah_rules_fajr_offset_minutes" numeric DEFAULT 15,
  	"iqamah_rules_zuhr_mode" "enum_prayer_schedules_iqamah_rules_zuhr_mode" DEFAULT 'absolute' NOT NULL,
  	"iqamah_rules_zuhr_absolute_value" varchar,
  	"iqamah_rules_zuhr_offset_minutes" numeric DEFAULT 15,
  	"iqamah_rules_asr_mode" "enum_prayer_schedules_iqamah_rules_asr_mode" DEFAULT 'absolute' NOT NULL,
  	"iqamah_rules_asr_absolute_value" varchar,
  	"iqamah_rules_asr_offset_minutes" numeric DEFAULT 15,
  	"iqamah_rules_maghrib_mode" "enum_prayer_schedules_iqamah_rules_maghrib_mode" DEFAULT 'offset' NOT NULL,
  	"iqamah_rules_maghrib_absolute_value" varchar,
  	"iqamah_rules_maghrib_offset_minutes" numeric DEFAULT 5,
  	"iqamah_rules_isha_mode" "enum_prayer_schedules_iqamah_rules_isha_mode" DEFAULT 'absolute' NOT NULL,
  	"iqamah_rules_isha_absolute_value" varchar,
  	"iqamah_rules_isha_offset_minutes" numeric DEFAULT 15,
  	"notes" varchar,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" jsonb,
  	"priority" "enum_announcements_priority" DEFAULT 'normal',
  	"active" boolean DEFAULT true,
  	"expires_at" timestamp(3) with time zone,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_announcements_status" DEFAULT 'draft'
  );
  
  CREATE TABLE IF NOT EXISTS "_announcements_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_body" jsonb,
  	"version_priority" "enum__announcements_v_version_priority" DEFAULT 'normal',
  	"version_active" boolean DEFAULT true,
  	"version_expires_at" timestamp(3) with time zone,
  	"version_tenant_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__announcements_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_services_status" DEFAULT 'draft'
  );
  
  CREATE TABLE IF NOT EXISTS "_services_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_description" varchar,
  	"version_icon" varchar,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_tenant_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__services_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"content" jsonb,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_content" jsonb,
  	"version_tenant_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE IF NOT EXISTS "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"tenants_id" integer,
  	"media_id" integer,
  	"events_id" integer,
  	"hero_slides_id" integer,
  	"prayer_schedules_id" integer,
  	"announcements_id" integer,
  	"services_id" integer,
  	"pages_id" integer,
  	"payload_jobs_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DO $$ BEGIN
   ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "tenants_custom_domains" ADD CONSTRAINT "tenants_custom_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "tenants_social_links" ADD CONSTRAINT "tenants_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "tenants" ADD CONSTRAINT "tenants_branding_logo_id_media_id_fk" FOREIGN KEY ("branding_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "tenants" ADD CONSTRAINT "tenants_branding_favicon_id_media_id_fk" FOREIGN KEY ("branding_favicon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "events_audience" ADD CONSTRAINT "events_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "events" ADD CONSTRAINT "events_flyer_image_id_media_id_fk" FOREIGN KEY ("flyer_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_events_v_version_audience" ADD CONSTRAINT "_events_v_version_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_flyer_image_id_media_id_fk" FOREIGN KEY ("version_flyer_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "hero_slides_ctas" ADD CONSTRAINT "hero_slides_ctas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."hero_slides"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_hero_slides_v_version_ctas" ADD CONSTRAINT "_hero_slides_v_version_ctas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_hero_slides_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_hero_slides_v" ADD CONSTRAINT "_hero_slides_v_parent_id_hero_slides_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."hero_slides"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_hero_slides_v" ADD CONSTRAINT "_hero_slides_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "prayer_schedules_jummah_times" ADD CONSTRAINT "prayer_schedules_jummah_times_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."prayer_schedules"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "prayer_schedules_days" ADD CONSTRAINT "prayer_schedules_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."prayer_schedules"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "prayer_schedules" ADD CONSTRAINT "prayer_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_parent_id_announcements_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."announcements"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_parent_id_services_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_hero_slides_fk" FOREIGN KEY ("hero_slides_id") REFERENCES "public"."hero_slides"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prayer_schedules_fk" FOREIGN KEY ("prayer_schedules_id") REFERENCES "public"."prayer_schedules"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_jobs_fk" FOREIGN KEY ("payload_jobs_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "tenants_custom_domains_order_idx" ON "tenants_custom_domains" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_custom_domains_parent_id_idx" ON "tenants_custom_domains" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_social_links_order_idx" ON "tenants_social_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_social_links_parent_id_idx" ON "tenants_social_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_idx" ON "tenants" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "tenants_branding_branding_logo_idx" ON "tenants" USING btree ("branding_logo_id");
  CREATE INDEX IF NOT EXISTS "tenants_branding_branding_favicon_idx" ON "tenants" USING btree ("branding_favicon_id");
  CREATE INDEX IF NOT EXISTS "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "media_tenant_idx" ON "media" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX IF NOT EXISTS "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX IF NOT EXISTS "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX IF NOT EXISTS "media_sizes_favicon_sizes_favicon_filename_idx" ON "media" USING btree ("sizes_favicon_filename");
  CREATE INDEX IF NOT EXISTS "events_audience_order_idx" ON "events_audience" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "events_audience_parent_idx" ON "events_audience" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "events_flyer_image_idx" ON "events" USING btree ("flyer_image_id");
  CREATE INDEX IF NOT EXISTS "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "events_tenant_idx" ON "events" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "events__status_idx" ON "events" USING btree ("_status");
  CREATE INDEX IF NOT EXISTS "_events_v_version_audience_order_idx" ON "_events_v_version_audience" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "_events_v_version_audience_parent_idx" ON "_events_v_version_audience" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_events_v_version_version_flyer_image_idx" ON "_events_v" USING btree ("version_flyer_image_id");
  CREATE INDEX IF NOT EXISTS "_events_v_version_version_slug_idx" ON "_events_v" USING btree ("version_slug");
  CREATE INDEX IF NOT EXISTS "_events_v_version_version_tenant_idx" ON "_events_v" USING btree ("version_tenant_id");
  CREATE INDEX IF NOT EXISTS "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX IF NOT EXISTS "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX IF NOT EXISTS "_events_v_version_version__status_idx" ON "_events_v" USING btree ("version__status");
  CREATE INDEX IF NOT EXISTS "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "_events_v_latest_idx" ON "_events_v" USING btree ("latest");
  CREATE INDEX IF NOT EXISTS "hero_slides_ctas_order_idx" ON "hero_slides_ctas" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "hero_slides_ctas_parent_id_idx" ON "hero_slides_ctas" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "hero_slides_tenant_idx" ON "hero_slides" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "hero_slides_updated_at_idx" ON "hero_slides" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "hero_slides_created_at_idx" ON "hero_slides" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "hero_slides__status_idx" ON "hero_slides" USING btree ("_status");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_ctas_order_idx" ON "_hero_slides_v_version_ctas" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_ctas_parent_id_idx" ON "_hero_slides_v_version_ctas" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_parent_idx" ON "_hero_slides_v" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_version_tenant_idx" ON "_hero_slides_v" USING btree ("version_tenant_id");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_version_updated_at_idx" ON "_hero_slides_v" USING btree ("version_updated_at");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_version_created_at_idx" ON "_hero_slides_v" USING btree ("version_created_at");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_version_version__status_idx" ON "_hero_slides_v" USING btree ("version__status");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_created_at_idx" ON "_hero_slides_v" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_updated_at_idx" ON "_hero_slides_v" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "_hero_slides_v_latest_idx" ON "_hero_slides_v" USING btree ("latest");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_jummah_times_order_idx" ON "prayer_schedules_jummah_times" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_jummah_times_parent_id_idx" ON "prayer_schedules_jummah_times" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_days_order_idx" ON "prayer_schedules_days" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_days_parent_id_idx" ON "prayer_schedules_days" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_start_date_idx" ON "prayer_schedules" USING btree ("start_date");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_end_date_idx" ON "prayer_schedules" USING btree ("end_date");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_tenant_idx" ON "prayer_schedules" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_updated_at_idx" ON "prayer_schedules" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "prayer_schedules_created_at_idx" ON "prayer_schedules" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "announcements_tenant_idx" ON "announcements" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "announcements_updated_at_idx" ON "announcements" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "announcements_created_at_idx" ON "announcements" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "announcements__status_idx" ON "announcements" USING btree ("_status");
  CREATE INDEX IF NOT EXISTS "_announcements_v_parent_idx" ON "_announcements_v" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_announcements_v_version_version_tenant_idx" ON "_announcements_v" USING btree ("version_tenant_id");
  CREATE INDEX IF NOT EXISTS "_announcements_v_version_version_updated_at_idx" ON "_announcements_v" USING btree ("version_updated_at");
  CREATE INDEX IF NOT EXISTS "_announcements_v_version_version_created_at_idx" ON "_announcements_v" USING btree ("version_created_at");
  CREATE INDEX IF NOT EXISTS "_announcements_v_version_version__status_idx" ON "_announcements_v" USING btree ("version__status");
  CREATE INDEX IF NOT EXISTS "_announcements_v_created_at_idx" ON "_announcements_v" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "_announcements_v_updated_at_idx" ON "_announcements_v" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "_announcements_v_latest_idx" ON "_announcements_v" USING btree ("latest");
  CREATE INDEX IF NOT EXISTS "services_tenant_idx" ON "services" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "services_updated_at_idx" ON "services" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "services_created_at_idx" ON "services" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "services__status_idx" ON "services" USING btree ("_status");
  CREATE INDEX IF NOT EXISTS "_services_v_parent_idx" ON "_services_v" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_services_v_version_version_tenant_idx" ON "_services_v" USING btree ("version_tenant_id");
  CREATE INDEX IF NOT EXISTS "_services_v_version_version_updated_at_idx" ON "_services_v" USING btree ("version_updated_at");
  CREATE INDEX IF NOT EXISTS "_services_v_version_version_created_at_idx" ON "_services_v" USING btree ("version_created_at");
  CREATE INDEX IF NOT EXISTS "_services_v_version_version__status_idx" ON "_services_v" USING btree ("version__status");
  CREATE INDEX IF NOT EXISTS "_services_v_created_at_idx" ON "_services_v" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "_services_v_updated_at_idx" ON "_services_v" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "_services_v_latest_idx" ON "_services_v" USING btree ("latest");
  CREATE INDEX IF NOT EXISTS "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "pages_tenant_idx" ON "pages" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX IF NOT EXISTS "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_version_tenant_idx" ON "_pages_v" USING btree ("version_tenant_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX IF NOT EXISTS "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX IF NOT EXISTS "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX IF NOT EXISTS "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX IF NOT EXISTS "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX IF NOT EXISTS "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX IF NOT EXISTS "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX IF NOT EXISTS "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX IF NOT EXISTS "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX IF NOT EXISTS "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_hero_slides_id_idx" ON "payload_locked_documents_rels" USING btree ("hero_slides_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_prayer_schedules_id_idx" ON "payload_locked_documents_rels" USING btree ("prayer_schedules_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("announcements_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_services_id_idx" ON "payload_locked_documents_rels" USING btree ("services_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_jobs_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users" CASCADE;
  DROP TABLE "tenants_custom_domains" CASCADE;
  DROP TABLE "tenants_social_links" CASCADE;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "events_audience" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "_events_v_version_audience" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "hero_slides_ctas" CASCADE;
  DROP TABLE "hero_slides" CASCADE;
  DROP TABLE "_hero_slides_v_version_ctas" CASCADE;
  DROP TABLE "_hero_slides_v" CASCADE;
  DROP TABLE "prayer_schedules_jummah_times" CASCADE;
  DROP TABLE "prayer_schedules_days" CASCADE;
  DROP TABLE "prayer_schedules" CASCADE;
  DROP TABLE "announcements" CASCADE;
  DROP TABLE "_announcements_v" CASCADE;
  DROP TABLE "services" CASCADE;
  DROP TABLE "_services_v" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_tenants_social_links_platform";
  DROP TYPE "public"."enum_tenants_site_type";
  DROP TYPE "public"."enum_tenants_branding_display_font";
  DROP TYPE "public"."enum_tenants_prayer_calc_method";
  DROP TYPE "public"."enum_tenants_prayer_calc_asr_madhab";
  DROP TYPE "public"."enum_tenants_donation_config_mode";
  DROP TYPE "public"."enum_events_audience";
  DROP TYPE "public"."enum_events_tag";
  DROP TYPE "public"."enum_events_display_mode";
  DROP TYPE "public"."enum_events_template_variant";
  DROP TYPE "public"."enum_events_hero_accent";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum__events_v_version_audience";
  DROP TYPE "public"."enum__events_v_version_tag";
  DROP TYPE "public"."enum__events_v_version_display_mode";
  DROP TYPE "public"."enum__events_v_version_template_variant";
  DROP TYPE "public"."enum__events_v_version_hero_accent";
  DROP TYPE "public"."enum__events_v_version_status";
  DROP TYPE "public"."enum_hero_slides_ctas_link_type";
  DROP TYPE "public"."enum_hero_slides_ctas_page";
  DROP TYPE "public"."enum_hero_slides_accent";
  DROP TYPE "public"."enum_hero_slides_status";
  DROP TYPE "public"."enum__hero_slides_v_version_ctas_link_type";
  DROP TYPE "public"."enum__hero_slides_v_version_ctas_page";
  DROP TYPE "public"."enum__hero_slides_v_version_accent";
  DROP TYPE "public"."enum__hero_slides_v_version_status";
  DROP TYPE "public"."enum_prayer_schedules_iqamah_rules_fajr_mode";
  DROP TYPE "public"."enum_prayer_schedules_iqamah_rules_zuhr_mode";
  DROP TYPE "public"."enum_prayer_schedules_iqamah_rules_asr_mode";
  DROP TYPE "public"."enum_prayer_schedules_iqamah_rules_maghrib_mode";
  DROP TYPE "public"."enum_prayer_schedules_iqamah_rules_isha_mode";
  DROP TYPE "public"."enum_announcements_priority";
  DROP TYPE "public"."enum_announcements_status";
  DROP TYPE "public"."enum__announcements_v_version_priority";
  DROP TYPE "public"."enum__announcements_v_version_status";
  DROP TYPE "public"."enum_services_status";
  DROP TYPE "public"."enum__services_v_version_status";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
