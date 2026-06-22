import type { CollectionBeforeDeleteHook } from 'payload'

/**
 * Permanently delete a form's submissions before the form row itself is removed.
 *
 * Why this is required (not just tidy): `form_submissions.form_id` is NOT NULL,
 * but its foreign key is ON DELETE SET NULL. Deleting a form with any submission
 * makes Postgres try to NULL those `form_id`s, which violates NOT NULL — the
 * statement fails, the whole delete transaction aborts, and every later
 * statement (down to Payload's own `payload_preferences` cleanup) errors with
 * "current transaction is aborted". So a form that ever received a submission
 * could not be deleted at all.
 *
 * `trash: true` includes soft-deleted submissions: a trashed row still carries
 * the form_id, so it would trip the same constraint if left behind.
 */
export const cascadeDeleteFormSubmissions: CollectionBeforeDeleteHook = async ({ req, id }) => {
  await req.payload.delete({
    collection: 'form-submissions',
    where: { form: { equals: id } },
    trash: true,
    overrideAccess: true,
    req,
  })
}
