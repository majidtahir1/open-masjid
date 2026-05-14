import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_kiosks_status" AS ENUM('UNPAIRED', 'ONLINE', 'OFFLINE', 'MAINTENANCE');
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'kioskManager';
  CREATE TABLE "kiosks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"location" varchar,
  	"status" "enum_kiosks_status" DEFAULT 'UNPAIRED',
  	"pairing_code" varchar,
  	"device_id" varchar,
  	"secret_hash" varchar,
  	"pairing_code_expires_at" timestamp(3) with time zone,
  	"last_seen_at" timestamp(3) with time zone,
  	"last_seen_ip" varchar,
  	"user_agent" varchar,
  	"kiosk_push_at" timestamp(3) with time zone,
  	"override_enabled" boolean DEFAULT false,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tenants" ADD COLUMN "kiosk_broadcast_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "kiosks_id" integer;
  ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "kiosks_tenant_idx" ON "kiosks" USING btree ("tenant_id");
  CREATE INDEX "kiosks_updated_at_idx" ON "kiosks" USING btree ("updated_at");
  CREATE INDEX "kiosks_created_at_idx" ON "kiosks" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_kiosks_fk" FOREIGN KEY ("kiosks_id") REFERENCES "public"."kiosks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_kiosks_id_idx" ON "payload_locked_documents_rels" USING btree ("kiosks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "kiosks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "kiosks" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_kiosks_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('platformOwner', 'admin', 'staff');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "payload_locked_documents_rels_kiosks_id_idx";
  ALTER TABLE "tenants" DROP COLUMN "kiosk_broadcast_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "kiosks_id";
  DROP TYPE "public"."enum_kiosks_status";`)
}
