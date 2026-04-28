import * as migration_20260425_142612_initial from './20260425_142612_initial';
import * as migration_20260428_004402_hero_variants from './20260428_004402_hero_variants';
import * as migration_20260428_043733_hero_photo_pattern from './20260428_043733_hero_photo_pattern';
import * as migration_20260428_171104_hero_photo_tone_rename from './20260428_171104_hero_photo_tone_rename';
import * as migration_20260428_173057_hero_photo_tone_custom from './20260428_173057_hero_photo_tone_custom';

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
    name: '20260428_173057_hero_photo_tone_custom'
  },
];
