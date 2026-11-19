import type { VehicleAppearance, VehicleCategory } from '../types/game';

export interface VehicleSpec {
  category: VehicleCategory;
  labelRu: string;
  models: string[];
  priceMultiplier: number;
  baseWashSeconds: number;
  weight: number;
  minReputation: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
    wheelRadius: number;
    wheelbase: number;
    trackWidth: number;
  };
  palette: Array<{ primary: string; accent: string; rim: string }>;
}

export const VEHICLE_SPECS: Record<VehicleCategory, VehicleSpec> = {
  budget: {
    category: 'budget',
    labelRu: 'Бюджетный',
    models: ['Lada Granta', 'KIA Picanto', 'Renault Logan', 'Daewoo Matiz'],
    priceMultiplier: 1.0,
    baseWashSeconds: 15,
    weight: 30,
    minReputation: 1.0,
    dimensions: {
      length: 3.7,
      width: 1.68,
      height: 1.48,
      wheelRadius: 0.34,
      wheelbase: 2.35,
      trackWidth: 1.54,
    },
    palette: [
      { primary: '#E8E4D9', accent: '#333842', rim: '#A5AEBC' },
      { primary: '#4BA3C3', accent: '#23313B', rim: '#B4BECB' },
      { primary: '#E26D5A', accent: '#2C2A32', rim: '#B2B8C2' },
      { primary: '#7DA87B', accent: '#2D3430', rim: '#AEB6BF' },
      { primary: '#F1C453', accent: '#2B2B2E', rim: '#A9B1BC' },
    ],
  },
  hatchback: {
    category: 'hatchback',
    labelRu: 'Хэтчбек',
    models: ['VW Golf GTI', 'Mazda 3 Hatch', 'Mini Cooper S', 'Hyundai i30'],
    priceMultiplier: 1.2,
    baseWashSeconds: 16.5,
    weight: 24,
    minReputation: 1.0,
    dimensions: {
      length: 3.95,
      width: 1.78,
      height: 1.46,
      wheelRadius: 0.36,
      wheelbase: 2.52,
      trackWidth: 1.62,
    },
    palette: [
      { primary: '#FF4757', accent: '#181A24', rim: '#DCE3EE' },
      { primary: '#1E90FF', accent: '#121824', rim: '#E1E7F0' },
      { primary: '#FFB142', accent: '#1E1F29', rim: '#2A2F3B' },
      { primary: '#2ED573', accent: '#141B22', rim: '#D9E1EC' },
      { primary: '#F5F6FA', accent: '#FF4757', rim: '#2E3440' },
    ],
  },
  sedan: {
    category: 'sedan',
    labelRu: 'Седан',
    models: ['Toyota Camry', 'BMW 330i', 'Honda Accord', 'Skoda Octavia'],
    priceMultiplier: 1.35,
    baseWashSeconds: 18,
    weight: 22,
    minReputation: 1.0,
    dimensions: {
      length: 4.45,
      width: 1.82,
      height: 1.42,
      wheelRadius: 0.37,
      wheelbase: 2.74,
      trackWidth: 1.66,
    },
    palette: [
      { primary: '#243B55', accent: '#9FB3C8', rim: '#E4EAF2' },
      { primary: '#D9E2EC', accent: '#1F2933', rim: '#CBD2D9' },
      { primary: '#B8333A', accent: '#1C1E26', rim: '#E0E6ED' },
      { primary: '#2D3436', accent: '#00CEC9', rim: '#D8E0E8' },
      { primary: '#3B6978', accent: '#204051', rim: '#DFE6ED' },
    ],
  },
  suv: {
    category: 'suv',
    labelRu: 'Внедорожник',
    models: ['Land Cruiser', 'Jeep Wrangler', 'Range Rover', 'Mercedes G-Class'],
    priceMultiplier: 1.75,
    baseWashSeconds: 21,
    weight: 14,
    minReputation: 1.5,
    dimensions: {
      length: 4.6,
      width: 1.98,
      height: 1.84,
      wheelRadius: 0.44,
      wheelbase: 2.78,
      trackWidth: 1.78,
    },
    palette: [
      { primary: '#2F4858', accent: '#1B2228', rim: '#C8D1DC' },
      { primary: '#D97706', accent: '#1E2024', rim: '#383E4A' },
      { primary: '#3F6212', accent: '#1A1E1B', rim: '#323842' },
      { primary: '#E5E7EB', accent: '#1F2937', rim: '#2A303C' },
      { primary: '#1F242D', accent: '#F59E0B', rim: '#4B5563' },
    ],
  },
  sports: {
    category: 'sports',
    labelRu: 'Спорткар',
    models: ['Porsche 911', 'Nissan GT-R', 'Supra MK5', 'Corvette C8'],
    priceMultiplier: 2.25,
    baseWashSeconds: 20,
    weight: 7,
    minReputation: 2.4,
    dimensions: {
      length: 4.48,
      width: 1.94,
      height: 1.24,
      wheelRadius: 0.37,
      wheelbase: 2.66,
      trackWidth: 1.76,
    },
    palette: [
      { primary: '#FF2E63', accent: '#111420', rim: '#F2F5FA' },
      { primary: '#00D4FF', accent: '#101624', rim: '#1B202C' },
      { primary: '#FFCC00', accent: '#16171E', rim: '#20242E' },
      { primary: '#FF6B00', accent: '#14151C', rim: '#E8EDF4' },
      { primary: '#F8FAFC', accent: '#FF2E63', rim: '#1F2430' },
    ],
  },
  premium: {
    category: 'premium',
    labelRu: 'Премиум',
    models: ['Mercedes S-Class', 'Bentley GT', 'Rolls Ghost', 'Maybach S680'],
    priceMultiplier: 2.85,
    baseWashSeconds: 23,
    weight: 4,
    minReputation: 3.1,
    dimensions: {
      length: 4.88,
      width: 1.96,
      height: 1.46,
      wheelRadius: 0.39,
      wheelbase: 3.02,
      trackWidth: 1.78,
    },
    palette: [
      { primary: '#151924', accent: '#E2C07D', rim: '#F1D99C' },
      { primary: '#F4F1EA', accent: '#B68D40', rim: '#E7EDF5' },
      { primary: '#1E2D3B', accent: '#D8DEE9', rim: '#ECEFF4' },
      { primary: '#4A1828', accent: '#E2C07D', rim: '#E5E7EB' },
    ],
  },
};

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'budget',
  'hatchback',
  'sedan',
  'suv',
  'sports',
  'premium',
];

export function pickVehicleForReputation(reputation: number): {
  category: VehicleCategory;
  modelName: string;
  appearance: VehicleAppearance;
} {
  const repBoost = Math.max(0, reputation - 2.5);
  const candidates = VEHICLE_CATEGORIES.filter(
    (cat) => reputation >= VEHICLE_SPECS[cat].minReputation
  );

  const weights = candidates.map((cat) => {
    const spec = VEHICLE_SPECS[cat];
    let w = spec.weight;
    if (cat === 'sports' || cat === 'premium') {
      w += repBoost * 4.5;
    } else if (cat === 'suv') {
      w += repBoost * 2.0;
    }
    return w;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  let chosen: VehicleCategory = candidates[0] ?? 'budget';
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      chosen = candidates[i];
      break;
    }
  }

  const spec = VEHICLE_SPECS[chosen];
  const modelName =
    spec.models[Math.floor(Math.random() * spec.models.length)] ?? spec.labelRu;
  const swatch =
    spec.palette[Math.floor(Math.random() * spec.palette.length)] ??
    spec.palette[0];

  return {
    category: chosen,
    modelName,
    appearance: {
      primaryColor: swatch.primary,
      accentColor: swatch.accent,
      rimColor: swatch.rim,
      dirtSeed: Math.random() * 1000,
    },
  };
}
