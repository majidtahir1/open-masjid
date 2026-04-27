import * as migration_20260425_142612_initial from './20260425_142612_initial';

export const migrations = [
  {
    up: migration_20260425_142612_initial.up,
    down: migration_20260425_142612_initial.down,
    name: '20260425_142612_initial'
  },
];
