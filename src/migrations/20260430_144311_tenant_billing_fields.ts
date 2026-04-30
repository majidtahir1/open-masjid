import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add Stripe billing fields to the Tenants collection and expand the
 * tenants.status enum to cover the full subscription lifecycle.
 *
 * Existing tenants are grandfathered (status='grandfathered',
 * subscription_plan='grandfathered') so they are never billed/enforced.
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
 * No enforcement is wired up in this migration — that lands in later tasks.
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

  // Grandfather any pre-billing tenants so they are never enforced.
  await db.execute(sql`
    UPDATE "tenants"
    SET "status" = 'grandfathered',
        "subscription_plan" = 'grandfathered'
    WHERE "status" IN ('pending', 'active');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert grandfathered rows back to 'active' before dropping new columns.
  await db.execute(sql`
    UPDATE "tenants" SET "status" = 'active' WHERE "status" = 'grandfathered';
  `)

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
