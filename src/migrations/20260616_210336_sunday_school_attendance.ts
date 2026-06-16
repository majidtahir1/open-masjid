import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_terms_meeting_day" AS ENUM('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');
  CREATE TYPE "public"."enum_terms_status" AS ENUM('active', 'archived');
  CREATE TYPE "public"."enum_students_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('active', 'withdrawn');
  CREATE TYPE "public"."enum_class_sessions_status" AS ENUM('scheduled', 'held', 'cancelled');
  CREATE TYPE "public"."enum_attendance_records_status" AS ENUM('present', 'absent', 'late', 'excused');
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'school_admin';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'teacher';
  CREATE TABLE "terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"meeting_day" "enum_terms_meeting_day" DEFAULT 'sunday' NOT NULL,
  	"status" "enum_terms_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "school_classes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"term_id" integer NOT NULL,
  	"grade_level" varchar,
  	"room" varchar,
  	"capacity" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "school_classes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "students_guardians" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"relationship" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"is_primary" boolean DEFAULT false
  );
  
  CREATE TABLE "students" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"full_name" varchar,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"age" numeric,
  	"grade_level" varchar,
  	"allergies_notes" varchar,
  	"emergency_contact" varchar,
  	"member_id" integer,
  	"status" "enum_students_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"student_id" integer NOT NULL,
  	"class_id" integer NOT NULL,
  	"status" "enum_enrollments_status" DEFAULT 'active' NOT NULL,
  	"enrolled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "class_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"class_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"status" "enum_class_sessions_status" DEFAULT 'scheduled' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "attendance_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"session_id" integer NOT NULL,
  	"student_id" integer NOT NULL,
  	"status" "enum_attendance_records_status" NOT NULL,
  	"marked_by_id" integer,
  	"marked_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "terms_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "school_classes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "students_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enrollments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "class_sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "attendance_records_id" integer;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "school_classes_rels" ADD CONSTRAINT "school_classes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."school_classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "school_classes_rels" ADD CONSTRAINT "school_classes_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "students_guardians" ADD CONSTRAINT "students_guardians_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "students" ADD CONSTRAINT "students_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_school_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."school_classes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_id_school_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."school_classes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_id_users_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "terms_tenant_idx" ON "terms" USING btree ("tenant_id");
  CREATE INDEX "terms_updated_at_idx" ON "terms" USING btree ("updated_at");
  CREATE INDEX "terms_created_at_idx" ON "terms" USING btree ("created_at");
  CREATE INDEX "school_classes_tenant_idx" ON "school_classes" USING btree ("tenant_id");
  CREATE INDEX "school_classes_term_idx" ON "school_classes" USING btree ("term_id");
  CREATE INDEX "school_classes_updated_at_idx" ON "school_classes" USING btree ("updated_at");
  CREATE INDEX "school_classes_created_at_idx" ON "school_classes" USING btree ("created_at");
  CREATE INDEX "school_classes_rels_order_idx" ON "school_classes_rels" USING btree ("order");
  CREATE INDEX "school_classes_rels_parent_idx" ON "school_classes_rels" USING btree ("parent_id");
  CREATE INDEX "school_classes_rels_path_idx" ON "school_classes_rels" USING btree ("path");
  CREATE INDEX "school_classes_rels_users_id_idx" ON "school_classes_rels" USING btree ("users_id");
  CREATE INDEX "students_guardians_order_idx" ON "students_guardians" USING btree ("_order");
  CREATE INDEX "students_guardians_parent_id_idx" ON "students_guardians" USING btree ("_parent_id");
  CREATE INDEX "students_tenant_idx" ON "students" USING btree ("tenant_id");
  CREATE INDEX "students_member_idx" ON "students" USING btree ("member_id");
  CREATE INDEX "students_updated_at_idx" ON "students" USING btree ("updated_at");
  CREATE INDEX "students_created_at_idx" ON "students" USING btree ("created_at");
  CREATE INDEX "enrollments_tenant_idx" ON "enrollments" USING btree ("tenant_id");
  CREATE INDEX "enrollments_student_idx" ON "enrollments" USING btree ("student_id");
  CREATE INDEX "enrollments_class_idx" ON "enrollments" USING btree ("class_id");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_student_class_idx" ON "enrollments" USING btree ("tenant_id","student_id","class_id");
  CREATE INDEX "class_sessions_tenant_idx" ON "class_sessions" USING btree ("tenant_id");
  CREATE INDEX "class_sessions_class_idx" ON "class_sessions" USING btree ("class_id");
  CREATE INDEX "class_sessions_date_idx" ON "class_sessions" USING btree ("date");
  CREATE INDEX "class_sessions_updated_at_idx" ON "class_sessions" USING btree ("updated_at");
  CREATE INDEX "class_sessions_created_at_idx" ON "class_sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_class_date_idx" ON "class_sessions" USING btree ("tenant_id","class_id","date");
  CREATE INDEX "attendance_records_tenant_idx" ON "attendance_records" USING btree ("tenant_id");
  CREATE INDEX "attendance_records_session_idx" ON "attendance_records" USING btree ("session_id");
  CREATE INDEX "attendance_records_student_idx" ON "attendance_records" USING btree ("student_id");
  CREATE INDEX "attendance_records_marked_by_idx" ON "attendance_records" USING btree ("marked_by_id");
  CREATE INDEX "attendance_records_updated_at_idx" ON "attendance_records" USING btree ("updated_at");
  CREATE INDEX "attendance_records_created_at_idx" ON "attendance_records" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_session_student_idx" ON "attendance_records" USING btree ("tenant_id","session_id","student_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_school_classes_fk" FOREIGN KEY ("school_classes_id") REFERENCES "public"."school_classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_students_fk" FOREIGN KEY ("students_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_class_sessions_fk" FOREIGN KEY ("class_sessions_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attendance_records_fk" FOREIGN KEY ("attendance_records_id") REFERENCES "public"."attendance_records"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("terms_id");
  CREATE INDEX "payload_locked_documents_rels_school_classes_id_idx" ON "payload_locked_documents_rels" USING btree ("school_classes_id");
  CREATE INDEX "payload_locked_documents_rels_students_id_idx" ON "payload_locked_documents_rels" USING btree ("students_id");
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_class_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("class_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_attendance_records_id_idx" ON "payload_locked_documents_rels" USING btree ("attendance_records_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "school_classes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "school_classes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "students_guardians" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "students" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enrollments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "attendance_records" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "terms" CASCADE;
  DROP TABLE "school_classes" CASCADE;
  DROP TABLE "school_classes_rels" CASCADE;
  DROP TABLE "students_guardians" CASCADE;
  DROP TABLE "students" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  DROP TABLE "class_sessions" CASCADE;
  DROP TABLE "attendance_records" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_terms_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_school_classes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_students_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_enrollments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_class_sessions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_attendance_records_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('platformOwner', 'admin', 'staff', 'kioskManager');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "payload_locked_documents_rels_terms_id_idx";
  DROP INDEX "payload_locked_documents_rels_school_classes_id_idx";
  DROP INDEX "payload_locked_documents_rels_students_id_idx";
  DROP INDEX "payload_locked_documents_rels_enrollments_id_idx";
  DROP INDEX "payload_locked_documents_rels_class_sessions_id_idx";
  DROP INDEX "payload_locked_documents_rels_attendance_records_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "terms_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "school_classes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "students_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "enrollments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "class_sessions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "attendance_records_id";
  DROP TYPE "public"."enum_terms_meeting_day";
  DROP TYPE "public"."enum_terms_status";
  DROP TYPE "public"."enum_students_status";
  DROP TYPE "public"."enum_enrollments_status";
  DROP TYPE "public"."enum_class_sessions_status";
  DROP TYPE "public"."enum_attendance_records_status";`)
}
