import React from 'react'

/**
 * Hides the row-selection column on the Forms list view.
 *
 * With no way to select rows, Payload's list-view bulk "Delete" toolbar never
 * appears — so deleting a form is funneled through the form's own page, where
 * the count-aware confirmation lives (see `DeleteFormMenuItem` +
 * `cascadeDeleteFormSubmissions`). Payload exposes no per-collection flag to
 * disable bulk delete, and its bulk-delete confirmation text is a global
 * translation shared by every collection, so it can't be made form-specific.
 *
 * Registered only on the Forms list (`admin.components.beforeListTable`), and
 * the CSS is scoped to `.collection-list--forms`, so nothing else is affected.
 * The selection column's header is `#heading-_select` and its body cells are
 * `.cell-_select` (accessor `_select`).
 */
export default function HideFormsBulkSelect() {
  return (
    <style>{`
      .collection-list--forms #heading-_select,
      .collection-list--forms .cell-_select { display: none; }
    `}</style>
  )
}
