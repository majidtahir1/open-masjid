-- Clone the ICP tenant's visible content into the demo tenant. Idempotent.
--
-- Approach: copy content rows with their integer ids offset by 100,000,000 so
-- the demo gets its own rows. Media is NOT copied (media.filename is globally
-- unique and the files live on disk); instead the demo's image foreign keys
-- point straight at ICP's existing media rows. That renders correctly because
-- media read access is public (`() => true`) and the public site populates
-- uploads with overrideAccess — so cross-tenant image refs display fine. (Demo
-- images therefore depend on ICP's media not being deleted — acceptable for a
-- demo whose content is sourced from ICP.) Child/array rows are re-parented to
-- the offset parent ids.
--
-- Drafts/versions: events, hero_slides, announcements and services have
-- `versions.drafts` enabled, so each has a companion `_<table>_v` history table.
-- The PUBLIC site reads the main table, but the ADMIN list resolves the latest
-- snapshot from `_<table>_v`. We therefore also insert a `latest = true` version
-- row per imported doc (mirroring the main row, with `version_*` columns and the
-- version-specific enum types) so the imported content is visible and editable
-- in the admin — not just on the website. Forms has no drafts (no version table).
--
-- Membership tiers and donation funds are
-- intentionally NOT touched (the demo owns those; they drive the test-Stripe
-- checkout loop). PII (members/donations/form-submissions/users) is never read.
--
-- Run (prod): docker compose -f docker-compose.prod.yml exec -T db \
--   psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - < scripts/import-icp-to-demo.sql
-- (or pipe this file into any psql session connected to the app database)
--
-- Re-runnable: it wipes the demo's content first, so running it again refreshes
-- the demo from ICP's current content.

DO $$
DECLARE
  v_icp  int    := (SELECT id FROM tenants WHERE slug = 'icp');
  v_demo int    := (SELECT id FROM tenants WHERE slug = 'demo');
  v_off  bigint := 100000000;
BEGIN
  IF v_icp  IS NULL THEN RAISE EXCEPTION 'No tenant with slug ''icp'''; END IF;
  IF v_demo IS NULL THEN RAISE EXCEPTION 'No tenant with slug ''demo'''; END IF;

  -- 1. Wipe the demo's existing content (array/child rows cascade via FK).
  --    Media is left untouched (we reference ICP's media rows, not copies).
  DELETE FROM events        WHERE tenant_id = v_demo;
  DELETE FROM hero_slides   WHERE tenant_id = v_demo;
  DELETE FROM forms         WHERE tenant_id = v_demo;
  DELETE FROM services      WHERE tenant_id = v_demo;
  DELETE FROM announcements WHERE tenant_id = v_demo;

  -- 1b. Wipe the demo's version rows too. The `_<table>_v.parent_id` FK is
  --     ON DELETE SET NULL, so deleting the main rows above orphans (rather than
  --     removes) their version rows; clear them explicitly by version_tenant_id.
  --     Child version arrays cascade from their parent version row.
  DELETE FROM "_events_v"        WHERE version_tenant_id = v_demo;
  DELETE FROM "_hero_slides_v"   WHERE version_tenant_id = v_demo;
  DELETE FROM "_services_v"      WHERE version_tenant_id = v_demo;
  DELETE FROM "_announcements_v" WHERE version_tenant_id = v_demo;

  -- 3. Services.
  INSERT INTO services (id, title, description, icon, sort_order, tenant_id, updated_at, created_at, _status)
  SELECT id + v_off, title, description, icon, sort_order, v_demo, updated_at, created_at, _status
  FROM services WHERE tenant_id = v_icp;

  -- 3b. Services version rows (latest snapshot) so admin lists/edits them.
  INSERT INTO "_services_v" (parent_id, version_title, version_description, version_icon, version_sort_order, version_tenant_id, version_updated_at, version_created_at, version__status, created_at, updated_at, latest)
  SELECT id, title, description, icon, sort_order, tenant_id, updated_at, created_at, _status::text::"enum__services_v_version_status", now(), now(), true
  FROM services WHERE tenant_id = v_demo;

  -- 4. Announcements.
  INSERT INTO announcements (id, title, body, priority, active, expires_at, tenant_id, updated_at, created_at, _status)
  SELECT id + v_off, title, body, priority, active, expires_at, v_demo, updated_at, created_at, _status
  FROM announcements WHERE tenant_id = v_icp;

  -- 4b. Announcements version rows (latest snapshot).
  INSERT INTO "_announcements_v" (parent_id, version_title, version_body, version_priority, version_active, version_expires_at, version_tenant_id, version_updated_at, version_created_at, version__status, created_at, updated_at, latest)
  SELECT id, title, body, priority::text::"enum__announcements_v_version_priority", active, expires_at, tenant_id, updated_at, created_at, _status::text::"enum__announcements_v_version_status", now(), now(), true
  FROM announcements WHERE tenant_id = v_demo;

  -- 5. Events (+ audience array). Remap flyer_image_id to the copied media.
  INSERT INTO events (id, title, short_description, description, tag, "when", start_date, end_date, location, address, contact, display_mode, flyer_image_id, template_variant, featured, hero_accent, slug, tenant_id, updated_at, created_at, _status)
  SELECT id + v_off, title, short_description, description, tag, "when", start_date, end_date, location, address, contact, display_mode,
    flyer_image_id,  -- reference ICP's media row directly (public read)
    template_variant, featured, hero_accent, slug, v_demo, updated_at, created_at, _status
  FROM events WHERE tenant_id = v_icp;

  INSERT INTO events_audience ("order", parent_id, value)
  SELECT "order", parent_id + v_off, value
  FROM events_audience WHERE parent_id IN (SELECT id FROM events WHERE tenant_id = v_icp);

  -- 5b. Events version rows (+ audience array) so admin lists/edits them.
  INSERT INTO "_events_v" (parent_id, version_title, version_short_description, version_description, version_tag, version_when, version_start_date, version_end_date, version_location, version_address, version_contact, version_display_mode, version_flyer_image_id, version_template_variant, version_featured, version_hero_accent, version_slug, version_tenant_id, version_updated_at, version_created_at, version__status, created_at, updated_at, latest)
  SELECT id, title, short_description, description,
    tag::text::"enum__events_v_version_tag", "when", start_date, end_date, location, address, contact,
    display_mode::text::"enum__events_v_version_display_mode", flyer_image_id,
    template_variant::text::"enum__events_v_version_template_variant", featured,
    hero_accent::text::"enum__events_v_version_hero_accent", slug, tenant_id, updated_at, created_at,
    _status::text::"enum__events_v_version_status", now(), now(), true
  FROM events WHERE tenant_id = v_demo;

  INSERT INTO "_events_v_version_audience" ("order", parent_id, value)
  SELECT a."order", v.id, a.value::text::"enum__events_v_version_audience"
  FROM events_audience a
  JOIN "_events_v" v ON v.parent_id = a.parent_id
  WHERE v.version_tenant_id = v_demo;

  -- 6. Hero slides (+ ctas array). Remap both image fields to copied media.
  INSERT INTO hero_slides (id, eyebrow, title, body, meta, accent, sort_order, active, tenant_id, updated_at, created_at, _status, style,
    split_fields_photo_label, split_fields_photo_tone, split_fields_card_tag, split_fields_card_title, split_fields_image_id,
    photo_fields_photo_label, photo_fields_photo_tone, photo_fields_image_id, photo_fields_ayah_arabic, photo_fields_ayah_translation, photo_fields_ayah_citation, photo_fields_photo_pattern,
    split_fields_custom_color, photo_fields_custom_color)
  SELECT id + v_off, eyebrow, title, body, meta, accent, sort_order, active, v_demo, updated_at, created_at, _status, style,
    split_fields_photo_label, split_fields_photo_tone, split_fields_card_tag, split_fields_card_title,
    split_fields_image_id,  -- reference ICP's media row directly
    photo_fields_photo_label, photo_fields_photo_tone,
    photo_fields_image_id,  -- reference ICP's media row directly
    photo_fields_ayah_arabic, photo_fields_ayah_translation, photo_fields_ayah_citation, photo_fields_photo_pattern,
    split_fields_custom_color, photo_fields_custom_color
  FROM hero_slides WHERE tenant_id = v_icp;

  INSERT INTO hero_slides_ctas (id, _order, _parent_id, label, link_type, page, url, icon, "primary")
  SELECT substr(md5(random()::text || clock_timestamp()::text || id), 1, 24), _order, _parent_id + v_off, label, link_type, page, url, icon, "primary"
  FROM hero_slides_ctas WHERE _parent_id IN (SELECT id FROM hero_slides WHERE tenant_id = v_icp);

  -- 6b. Hero slides version rows (+ ctas array) so admin lists/edits them.
  INSERT INTO "_hero_slides_v" (parent_id, version_eyebrow, version_title, version_body, version_meta, version_accent, version_sort_order, version_active, version_tenant_id, version__status, version_style,
    version_split_fields_photo_label, version_split_fields_photo_tone, version_split_fields_card_tag, version_split_fields_card_title, version_split_fields_image_id,
    version_photo_fields_photo_label, version_photo_fields_photo_tone, version_photo_fields_image_id, version_photo_fields_ayah_arabic, version_photo_fields_ayah_translation, version_photo_fields_ayah_citation, version_photo_fields_photo_pattern,
    version_split_fields_custom_color, version_photo_fields_custom_color, version_updated_at, version_created_at, created_at, updated_at, latest)
  SELECT id, eyebrow, title, body, meta, accent::text::"enum__hero_slides_v_version_accent", sort_order, active, tenant_id,
    _status::text::"enum__hero_slides_v_version_status", style::text::"enum__hero_slides_v_version_style",
    split_fields_photo_label, split_fields_photo_tone::text::"enum__hero_slides_v_version_split_fields_photo_tone", split_fields_card_tag, split_fields_card_title, split_fields_image_id,
    photo_fields_photo_label, photo_fields_photo_tone::text::"enum__hero_slides_v_version_photo_fields_photo_tone", photo_fields_image_id, photo_fields_ayah_arabic, photo_fields_ayah_translation, photo_fields_ayah_citation,
    photo_fields_photo_pattern::text::"enum__hero_slides_v_version_photo_fields_photo_pattern",
    split_fields_custom_color, photo_fields_custom_color, updated_at, created_at, now(), now(), true
  FROM hero_slides WHERE tenant_id = v_demo;

  INSERT INTO "_hero_slides_v_version_ctas" (_order, _parent_id, label, link_type, page, url, icon, "primary")
  SELECT c._order, v.id, c.label, c.link_type::text::"enum__hero_slides_v_version_ctas_link_type", c.page::text::"enum__hero_slides_v_version_ctas_page", c.url, c.icon, c."primary"
  FROM hero_slides_ctas c
  JOIN "_hero_slides_v" v ON v.parent_id = c._parent_id
  WHERE v.version_tenant_id = v_demo;

  -- 7. Forms (+ suggested-amounts + notification-emails arrays).
  INSERT INTO forms (id, title, slug, status, description, schema, settings_submit_button_label, settings_success_message, settings_capacity, settings_closed_message, settings_send_confirmation, settings_confirmation_subject, settings_confirmation_body, payment_enabled, payment_mode, payment_price_cents, payment_allow_custom_amount, payment_currency, payment_description, tenant_id, updated_at, created_at, appearance_display_mode, appearance_intro_message, appearance_submission_message, appearance_background_color, appearance_background_gradient_from, appearance_background_gradient_to, appearance_background_gradient_direction)
  SELECT id + v_off, title, slug, status, description, schema, settings_submit_button_label, settings_success_message, settings_capacity, settings_closed_message, settings_send_confirmation, settings_confirmation_subject, settings_confirmation_body, payment_enabled, payment_mode, payment_price_cents, payment_allow_custom_amount, payment_currency, payment_description, v_demo, updated_at, created_at, appearance_display_mode, appearance_intro_message, appearance_submission_message, appearance_background_color, appearance_background_gradient_from, appearance_background_gradient_to, appearance_background_gradient_direction
  FROM forms WHERE tenant_id = v_icp;

  INSERT INTO forms_payment_suggested_amounts_cents (id, _order, _parent_id, amount)
  SELECT substr(md5(random()::text || clock_timestamp()::text || id), 1, 24), _order, _parent_id + v_off, amount
  FROM forms_payment_suggested_amounts_cents WHERE _parent_id IN (SELECT id FROM forms WHERE tenant_id = v_icp);

  INSERT INTO forms_settings_notification_emails (id, _order, _parent_id, email)
  SELECT substr(md5(random()::text || clock_timestamp()::text || id), 1, 24), _order, _parent_id + v_off, email
  FROM forms_settings_notification_emails WHERE _parent_id IN (SELECT id FROM forms WHERE tenant_id = v_icp);

  RAISE NOTICE 'Imported ICP(%) visible content into demo(%).', v_icp, v_demo;
END $$;
