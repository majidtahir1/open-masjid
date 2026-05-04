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
    name: '20260504_175029_pages_nav_fields'
  },
];
