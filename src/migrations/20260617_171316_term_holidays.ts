import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "terms_holidays" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"label" varchar
  );
  
  ALTER TABLE "terms_holidays" ADD CONSTRAINT "terms_holidays_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "terms_holidays_order_idx" ON "terms_holidays" USING btree ("_order");
  CREATE INDEX "terms_holidays_parent_id_idx" ON "terms_holidays" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "terms_holidays" CASCADE;`)
}
