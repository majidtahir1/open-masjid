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
-- the offset parent ids. Membership tiers and donation funds are
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

  -- 3. Services.
  INSERT INTO services (id, title, description, icon, sort_order, tenant_id, updated_at, created_at, _status)
  SELECT id + v_off, title, description, icon, sort_order, v_demo, updated_at, created_at, _status
  FROM services WHERE tenant_id = v_icp;

  -- 4. Announcements.
  INSERT INTO announcements (id, title, body, priority, active, expires_at, tenant_id, updated_at, created_at, _status)
  SELECT id + v_off, title, body, priority, active, expires_at, v_demo, updated_at, created_at, _status
  FROM announcements WHERE tenant_id = v_icp;

  -- 5. Events (+ audience array). Remap flyer_image_id to the copied media.
  INSERT INTO events (id, title, short_description, description, tag, "when", start_date, end_date, location, address, contact, display_mode, flyer_image_id, template_variant, featured, hero_accent, slug, tenant_id, updated_at, created_at, _status)
  SELECT id + v_off, title, short_description, description, tag, "when", start_date, end_date, location, address, contact, display_mode,
    flyer_image_id,  -- reference ICP's media row directly (public read)
    template_variant, featured, hero_accent, slug, v_demo, updated_at, created_at, _status
  FROM events WHERE tenant_id = v_icp;

  INSERT INTO events_audience ("order", parent_id, value)
  SELECT "order", parent_id + v_off, value
  FROM events_audience WHERE parent_id IN (SELECT id FROM events WHERE tenant_id = v_icp);

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
