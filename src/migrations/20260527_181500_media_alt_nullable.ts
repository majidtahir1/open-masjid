import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // `media.alt` was created NOT NULL by the initial migration (when `alt` was a
  // required field). The field is now optional ("leave blank for purely
  // decorative images"), so Payload sends null when alt is empty — but prod
  // still has the NOT NULL constraint, which makes every alt-less upload fail.
  // Drop it to match the field config. Idempotent: DROP NOT NULL on a column
  // that is already nullable is a no-op, so this is safe on any environment.
  await db.execute(sql`ALTER TABLE "media" ALTER COLUMN "alt" DROP NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Best-effort reinstatement. Will fail if any media row has a null alt — that
  // is expected, since allowing nulls is the whole point of the up migration.
  await db.execute(sql`ALTER TABLE "media" ALTER COLUMN "alt" SET NOT NULL;`)
}
