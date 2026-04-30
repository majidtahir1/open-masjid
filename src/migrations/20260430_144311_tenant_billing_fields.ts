import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add Stripe billing fields to the Tenants collection and expand the
 * tenants.status enum to cover the full subscription lifecycle.
 *
 * Adds:
 *  - tenants.subscription_plan      (enum monthly/annual/grandfathered, nullable)
 *  - tenants.stripe_customer_id     (varchar, nullable)
 *  - tenants.stripe_subscription_id (varchar, nullable)
 *  - tenants.current_period_end     (timestamp, nullable)
 *  - tenants.grace_period_ends_at   (timestamp, nullable)
 *
 * Extends:
 *  - enum_tenants_status: adds trialing, past_due, canceled, offline, grandfathered
 *
 * Grandfathering of existing tenants happens in the NEXT migration
 * (20260430_152000_grandfather_existing_tenants) — Postgres forbids using a
 * newly-added enum value within the same transaction that ALTER TYPE'd it
 * (55P04 "unsafe use of new value"), so the UPDATE has to live in its own
 * migration that runs after this one's transaction commits.
 *
 * No enforcement is wired up in either migration — that lands in later tasks.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_status" ADD VALUE IF NOT EXISTS 'trialing';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_status" ADD VALUE IF NOT EXISTS 'active';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_status" ADD VALUE IF NOT EXISTS 'past_due';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_status" ADD VALUE IF NOT EXISTS 'canceled';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_status" ADD VALUE IF NOT EXISTS 'offline';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TYPE "public"."enum_tenants_status" ADD VALUE IF NOT EXISTS 'grandfathered';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_subscription_plan" AS ENUM('monthly', 'annual', 'grandfathered');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscription_plan"      "public"."enum_tenants_subscription_plan";
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripe_customer_id"     varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "current_period_end"     timestamp(3) with time zone;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "grace_period_ends_at"   timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Note: the grandfather UPDATE is reverted by the down() of the next
  // migration (20260430_152000_grandfather_existing_tenants). By the time
  // we get here, no rows reference the new columns or the new enum values.
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "grace_period_ends_at";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "current_period_end";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripe_subscription_id";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripe_customer_id";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "subscription_plan";

    DROP TYPE IF EXISTS "public"."enum_tenants_subscription_plan";
    -- Note: enum_tenants_status values added in up() are not removed in down()
    -- because Postgres doesn't support dropping enum values without recreating
    -- the type. This is acceptable for a down-migration.
  `)
}
