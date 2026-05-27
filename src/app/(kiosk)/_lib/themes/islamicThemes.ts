/**
 * Islamic Theme Configuration for Custom Slides
 *
 * Defines visual themes with Islamic decorative patterns that can be optionally
 * applied to custom slides. Each theme includes background patterns, safe zones
 * to prevent text overlap with decorative elements, and responsive typography.
 */

export interface IslamicTheme {
  id: string;
  name: string;
  description: string;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundColor: string;
  textColor: string;
  subtitleColor: string;
  datetimeColor: string;
  qrBorderColor: string;
  safeZones: {
    topMargin: string;
    bottomMargin: string;
    sidePadding: string;
  };
  typography: {
    titleSize: { min: number; preferred: string; max: number };
    subtitleSize: { min: number; preferred: string; max: number };
    datetimeSize: { min: number; preferred: string; max: number };
  };
}

export const ISLAMIC_THEMES: Record<string, IslamicTheme> = {
  'clean': {
    id: 'clean',
    name: 'Classic Clean',
    description: 'Minimal design with no decorative pattern, uses existing gradient',
    backgroundImage: 'none',
    backgroundOpacity: 1,
    backgroundColor: 'transparent', // Will use existing gradient
    textColor: '#1a1a1a',
    subtitleColor: '#4a4a4a',
    datetimeColor: '#2a2a2a',
    qrBorderColor: '#cccccc',
    safeZones: {
      topMargin: '0',
      bottomMargin: '0',
      sidePadding: '60px',
    },
    typography: {
      titleSize: { min: 90, preferred: '9vw', max: 180 },
      subtitleSize: { min: 60, preferred: '6vw', max: 120 },
      datetimeSize: { min: 53, preferred: '5.25vw', max: 105 },
    },
  },
  'subtle-texture': {
    id: 'subtle-texture',
    name: 'Subtle Heritage',
    description: 'Light beige background with subtle corner mandalas and lanterns (30% opacity)',
    backgroundImage: '/patterns/bg1.png',
    backgroundOpacity: 0.30,
    backgroundColor: '#F5F0E8',
    textColor: '#2C4A5A',
    subtitleColor: '#3D5A6B',
    datetimeColor: '#2C4A5A',
    qrBorderColor: '#2C4A5A',
    safeZones: {
      topMargin: '15%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'teal-corners': {
    id: 'teal-corners',
    name: 'Teal Corners',
    description: 'Light teal background with Islamic geometric corner decorations',
    backgroundImage: '/patterns/bg3.png',
    backgroundOpacity: 1,
    backgroundColor: '#E8F4F4',
    textColor: '#2C5A5A',
    subtitleColor: '#3D6B6B',
    datetimeColor: '#2C5A5A',
    qrBorderColor: '#4A8080',
    safeZones: {
      // Symmetric top/bottom so the centered text sits at the true vertical
      // center — the corner decoration is symmetric, so a heavier top margin
      // just pushed the text low.
      topMargin: '8%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'navy-accents': {
    id: 'navy-accents',
    name: 'Navy Accents',
    description: 'Light beige background with navy geometric corner accents',
    backgroundImage: '/patterns/bg4.png',
    backgroundOpacity: 1,
    backgroundColor: '#F5F0E8',
    textColor: '#2C4A5E',
    subtitleColor: '#3D5A6B',
    datetimeColor: '#2C4A5E',
    qrBorderColor: '#2C4A5E',
    safeZones: {
      topMargin: '15%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'full-ambiance': {
    id: 'full-ambiance',
    name: 'Full Ambiance',
    description: 'Dark navy background with gold mosque and decorative elements',
    backgroundImage: '/patterns/bg2.png',
    backgroundOpacity: 1,
    backgroundColor: '#1B3A52',
    textColor: '#F4E5C3',
    subtitleColor: '#E8D7B8',
    datetimeColor: '#D4AF37',
    qrBorderColor: '#B8941F',
    safeZones: {
      topMargin: '17%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'ornate-frame': {
    id: 'ornate-frame',
    name: 'Ornate Frame',
    description: 'Full ornate Islamic decorative frame with warm beige tones',
    backgroundImage: '/patterns/bg5.png',
    backgroundOpacity: 1,
    backgroundColor: '#F5EFE7',
    textColor: '#2C4A7C',
    subtitleColor: '#3D5A8B',
    datetimeColor: '#2C4A7C',
    qrBorderColor: '#2C4A7C',
    safeZones: {
      topMargin: '17%',
      bottomMargin: '8%',
      sidePadding: '240px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'desert-oasis': {
    id: 'desert-oasis',
    name: 'Desert Oasis',
    description: 'Serene desert landscape with mosque, ornate corner frames, and sage foliage',
    backgroundImage: '/patterns/bg6.png',
    backgroundOpacity: 0.35,
    backgroundColor: '#F5F0E8',
    textColor: '#2C5A52',
    subtitleColor: '#3D6B62',
    datetimeColor: '#2C5A52',
    qrBorderColor: '#B89968',
    safeZones: {
      topMargin: '17%',
      bottomMargin: '8%',
      sidePadding: '240px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'islamic_pattern': {
    id: 'islamic_pattern',
    name: 'Islamic Pattern',
    description: 'Elegant Islamic decorative pattern with intricate details',
    backgroundImage: '/patterns/bg7.png',
    backgroundOpacity: 1,
    backgroundColor: '#FFF8E7',
    textColor: '#8B6914',
    subtitleColor: '#A67C1A',
    datetimeColor: '#8B6914',
    qrBorderColor: '#D4AF37',
    safeZones: {
      topMargin: '20%',
      bottomMargin: '8%',
      sidePadding: '240px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'pink-tech': {
    id: 'pink-tech',
    name: 'Pink Tech',
    description: 'Modern pink and rose themed background',
    backgroundImage: '/patterns/bg8.png',
    backgroundOpacity: 1,
    backgroundColor: '#FFF0F5',
    textColor: '#8B2252',
    subtitleColor: '#A8336B',
    datetimeColor: '#8B2252',
    qrBorderColor: '#D946A6',
    safeZones: {
      topMargin: '15%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'blue-tech': {
    id: 'blue-tech',
    name: 'Blue Tech',
    description: 'Modern blue themed background',
    backgroundImage: '/patterns/bg9.png',
    backgroundOpacity: 1,
    backgroundColor: '#0F172A',
    textColor: '#FFFFFF',
    subtitleColor: '#E0F2FE',
    datetimeColor: '#FFFFFF',
    qrBorderColor: '#60A5FA',
    safeZones: {
      topMargin: '15%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'chess-theme': {
    id: 'chess-theme',
    name: 'Chess Theme',
    description: 'Classic black and white chess pattern',
    backgroundImage: '/patterns/bg10.png',
    backgroundOpacity: 0.35,
    backgroundColor: '#1A1A1A',
    textColor: '#FFFFFF',
    subtitleColor: '#E0E0E0',
    datetimeColor: '#F5F5F5',
    qrBorderColor: '#CCCCCC',
    safeZones: {
      topMargin: '8%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'quran-theme': {
    id: 'quran-theme',
    name: 'Quran Theme',
    description: 'Islamic Quran-inspired background',
    backgroundImage: '/patterns/bg11.png',
    backgroundOpacity: 0.15,
    backgroundColor: '#3A4A3A',
    textColor: '#FFFFFF',
    subtitleColor: '#E8F5E8',
    datetimeColor: '#FFFFFF',
    qrBorderColor: '#6AA080',
    safeZones: {
      topMargin: '8%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
  'ramadan': {
    id: 'ramadan',
    name: 'Ramadan',
    description: 'Ramadan Mubarak themed background with embedded greeting',
    backgroundImage: '/patterns/bg12.png',
    backgroundOpacity: 1,
    backgroundColor: '#2A3A4A',
    textColor: '#ba8317',
    subtitleColor: '#ba8317',
    datetimeColor: '#ba8317',
    qrBorderColor: '#ba8317',
    safeZones: {
      topMargin: '28%',
      bottomMargin: '8%',
      sidePadding: '220px',
    },
    typography: {
      titleSize: { min: 93, preferred: '6.9vw', max: 138 },
      subtitleSize: { min: 57, preferred: '4.5vw', max: 87 },
      datetimeSize: { min: 51, preferred: '3.9vw', max: 78 },
    },
  },
};

/**
 * Get theme by ID, returns null if not found
 */
export function getTheme(themeId: string | null): IslamicTheme | null {
  if (!themeId || themeId === 'none') {
    return null;
  }
  return ISLAMIC_THEMES[themeId] || null;
}

/**
 * Get all available theme options for UI selectors
 */
export function getThemeOptions(): Array<{ value: string; label: string; description: string }> {
  return Object.values(ISLAMIC_THEMES).map(theme => ({
    value: theme.id,
    label: theme.name,
    description: theme.description,
  }));
}
