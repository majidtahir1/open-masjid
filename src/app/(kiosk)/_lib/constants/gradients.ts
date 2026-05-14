/**
 * Professional gradient definitions for custom slide backgrounds
 * Curated collection of sophisticated gradients suitable for Islamic Center displays
 */

export interface GradientDefinition {
  name: string;
  colors: string[];
  css: string;
}

export const PROFESSIONAL_GRADIENTS: GradientDefinition[] = [
  {
    name: 'Dark Ocean',
    colors: ['#373B44', '#4286f4'],
    css: 'linear-gradient(to right, #373B44, #4286f4)'
  },
  {
    name: 'Moonlit Asteroid',
    colors: ['#0F2027', '#203A43', '#2C5364'],
    css: 'linear-gradient(to right, #0F2027, #203A43, #2C5364)'
  },
  {
    name: 'Royal Blue',
    colors: ['#536976', '#292E49'],
    css: 'linear-gradient(to right, #536976, #292E49)'
  },
  {
    name: 'Mystic',
    colors: ['#757F9A', '#D7DDE8'],
    css: 'linear-gradient(to right, #757F9A, #D7DDE8)'
  },
  {
    name: 'Between Night and Day',
    colors: ['#2c3e50', '#3498db'],
    css: 'linear-gradient(to right, #2c3e50, #3498db)'
  },
  {
    name: 'Calm Darya',
    colors: ['#5f2c82', '#49a09d'],
    css: 'linear-gradient(to right, #5f2c82, #49a09d)'
  },
  {
    name: 'Titanium',
    colors: ['#283048', '#859398'],
    css: 'linear-gradient(to right, #283048, #859398)'
  },
  {
    name: 'Petrol',
    colors: ['#BBD2C5', '#536976'],
    css: 'linear-gradient(to right, #BBD2C5, #536976)'
  },
  {
    name: 'Decent',
    colors: ['#4CA1AF', '#C4E0E5'],
    css: 'linear-gradient(to right, #4CA1AF, #C4E0E5)'
  },
  {
    name: 'Emerald Sea',
    colors: ['#05386b', '#5cdb95'],
    css: 'linear-gradient(to right, #05386b, #5cdb95)'
  },
  {
    name: 'Blu',
    colors: ['#00416A', '#E4E5E6'],
    css: 'linear-gradient(to right, #00416A, #E4E5E6)'
  },
  {
    name: 'Nimvelo',
    colors: ['#314755', '#26a0da'],
    css: 'linear-gradient(to right, #314755, #26a0da)'
  }
];

/**
 * Get a random gradient from the collection, avoiding immediate repeats
 * @param excludeIndex - Index of gradient to exclude from selection
 * @returns Random gradient definition
 */
export const getRandomGradient = (excludeIndex?: number): GradientDefinition => {
  let availableGradients = PROFESSIONAL_GRADIENTS;
  
  if (excludeIndex !== undefined && excludeIndex >= 0 && excludeIndex < PROFESSIONAL_GRADIENTS.length) {
    availableGradients = PROFESSIONAL_GRADIENTS.filter((_, index) => index !== excludeIndex);
  }
  
  const randomIndex = Math.floor(Math.random() * availableGradients.length);
  return availableGradients[randomIndex];
};

/**
 * Get the index of a gradient in the PROFESSIONAL_GRADIENTS array
 * @param gradient - Gradient definition to find
 * @returns Index of gradient, or -1 if not found
 */
export const getGradientIndex = (gradient: GradientDefinition): number => {
  return PROFESSIONAL_GRADIENTS.findIndex(g => g.name === gradient.name);
};