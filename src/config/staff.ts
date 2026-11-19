import type { HireCandidate, OwnerSide, WorkerAppearance, WorkerProfile } from '../types/game';

const FIRST_NAMES = [
  'Алексей',
  'Дмитрий',
  'Мария',
  'Кирилл',
  'Артём',
  'Анна',
  'Максим',
  'Даниил',
  'София',
  'Илья',
  'Никита',
  'Елена',
  'Тимур',
  'Виктор',
  'Полина',
  'Роман',
];

const ROLES = [
  'Мастер мойки',
  'Специалист по пене',
  'Детейлер',
  'Оператор Karcher',
  'Полировщик',
];

const SKIN_TONES = ['#F2C9A8', '#E0AC82', '#C6865B', '#8D5524', '#F5D5BC'];
const HAIR_COLORS = ['#1B1B22', '#4A3122', '#B5894A', '#8C3B2B', '#2E2B38'];
const PLAYER_UNIFORMS = ['#17253D', '#1E3A5F', '#18324A', '#223047'];
const PLAYER_VESTS = ['#00D4FF', '#FF3B5C', '#FFB800', '#22C55E'];
const COMP_UNIFORMS = ['#2A1820', '#231922'];
const COMP_VESTS = ['#FF4D4F', '#FA8C16'];

let nextWorkerCounter = 100;

export function createAppearance(owner: OwnerSide, seed?: number): WorkerAppearance {
  const pick = <T,>(arr: T[], offset: number): T => {
    const idx =
      seed !== undefined
        ? Math.abs(Math.floor(seed + offset)) % arr.length
        : Math.floor(Math.random() * arr.length);
    return arr[idx];
  };

  const hatStyles: Array<'cap' | 'beanie' | 'none'> = ['cap', 'beanie', 'none'];
  const vest = owner === 'player' ? pick(PLAYER_VESTS, 3) : pick(COMP_VESTS, 3);

  return {
    skinColor: pick(SKIN_TONES, 0),
    uniformColor: owner === 'player' ? pick(PLAYER_UNIFORMS, 1) : pick(COMP_UNIFORMS, 1),
    vestColor: vest,
    hairColor: pick(HAIR_COLORS, 2),
    hatStyle: pick(hatStyles, 4),
    hatColor: owner === 'player' ? vest : '#FF4D4F',
    hasGlasses: seed !== undefined ? seed % 3 === 0 : Math.random() < 0.28,
  };
}

export function createStarterWorker(): WorkerProfile {
  return {
    id: 'worker-starter-1',
    owner: 'player',
    name: 'Алексей',
    roleTitle: 'Старший мойщик',
    appearance: {
      skinColor: '#F2C9A8',
      uniformColor: '#17253D',
      vestColor: '#00D4FF',
      hairColor: '#2B241E',
      hatStyle: 'cap',
      hatColor: '#00D4FF',
      hasGlasses: false,
    },
    speed: 1.02,
    quality: 1.0,
    salaryPerMin: 750,
    morale: 1.0,
    level: 1,
    xp: 0,
    xpToNext: 120,
    assignedBay: -1,
    carsWashed: 0,
  };
}

export function createCompetitorWorkers(count: number): WorkerProfile[] {
  const names = ['Виктор Т.', 'Сергей Т.', 'Олег Т.'];
  return Array.from({ length: count }, (_, idx) => ({
    id: `comp-worker-${idx + 1}`,
    owner: 'competitor',
    name: names[idx] ?? `Мойщик #${idx + 1}`,
    roleTitle: 'Turbo Shine Crew',
    appearance: createAppearance('competitor', idx * 7 + 1),
    speed: 1.16 + idx * 0.09,
    quality: 1.15 + idx * 0.08,
    salaryPerMin: 850,
    morale: 1.0,
    level: 2 + Math.min(2, idx),
    xp: 0,
    xpToNext: 150,
    assignedBay: idx,
    carsWashed: 0,
  }));
}

export function generateHireCandidates(count = 4, reputation = 3.5): HireCandidate[] {
  const used = new Set<string>();
  const result: HireCandidate[] = [];

  for (let i = 0; i < count; i++) {
    let name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    let tries = 0;
    while (used.has(name) && tries < 10) {
      name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      tries++;
    }
    used.add(name);

    const tierRoll = Math.random() + Math.max(0, (reputation - 3.2) * 0.14);
    const level = tierRoll > 1.08 ? 3 : tierRoll > 0.68 ? 2 : 1;
    const speed = +(0.86 + level * 0.12 + Math.random() * 0.18).toFixed(2);
    const quality = +(0.86 + level * 0.11 + Math.random() * 0.18).toFixed(2);
    const salaryPerMin = Math.round((680 + (speed + quality) * 290 + level * 140) / 50) * 50;
    const hireCost = Math.round((7500 + level * 5500 + (speed + quality) * 3200) / 500) * 500;

    nextWorkerCounter += 1;
    result.push({
      id: `cand-${Date.now()}-${nextWorkerCounter}-${i}`,
      name,
      roleTitle: ROLES[Math.floor(Math.random() * ROLES.length)],
      appearance: createAppearance('player'),
      speed,
      quality,
      salaryPerMin,
      hireCost,
      level,
    });
  }

  return result;
}

export function getTrainingCost(worker: WorkerProfile): number {
  return Math.round((8500 * Math.pow(1.68, worker.level - 1)) / 500) * 500;
}

export function getRaiseAmount(worker: WorkerProfile): number {
  return Math.max(150, Math.round((worker.salaryPerMin * 0.2) / 50) * 50);
}
