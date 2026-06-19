import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_payment_payment_model" AS ENUM('free', 'one-time', 'monthly');
  CREATE TYPE "public"."enum_terms_pricing_model" AS ENUM('per-program', 'per-class');
  CREATE TABLE "forms_payment_multi_child_discount" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rank" numeric NOT NULL,
  	"percent_off" numeric NOT NULL
  );
  
  ALTER TABLE "forms" ADD COLUMN "payment_payment_model" "enum_forms_payment_payment_model" DEFAULT 'free';
  ALTER TABLE "terms" ADD COLUMN "pricing_model" "enum_terms_pricing_model" DEFAULT 'per-program';
  ALTER TABLE "terms" ADD COLUMN "tuition_cents" numeric;
  ALTER TABLE "school_classes" ADD COLUMN "tuition_cents" numeric;
  ALTER TABLE "forms_payment_multi_child_discount" ADD CONSTRAINT "forms_payment_multi_child_discount_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "forms_payment_multi_child_discount_order_idx" ON "forms_payment_multi_child_discount" USING btree ("_order");
  CREATE INDEX "forms_payment_multi_child_discount_parent_id_idx" ON "forms_payment_multi_child_discount" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "forms_payment_multi_child_discount" CASCADE;
  ALTER TABLE "forms" DROP COLUMN "payment_payment_model";
  ALTER TABLE "terms" DROP COLUMN "pricing_model";
  ALTER TABLE "terms" DROP COLUMN "tuition_cents";
  ALTER TABLE "school_classes" DROP COLUMN "tuition_cents";
  DROP TYPE "public"."enum_forms_payment_payment_model";
  DROP TYPE "public"."enum_terms_pricing_model";`)
}
