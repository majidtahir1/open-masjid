import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_attendance_records_check_in_by" AS ENUM('kiosk', 'staff');
  ALTER TABLE "attendance_records" ADD COLUMN "check_in_at" timestamp(3) with time zone;
  ALTER TABLE "attendance_records" ADD COLUMN "check_out_at" timestamp(3) with time zone;
  ALTER TABLE "attendance_records" ADD COLUMN "check_in_by" "enum_attendance_records_check_in_by";
  ALTER TABLE "tenants" ADD COLUMN "checkin_kiosk_pin" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "attendance_records" DROP COLUMN "check_in_at";
  ALTER TABLE "attendance_records" DROP COLUMN "check_out_at";
  ALTER TABLE "attendance_records" DROP COLUMN "check_in_by";
  ALTER TABLE "tenants" DROP COLUMN "checkin_kiosk_pin";
  DROP TYPE "public"."enum_attendance_records_check_in_by";`)
}
