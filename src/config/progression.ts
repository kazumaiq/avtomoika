import type {
  CityEventId,
  EconomyMetrics,
  UpgradeLevels,
  WorkerProfile,
} from '../types/game';

export interface BusinessRank {
  id: string;
  title: string;
  minRevenue: number;
  minReputation: number;
  minBays: number;
  color: string;
}

export const BUSINESS_RANKS: BusinessRank[] = [
  {
    id: 'garage',
    title: 'Гаражная мойка',
    minRevenue: 0,
    minReputation: 1.0,
    minBays: 1,
    color: '#94A3B8',
  },
  {
    id: 'local',
    title: 'Мойка у дома',
    minRevenue: 25_000,
    minReputation: 3.6,
    minBays: 1,
    color: '#38BDF8',
  },
  {
    id: 'city',
    title: 'Городской центр',
    minRevenue: 90_000,
    minReputation: 3.9,
    minBays: 2,
    color: '#22C55E',
  },
  {
    id: 'detailing',
    title: 'Детейлинг-студия',
    minRevenue: 240_000,
    minReputation: 4.25,
    minBays: 3,
    color: '#FFB800',
  },
  {
    id: 'premium',
    title: 'Премиум-автокомплекс',
    minRevenue: 520_000,
    minReputation: 4.55,
    minBays: 4,
    color: '#F472B6',
  },
  {
    id: 'empire',
    title: 'Империя AUTOMOIKA',
    minRevenue: 1_000_000,
    minReputation: 4.8,
    minBays: 4,
    color: '#00D4FF',
  },
];

export function getBusinessRank(
  economy: EconomyMetrics,
  upgrades: UpgradeLevels
): { current: BusinessRank; next: BusinessRank | null; progress: number } {
  let currentIdx = 0;
  for (let i = 0; i < BUSINESS_RANKS.length; i++) {
    const r = BUSINESS_RANKS[i];
    if (
      economy.totalRevenue >= r.minRevenue &&
      economy.reputation >= r.minReputation &&
      upgrades.bays >= r.minBays
    ) {
      currentIdx = i;
    }
  }
  const current = BUSINESS_RANKS[currentIdx];
  const next = BUSINESS_RANKS[currentIdx + 1] ?? null;
  if (!next) {
    return { current, next: null, progress: 1 };
  }
  const revRatio = Math.min(1, economy.totalRevenue / Math.max(1, next.minRevenue));
  const repRatio = Math.min(
    1,
    Math.max(0, (economy.reputation - 3.0) / Math.max(0.1, next.minReputation - 3.0))
  );
  const bayRatio = Math.min(1, upgrades.bays / Math.max(1, next.minBays));
  const progress = Math.min(0.99, revRatio * 0.5 + repRatio * 0.25 + bayRatio * 0.25);
  return { current, next, progress };
}

export interface QuestSnapshot {
  economy: EconomyMetrics;
  upgrades: UpgradeLevels;
  workers: WorkerProfile[];
  playerSharePct: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  reward: number;
  target: number;
  getCurrent: (s: QuestSnapshot) => number;
  formatProgress?: (current: number, target: number) => string;
}

export const QUEST_CHAIN: QuestDefinition[] = [
  {
    id: 'wash_3',
    title: 'Первые клиенты',
    description: 'Помойте 3 автомобиля на своей автомойке',
    reward: 8_000,
    target: 3,
    getCurrent: (s) => s.economy.carsWashed,
  },
  {
    id: 'hire_2',
    title: 'Надёжная команда',
    description: 'Наймите 2-го сотрудника во вкладке «Персонал»',
    reward: 10_000,
    target: 2,
    getCurrent: (s) => s.workers.length,
  },
  {
    id: 'open_bay_2',
    title: 'Второй моечный бокс',
    description: 'Откройте Бокс #2 во вкладке «Улучшения»',
    reward: 15_000,
    target: 2,
    getCurrent: (s) => s.upgrades.bays,
  },
  {
    id: 'upgrade_equip',
    title: 'Профи-оборудование',
    description: 'Улучшите АВД или активную пену до уровня 2',
    reward: 12_000,
    target: 2,
    getCurrent: (s) => Math.max(s.upgrades.pressureWasher, s.upgrades.foamSystem),
  },
  {
    id: 'combo_5',
    title: 'Безупречная серия',
    description: 'Соберите комбо-серию из 5 машин без потерь очереди',
    reward: 14_000,
    target: 5,
    getCurrent: (s) => Math.max(s.economy.combo, s.economy.bestCombo),
  },
  {
    id: 'beat_rival_60',
    title: 'Лидер улицы',
    description: 'Доведите долю рынка до 60% против TURBO SHINE',
    reward: 20_000,
    target: 60,
    getCurrent: (s) => s.playerSharePct,
    formatProgress: (c, t) => `${Math.min(c, t)}% / ${t}%`,
  },
  {
    id: 'vip_lounge_2',
    title: 'Кофейня для гостей',
    description: 'Улучшите «Зону ожидания и кофейню» до Lv.2',
    reward: 22_000,
    target: 2,
    getCurrent: (s) => s.upgrades.vipLounge,
  },
  {
    id: 'rep_42',
    title: 'Высокий рейтинг',
    description: 'Поднимите рейтинг автомойки до 4.20 ★',
    reward: 28_000,
    target: 420,
    getCurrent: (s) => Math.round(s.economy.reputation * 100),
    formatProgress: (c, t) => `${(Math.min(c, t) / 100).toFixed(2)} / ${(t / 100).toFixed(2)}★`,
  },
  {
    id: 'open_bay_3',
    title: 'Масштабирование',
    description: 'Откройте Бокс #3 и наймите минимум 3 мастеров',
    reward: 42_000,
    target: 3,
    getCurrent: (s) => Math.min(s.upgrades.bays, s.workers.length),
  },
  {
    id: 'rev_250k',
    title: 'Четверть миллиона',
    description: 'Заработайте 250 000 ₽ суммарной выручки',
    reward: 55_000,
    target: 250_000,
    getCurrent: (s) => s.economy.totalRevenue,
    formatProgress: (c, t) =>
      `${Math.min(c, t).toLocaleString('ru-RU')} / ${t.toLocaleString('ru-RU')} ₽`,
  },
  {
    id: 'open_bay_4',
    title: 'Максимум боксов',
    description: 'Откройте все 4 моечных бокса',
    reward: 75_000,
    target: 4,
    getCurrent: (s) => s.upgrades.bays,
  },
  {
    id: 'empire_boss',
    title: 'Магнат AUTOMOIKA',
    description: 'Достигните 75% доли рынка и рейтинга 4.65 ★',
    reward: 120_000,
    target: 100,
    getCurrent: (s) => {
      const sharePart = Math.min(50, Math.round((s.playerSharePct / 75) * 50));
      const repPart = Math.min(
        50,
        Math.round((Math.max(0, s.economy.reputation - 3.5) / 1.15) * 50)
      );
      return sharePart + repPart;
    },
    formatProgress: (c, t) => `${Math.min(c, t)}% / ${t}%`,
  },
];

export interface CityEventSpec {
  id: CityEventId;
  title: string;
  subtitle: string;
  duration: number;
  trafficMultiplier: number;
  tipMultiplier: number;
  repMultiplier: number;
  vipChanceBonus: number;
  accentColor: string;
}

export const CITY_EVENTS: Record<CityEventId, CityEventSpec> = {
  rain_aftermath: {
    id: 'rain_aftermath',
    title: 'После ливня!',
    subtitle: 'Все машины в грязи • Поток +55%, чаевые +25%',
    duration: 42,
    trafficMultiplier: 1.55,
    tipMultiplier: 1.25,
    repMultiplier: 1.15,
    vipChanceBonus: 0.05,
    accentColor: '#38BDF8',
  },
  rush_hour: {
    id: 'rush_hour',
    title: 'Городской час пик',
    subtitle: 'Наплыв клиентов с проспекта • Поток +45%',
    duration: 38,
    trafficMultiplier: 1.45,
    tipMultiplier: 1.12,
    repMultiplier: 1.0,
    vipChanceBonus: 0.06,
    accentColor: '#FFB800',
  },
  car_blogger: {
    id: 'car_blogger',
    title: 'Автоблогер на районе',
    subtitle: 'Снимает обзор моек • Рейтинг x1.6 и VIP-гости!',
    duration: 40,
    trafficMultiplier: 1.25,
    tipMultiplier: 1.2,
    repMultiplier: 1.6,
    vipChanceBonus: 0.2,
    accentColor: '#F472B6',
  },
  vip_convoy: {
    id: 'vip_convoy',
    title: 'VIP-кортеж в городе!',
    subtitle: 'Премиум-авто едут на мойку • Тройные чаевые!',
    duration: 32,
    trafficMultiplier: 1.2,
    tipMultiplier: 1.35,
    repMultiplier: 1.3,
    vipChanceBonus: 0.35,
    accentColor: '#FACC15',
  },
};

export interface TutorialStepSpec {
  id: number;
  title: string;
  body: string;
  hint: string;
  highlightId?: string;
  actionLabel: string;
  canAutoAdvance?: boolean;
}

export const TUTORIAL_STEPS: TutorialStepSpec[] = [
  {
    id: 0,
    title: 'Тап по машине = Турбо-мойка ⚡',
    body: 'Нажмите на моющееся авто в боксе, чтобы ускорить мойку на +15%.',
    hint: '1 палец — двигать карту • 2 пальца — зум и поворот',
    actionLabel: 'Понятно',
    canAutoAdvance: true,
  },
  {
    id: 1,
    title: 'Наймите 2-го мойщика',
    body: 'Откройте «Персонал» и наймите мастера — очередь пойдёт вдвое быстрее.',
    hint: 'Подсвечена кнопка «Персонал» внизу',
    highlightId: 'btn-tab-staff',
    actionLabel: 'Далее',
    canAutoAdvance: true,
  },
  {
    id: 2,
    title: 'Улучшите мойку или откройте Бокс #2',
    body: 'В разделе «Улучшения» все апгрейды сразу появляются в 3D-мире.',
    hint: 'Подсвечена кнопка «Улучшения» внизу',
    highlightId: 'btn-tab-upgrades',
    actionLabel: 'Далее',
    canAutoAdvance: true,
  },
  {
    id: 3,
    title: 'Готово! Заберите +5 000 ₽',
    body: 'Смена длится с 07:00 до 22:00. Выполняйте цели вверху и обгоните TURBO SHINE!',
    hint: 'Обучение можно повторить в «Настройках»',
    actionLabel: 'Забрать +5 000 ₽',
  },
];
