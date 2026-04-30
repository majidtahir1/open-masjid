import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Grandfather every pre-billing tenant: set status='grandfathered' and
 * subscription_plan='grandfathered' so they are never billed or enforced.
 *
 * Separate from 20260430_144311_tenant_billing_fields because Postgres
 * forbids using a newly-added enum value within the same transaction that
 * ALTER TYPE'd it (55P04 "unsafe use of new value"). The previous
 * migration adds 'grandfathered' to enum_tenants_status; this one runs
 * in a fresh transaction after that commits, so it can use it.
 *
 * Idempotent: safe to re-run. Only updates rows still in the legacy
 * (pending|active) states.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants"
    SET "status" = 'grandfathered',
        "subscription_plan" = 'grandfathered'
    WHERE "status" IN ('pending', 'active');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants" SET "status" = 'active' WHERE "status" = 'grandfathered';
  `)
}
