import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the onboarding-state columns that were introduced incrementally
 * during local dev (with PAYLOAD_DB_PUSH=true) but never captured in an
 * explicit migration. Production runs migrations only, so these columns
 * are missing from any DB that was bootstrapped after `20260425_initial`
 * and before this migration.
 *
 * Adds:
 *  - users.onboarding_welcome_seen_at  (timestamp, nullable)
 *  - tenants.onboarding_branding       (enum complete/dismissed, nullable)
 *  - tenants.onboarding_identity       (enum complete/dismissed, nullable)
 *  - tenants.onboarding_prayer         (enum complete/dismissed, nullable)
 *  - tenants.onboarding_first_event    (enum complete/dismissed, nullable)
 *  - tenants.onboarding_hero           (enum complete/dismissed, nullable)
 *  - tenants.onboarding_donations      (enum complete/dismissed, nullable)
 *  - tenants.onboarding_completed_at   (timestamp, nullable)
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_welcome_seen_at" timestamp(3) with time zone;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_onboarding_branding"     AS ENUM('complete', 'dismissed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_onboarding_identity"     AS ENUM('complete', 'dismissed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_onboarding_prayer"       AS ENUM('complete', 'dismissed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_onboarding_first_event"  AS ENUM('complete', 'dismissed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_onboarding_hero"         AS ENUM('complete', 'dismissed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_onboarding_donations"    AS ENUM('complete', 'dismissed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_branding"    "public"."enum_tenants_onboarding_branding";
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_identity"    "public"."enum_tenants_onboarding_identity";
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_prayer"      "public"."enum_tenants_onboarding_prayer";
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_first_event" "public"."enum_tenants_onboarding_first_event";
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_hero"        "public"."enum_tenants_onboarding_hero";
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_donations"   "public"."enum_tenants_onboarding_donations";
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboarding_completed_at";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboarding_donations";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboarding_hero";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboarding_first_event";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboarding_prayer";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboarding_identity";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboarding_branding";

    DROP TYPE IF EXISTS "public"."enum_tenants_onboarding_donations";
    DROP TYPE IF EXISTS "public"."enum_tenants_onboarding_hero";
    DROP TYPE IF EXISTS "public"."enum_tenants_onboarding_first_event";
    DROP TYPE IF EXISTS "public"."enum_tenants_onboarding_prayer";
    DROP TYPE IF EXISTS "public"."enum_tenants_onboarding_identity";
    DROP TYPE IF EXISTS "public"."enum_tenants_onboarding_branding";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "onboarding_welcome_seen_at";
  `)
}
