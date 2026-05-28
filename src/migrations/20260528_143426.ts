import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_api_scopes" AS ENUM('prayer-times:read', 'prayer-times:write');
  CREATE TABLE "users_api_scopes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_api_scopes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "enable_a_p_i_key" boolean;
  ALTER TABLE "users" ADD COLUMN "api_key" varchar;
  ALTER TABLE "users" ADD COLUMN "api_key_index" varchar;
  ALTER TABLE "users_api_scopes" ADD CONSTRAINT "users_api_scopes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_api_scopes_order_idx" ON "users_api_scopes" USING btree ("order");
  CREATE INDEX "users_api_scopes_parent_idx" ON "users_api_scopes" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_api_scopes" CASCADE;
  ALTER TABLE "users" DROP COLUMN "enable_a_p_i_key";
  ALTER TABLE "users" DROP COLUMN "api_key";
  ALTER TABLE "users" DROP COLUMN "api_key_index";
  DROP TYPE "public"."enum_users_api_scopes";`)
}
