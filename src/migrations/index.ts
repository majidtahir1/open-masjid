import * as migration_20260425_142612_initial from './20260425_142612_initial';
import * as migration_20260428_004402_hero_variants from './20260428_004402_hero_variants';
import * as migration_20260428_043733_hero_photo_pattern from './20260428_043733_hero_photo_pattern';
import * as migration_20260428_171104_hero_photo_tone_rename from './20260428_171104_hero_photo_tone_rename';
import * as migration_20260428_173057_hero_photo_tone_custom from './20260428_173057_hero_photo_tone_custom';
import * as migration_20260429_173503_tenant_signup_fields from './20260429_173503_tenant_signup_fields';
import * as migration_20260429_204922_onboarding_state from './20260429_204922_onboarding_state';
import * as migration_20260430_144311_tenant_billing_fields from './20260430_144311_tenant_billing_fields';
import * as migration_20260430_152000_grandfather_existing_tenants from './20260430_152000_grandfather_existing_tenants';
import * as migration_20260501_044030_donation_funds_and_donations from './20260501_044030_donation_funds_and_donations';
import * as migration_20260504_175029_pages_nav_fields from './20260504_175029_pages_nav_fields';
import * as migration_20260504_182411_pages_seo_fields from './20260504_182411_pages_seo_fields';
import * as migration_20260504_185611_membership_tiers_collection from './20260504_185611_membership_tiers_collection';
import * as migration_20260504_190544_members_collection from './20260504_190544_members_collection';
import * as migration_20260506_033040 from './20260506_033040';
import * as migration_20260506_033322 from './20260506_033322';
import * as migration_20260506_142348___name from './20260506_142348___name';
import * as migration_20260507_042454 from './20260507_042454';
import * as migration_20260514_181910_kiosks_collection from './20260514_181910_kiosks_collection';
import * as migration_20260514_182235_slide_collections from './20260514_182235_slide_collections';
import * as migration_20260514_182517_qr_codes_collection from './20260514_182517_qr_codes_collection';
import * as migration_20260514_204832_expand_background_theme_enum from './20260514_204832_expand_background_theme_enum';
import * as migration_20260514_205028_background_theme_to_text from './20260514_205028_background_theme_to_text';

export const migrations = [
  {
    up: migration_20260425_142612_initial.up,
    down: migration_20260425_142612_initial.down,
    name: '20260425_142612_initial',
  },
  {
    up: migration_20260428_004402_hero_variants.up,
    down: migration_20260428_004402_hero_variants.down,
    name: '20260428_004402_hero_variants',
  },
  {
    up: migration_20260428_043733_hero_photo_pattern.up,
    down: migration_20260428_043733_hero_photo_pattern.down,
    name: '20260428_043733_hero_photo_pattern',
  },
  {
    up: migration_20260428_171104_hero_photo_tone_rename.up,
    down: migration_20260428_171104_hero_photo_tone_rename.down,
    name: '20260428_171104_hero_photo_tone_rename',
  },
  {
    up: migration_20260428_173057_hero_photo_tone_custom.up,
    down: migration_20260428_173057_hero_photo_tone_custom.down,
    name: '20260428_173057_hero_photo_tone_custom',
  },
  {
    up: migration_20260429_173503_tenant_signup_fields.up,
    down: migration_20260429_173503_tenant_signup_fields.down,
    name: '20260429_173503_tenant_signup_fields',
  },
  {
    up: migration_20260429_204922_onboarding_state.up,
    down: migration_20260429_204922_onboarding_state.down,
    name: '20260429_204922_onboarding_state',
  },
  {
    up: migration_20260430_144311_tenant_billing_fields.up,
    down: migration_20260430_144311_tenant_billing_fields.down,
    name: '20260430_144311_tenant_billing_fields',
  },
  {
    up: migration_20260430_152000_grandfather_existing_tenants.up,
    down: migration_20260430_152000_grandfather_existing_tenants.down,
    name: '20260430_152000_grandfather_existing_tenants',
  },
  {
    up: migration_20260501_044030_donation_funds_and_donations.up,
    down: migration_20260501_044030_donation_funds_and_donations.down,
    name: '20260501_044030_donation_funds_and_donations',
  },
  {
    up: migration_20260504_175029_pages_nav_fields.up,
    down: migration_20260504_175029_pages_nav_fields.down,
    name: '20260504_175029_pages_nav_fields',
  },
  {
    up: migration_20260504_182411_pages_seo_fields.up,
    down: migration_20260504_182411_pages_seo_fields.down,
    name: '20260504_182411_pages_seo_fields',
  },
  {
    up: migration_20260504_185611_membership_tiers_collection.up,
    down: migration_20260504_185611_membership_tiers_collection.down,
    name: '20260504_185611_membership_tiers_collection',
  },
  {
    up: migration_20260504_190544_members_collection.up,
    down: migration_20260504_190544_members_collection.down,
    name: '20260504_190544_members_collection',
  },
  {
    up: migration_20260506_033040.up,
    down: migration_20260506_033040.down,
    name: '20260506_033040',
  },
  {
    up: migration_20260506_033322.up,
    down: migration_20260506_033322.down,
    name: '20260506_033322',
  },
  {
    up: migration_20260506_142348___name.up,
    down: migration_20260506_142348___name.down,
    name: '20260506_142348___name',
  },
  {
    up: migration_20260507_042454.up,
    down: migration_20260507_042454.down,
    name: '20260507_042454',
  },
  {
    up: migration_20260514_181910_kiosks_collection.up,
    down: migration_20260514_181910_kiosks_collection.down,
    name: '20260514_181910_kiosks_collection',
  },
  {
    up: migration_20260514_182235_slide_collections.up,
    down: migration_20260514_182235_slide_collections.down,
    name: '20260514_182235_slide_collections',
  },
  {
    up: migration_20260514_182517_qr_codes_collection.up,
    down: migration_20260514_182517_qr_codes_collection.down,
    name: '20260514_182517_qr_codes_collection',
  },
  {
    up: migration_20260514_204832_expand_background_theme_enum.up,
    down: migration_20260514_204832_expand_background_theme_enum.down,
    name: '20260514_204832_expand_background_theme_enum',
  },
  {
    up: migration_20260514_205028_background_theme_to_text.up,
    down: migration_20260514_205028_background_theme_to_text.down,
    name: '20260514_205028_background_theme_to_text'
  },
];
