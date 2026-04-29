import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add lifecycle + signup-capture fields to tenants for the public signup flow:
 *  - status: 'pending' | 'active' (defaults to 'pending'; flipped to 'active'
 *    on first successful login; existing rows are backfilled to 'active')
 *  - trial_ends_at: recorded at signup, not enforced yet
 *  - signup_metadata: free-form jsonb blob (role, migration source, etc.)
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_tenants_status" AS ENUM('pending', 'active');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" "public"."enum_tenants_status" DEFAULT 'pending';
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp(3) with time zone;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "signup_metadata" jsonb;

    UPDATE "tenants" SET "status" = 'active' WHERE "status" IS NULL OR "status" = 'pending';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "signup_metadata";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "trial_ends_at";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "status";
    DROP TYPE IF EXISTS "public"."enum_tenants_status";
  `)
}
