import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Text-swap (matches 20260601_205903_media_api_scopes) rather than
  // `ALTER TYPE ... ADD VALUE`, which Postgres restricts inside the
  // transaction Payload wraps migrations in. Keep the value list in sync with
  // Users.apiScopes options. Adds blog:read / blog:write for the Minbar
  // draft-agent permission.
  await db.execute(sql`
   ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_api_scopes";
  CREATE TYPE "public"."enum_users_api_scopes" AS ENUM('prayer-times:read', 'prayer-times:write', 'announcements:read', 'announcements:write', 'forms:read', 'forms:write', 'events:read', 'events:write', 'members:read', 'media:read', 'media:write', 'blog:read', 'blog:write');
  ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_api_scopes" USING "value"::"public"."enum_users_api_scopes";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_api_scopes";
  CREATE TYPE "public"."enum_users_api_scopes" AS ENUM('prayer-times:read', 'prayer-times:write', 'announcements:read', 'announcements:write', 'forms:read', 'forms:write', 'events:read', 'events:write', 'members:read', 'media:read', 'media:write');
  ALTER TABLE "users_api_scopes" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_api_scopes" USING "value"::"public"."enum_users_api_scopes";`)
}
