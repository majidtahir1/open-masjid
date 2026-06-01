import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Expand the enum via the text-swap pattern (matches
  // 20260514_204832_expand_background_theme_enum) rather than `ALTER TYPE
  // ... ADD VALUE`, which Postgres restricts inside the transaction Payload
  // wraps migrations in. Existing 'prayer-times:*' rows cast cleanly into the
  // recreated type. Keep the value list in sync with Users.apiScopes options.
  await db.execute(sql`
   ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_api_scopes";
  CREATE TYPE "public"."enum_users_api_scopes" AS ENUM('prayer-times:read', 'prayer-times:write', 'announcements:read', 'announcements:write', 'forms:read', 'forms:write', 'events:read', 'events:write', 'members:read');
  ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_api_scopes" USING "value"::"public"."enum_users_api_scopes";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_api_scopes";
  CREATE TYPE "public"."enum_users_api_scopes" AS ENUM('prayer-times:read', 'prayer-times:write');
  ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_api_scopes" USING "value"::"public"."enum_users_api_scopes";`)
}
