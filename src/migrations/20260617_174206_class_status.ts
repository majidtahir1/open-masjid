import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_school_classes_status" AS ENUM('active', 'archived');
  ALTER TABLE "school_classes" ADD COLUMN "status" "enum_school_classes_status" DEFAULT 'active' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "school_classes" DROP COLUMN "status";
  DROP TYPE "public"."enum_school_classes_status";`)
}
