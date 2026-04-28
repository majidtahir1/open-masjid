import * as migration_20260425_142612_initial from './20260425_142612_initial';
import * as migration_20260428_004402_hero_variants from './20260428_004402_hero_variants';
import * as migration_20260428_043733_hero_photo_pattern from './20260428_043733_hero_photo_pattern';

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
    name: '20260428_043733_hero_photo_pattern'
  },
];
