import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ansari_settings_disabled_rules" AS ENUM('prayer.coverage_gap', 'prayer.iqamah_drift', 'calendar.dst', 'calendar.ramadan', 'forms.capacity', 'announcements.expiring', 'events.low_rsvp', 'events.missing_flyer', 'digest.weekly');
  CREATE TYPE "public"."enum_ansari_settings_digest_day" AS ENUM('0', '1', '2', '3', '4', '5', '6');
  CREATE TYPE "public"."enum_nudge_states_tier" AS ENUM('immediate', 'digest');
  CREATE TYPE "public"."enum_nudge_states_status" AS ENUM('emitted', 'delivered', 'applied', 'dismissed', 'snoozed', 'resolved');
  ALTER TYPE "public"."enum_users_api_scopes" ADD VALUE 'ansari:nudges' BEFORE 'media:read';
  CREATE TABLE "ansari_settings_disabled_rules" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_ansari_settings_disabled_rules",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "ansari_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"quiet_hours_start" numeric DEFAULT 21,
  	"quiet_hours_end" numeric DEFAULT 8,
  	"digest_day" "enum_ansari_settings_digest_day" DEFAULT '0',
  	"digest_hour" numeric DEFAULT 9,
  	"telegram_connected" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "nudge_states" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"rule" varchar NOT NULL,
  	"dedup_key" varchar NOT NULL,
  	"tier" "enum_nudge_states_tier" NOT NULL,
  	"status" "enum_nudge_states_status" DEFAULT 'emitted' NOT NULL,
  	"intent" jsonb,
  	"action" jsonb,
  	"emitted_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"snoozed_at" timestamp(3) with time zone,
  	"resolved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "prayer_schedules" ADD COLUMN "iqamah_rules_fajr_gap_at_creation" numeric;
  ALTER TABLE "prayer_schedules" ADD COLUMN "iqamah_rules_zuhr_gap_at_creation" numeric;
  ALTER TABLE "prayer_schedules" ADD COLUMN "iqamah_rules_asr_gap_at_creation" numeric;
  ALTER TABLE "prayer_schedules" ADD COLUMN "iqamah_rules_maghrib_gap_at_creation" numeric;
  ALTER TABLE "prayer_schedules" ADD COLUMN "iqamah_rules_isha_gap_at_creation" numeric;
  ALTER TABLE "events" ADD COLUMN "signup_form_id" integer;
  ALTER TABLE "_events_v" ADD COLUMN "version_signup_form_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ansari_settings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "nudge_states_id" integer;
  ALTER TABLE "ansari_settings_disabled_rules" ADD CONSTRAINT "ansari_settings_disabled_rules_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ansari_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ansari_settings" ADD CONSTRAINT "ansari_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nudge_states" ADD CONSTRAINT "nudge_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ansari_settings_disabled_rules_order_idx" ON "ansari_settings_disabled_rules" USING btree ("order");
  CREATE INDEX "ansari_settings_disabled_rules_parent_idx" ON "ansari_settings_disabled_rules" USING btree ("parent_id");
  CREATE UNIQUE INDEX "ansari_settings_tenant_idx" ON "ansari_settings" USING btree ("tenant_id");
  CREATE INDEX "ansari_settings_updated_at_idx" ON "ansari_settings" USING btree ("updated_at");
  CREATE INDEX "ansari_settings_created_at_idx" ON "ansari_settings" USING btree ("created_at");
  CREATE INDEX "nudge_states_tenant_idx" ON "nudge_states" USING btree ("tenant_id");
  CREATE INDEX "nudge_states_rule_idx" ON "nudge_states" USING btree ("rule");
  CREATE INDEX "nudge_states_dedup_key_idx" ON "nudge_states" USING btree ("dedup_key");
  CREATE INDEX "nudge_states_status_idx" ON "nudge_states" USING btree ("status");
  CREATE INDEX "nudge_states_updated_at_idx" ON "nudge_states" USING btree ("updated_at");
  CREATE INDEX "nudge_states_created_at_idx" ON "nudge_states" USING btree ("created_at");
  ALTER TABLE "events" ADD CONSTRAINT "events_signup_form_id_forms_id_fk" FOREIGN KEY ("signup_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_signup_form_id_forms_id_fk" FOREIGN KEY ("version_signup_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ansari_settings_fk" FOREIGN KEY ("ansari_settings_id") REFERENCES "public"."ansari_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_nudge_states_fk" FOREIGN KEY ("nudge_states_id") REFERENCES "public"."nudge_states"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "events_signup_form_idx" ON "events" USING btree ("signup_form_id");
  CREATE INDEX "_events_v_version_version_signup_form_idx" ON "_events_v" USING btree ("version_signup_form_id");
  CREATE INDEX "payload_locked_documents_rels_ansari_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("ansari_settings_id");
  CREATE INDEX "payload_locked_documents_rels_nudge_states_id_idx" ON "payload_locked_documents_rels" USING btree ("nudge_states_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ansari_settings_disabled_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ansari_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "nudge_states" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ansari_settings_disabled_rules" CASCADE;
  DROP TABLE "ansari_settings" CASCADE;
  DROP TABLE "nudge_states" CASCADE;
  ALTER TABLE "events" DROP CONSTRAINT "events_signup_form_id_forms_id_fk";
  
  ALTER TABLE "_events_v" DROP CONSTRAINT "_events_v_version_signup_form_id_forms_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ansari_settings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_nudge_states_fk";
  
  ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_api_scopes";
  CREATE TYPE "public"."enum_users_api_scopes" AS ENUM('prayer-times:read', 'prayer-times:write', 'announcements:read', 'announcements:write', 'forms:read', 'forms:write', 'events:read', 'events:write', 'members:read', 'media:read', 'media:write', 'blog:read', 'blog:write');
  ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_api_scopes" USING "value"::"public"."enum_users_api_scopes";
  DROP INDEX "events_signup_form_idx";
  DROP INDEX "_events_v_version_version_signup_form_idx";
  DROP INDEX "payload_locked_documents_rels_ansari_settings_id_idx";
  DROP INDEX "payload_locked_documents_rels_nudge_states_id_idx";
  ALTER TABLE "prayer_schedules" DROP COLUMN "iqamah_rules_fajr_gap_at_creation";
  ALTER TABLE "prayer_schedules" DROP COLUMN "iqamah_rules_zuhr_gap_at_creation";
  ALTER TABLE "prayer_schedules" DROP COLUMN "iqamah_rules_asr_gap_at_creation";
  ALTER TABLE "prayer_schedules" DROP COLUMN "iqamah_rules_maghrib_gap_at_creation";
  ALTER TABLE "prayer_schedules" DROP COLUMN "iqamah_rules_isha_gap_at_creation";
  ALTER TABLE "events" DROP COLUMN "signup_form_id";
  ALTER TABLE "_events_v" DROP COLUMN "version_signup_form_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ansari_settings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "nudge_states_id";
  DROP TYPE "public"."enum_ansari_settings_disabled_rules";
  DROP TYPE "public"."enum_ansari_settings_digest_day";
  DROP TYPE "public"."enum_nudge_states_tier";
  DROP TYPE "public"."enum_nudge_states_status";`)
}
