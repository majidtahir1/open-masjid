import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_terms_payment_model" AS ENUM('free', 'one-time', 'monthly');
  CREATE TYPE "public"."enum_terms_currency" AS ENUM('usd', 'cad', 'gbp');
  CREATE TABLE "terms_multi_child_discount" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rank" numeric,
  	"percent_off" numeric
  );
  
  DROP TABLE "forms_payment_multi_child_discount" CASCADE;
  ALTER TABLE "terms" ADD COLUMN "payment_model" "enum_terms_payment_model" DEFAULT 'free';
  ALTER TABLE "terms" ADD COLUMN "currency" "enum_terms_currency" DEFAULT 'usd';
  ALTER TABLE "terms_multi_child_discount" ADD CONSTRAINT "terms_multi_child_discount_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "terms_multi_child_discount_order_idx" ON "terms_multi_child_discount" USING btree ("_order");
  CREATE INDEX "terms_multi_child_discount_parent_id_idx" ON "terms_multi_child_discount" USING btree ("_parent_id");
  ALTER TABLE "forms" DROP COLUMN "payment_payment_model";
  DROP TYPE "public"."enum_forms_payment_payment_model";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_payment_payment_model" AS ENUM('free', 'one-time', 'monthly');
  CREATE TABLE "forms_payment_multi_child_discount" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rank" numeric NOT NULL,
  	"percent_off" numeric NOT NULL
  );
  
  DROP TABLE "terms_multi_child_discount" CASCADE;
  ALTER TABLE "forms" ADD COLUMN "payment_payment_model" "enum_forms_payment_payment_model" DEFAULT 'free';
  ALTER TABLE "forms_payment_multi_child_discount" ADD CONSTRAINT "forms_payment_multi_child_discount_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "forms_payment_multi_child_discount_order_idx" ON "forms_payment_multi_child_discount" USING btree ("_order");
  CREATE INDEX "forms_payment_multi_child_discount_parent_id_idx" ON "forms_payment_multi_child_discount" USING btree ("_parent_id");
  ALTER TABLE "terms" DROP COLUMN "payment_model";
  ALTER TABLE "terms" DROP COLUMN "currency";
  DROP TYPE "public"."enum_terms_payment_model";
  DROP TYPE "public"."enum_terms_currency";`)
}
