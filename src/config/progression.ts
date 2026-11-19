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
    minRevenue: 55_000,
    minReputation: 3.55,
    minBays: 1,
    color: '#38BDF8',
  },
  {
    id: 'city',
    title: 'Городской центр',
    minRevenue: 220_000,
    minReputation: 3.9,
    minBays: 2,
    color: '#22C55E',
  },
  {
    id: 'detailing',
    title: 'Детейлинг-студия',
    minRevenue: 650_000,
    minReputation: 4.3,
    minBays: 3,
    color: '#FFB800',
  },
  {
    id: 'premium',
    title: 'Премиум-автокомплекс',
    minRevenue: 1_500_000,
    minReputation: 4.6,
    minBays: 4,
    color: '#F472B6',
  },
  {
    id: 'empire',
    title: 'Империя AUTOMOIKA',
    minRevenue: 3_000_000,
    minReputation: 4.85,
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
    id: 'wash_5',
    title: 'Первые клиенты',
    description: 'Помойте 5 автомобилей на своей автомойке',
    reward: 4_000,
    target: 5,
    getCurrent: (s) => s.economy.carsWashed,
  },
  {
    id: 'hire_2',
    title: 'Надёжная команда',
    description: 'Наймите 2-го сотрудника во вкладке «Персонал»',
    reward: 5_500,
    target: 2,
    getCurrent: (s) => s.workers.length,
  },
  {
    id: 'upgrade_equip',
    title: 'Профи-оборудование',
    description: 'Улучшите АВД или активную пену до уровня 2',
    reward: 7_500,
    target: 2,
    getCurrent: (s) => Math.max(s.upgrades.pressureWasher, s.upgrades.foamSystem),
  },
  {
    id: 'open_bay_2',
    title: 'Второй моечный бокс',
    description: 'Откройте Бокс #2 во вкладке «Улучшения»',
    reward: 11_000,
    target: 2,
    getCurrent: (s) => s.upgrades.bays,
  },
  {
    id: 'beat_rival_55',
    title: 'Отвоевать проспект',
    description: 'Перехватите 55% потока у TURBO SHINE',
    reward: 14_000,
    target: 55,
    getCurrent: (s) => s.playerSharePct,
    formatProgress: (c, t) => `${Math.min(c, t)}% / ${t}%`,
  },
  {
    id: 'combo_8',
    title: 'Безупречная серия',
    description: 'Соберите комбо-серию из 8 машин без потерь очереди',
    reward: 15_000,
    target: 8,
    getCurrent: (s) => Math.max(s.economy.combo, s.economy.bestCombo),
  },
  {
    id: 'vip_lounge_2',
    title: 'Кофейня для гостей',
    description: 'Улучшите «Зону ожидания и кофейню» до Lv.2',
    reward: 18_000,
    target: 2,
    getCurrent: (s) => s.upgrades.vipLounge,
  },
  {
    id: 'rep_42',
    title: 'Высокий рейтинг',
    description: 'Поднимите рейтинг автомойки до 4.20 ★',
    reward: 22_000,
    target: 420,
    getCurrent: (s) => Math.round(s.economy.reputation * 100),
    formatProgress: (c, t) => `${(Math.min(c, t) / 100).toFixed(2)} / ${(t / 100).toFixed(2)}★`,
  },
  {
    id: 'open_bay_3',
    title: 'Масштабирование',
    description: 'Откройте Бокс #3 и наймите минимум 3 мастеров',
    reward: 32_000,
    target: 3,
    getCurrent: (s) => Math.min(s.upgrades.bays, s.workers.length),
  },
  {
    id: 'rev_500k',
    title: 'Полмиллиона выручки',
    description: 'Заработайте 500 000 ₽ суммарной выручки',
    reward: 38_000,
    target: 500_000,
    getCurrent: (s) => s.economy.totalRevenue,
    formatProgress: (c, t) =>
      `${Math.min(c, t).toLocaleString('ru-RU')} / ${t.toLocaleString('ru-RU')} ₽`,
  },
  {
    id: 'open_bay_4',
    title: 'Максимум боксов',
    description: 'Откройте все 4 моечных бокса',
    reward: 50_000,
    target: 4,
    getCurrent: (s) => s.upgrades.bays,
  },
  {
    id: 'empire_boss',
    title: 'Магнат AUTOMOIKA',
    description: 'Достигните 68% доли рынка против TURBO SHINE и рейтинга 4.70 ★',
    reward: 65_000,
    target: 100,
    getCurrent: (s) => {
      const sharePart = Math.min(50, Math.round((s.playerSharePct / 68) * 50));
      const repPart = Math.min(
        50,
        Math.round((Math.max(0, s.economy.reputation - 3.3) / 1.4) * 50)
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
    subtitle: 'Все машины в грязи • Поток +40%, чаевые +15%',
    duration: 38,
    trafficMultiplier: 1.4,
    tipMultiplier: 1.15,
    repMultiplier: 1.15,
    vipChanceBonus: 0.04,
    accentColor: '#38BDF8',
  },
  rush_hour: {
    id: 'rush_hour',
    title: 'Городской час пик',
    subtitle: 'Наплыв клиентов с проспекта • Поток +35%',
    duration: 35,
    trafficMultiplier: 1.35,
    tipMultiplier: 1.08,
    repMultiplier: 1.0,
    vipChanceBonus: 0.04,
    accentColor: '#FFB800',
  },
  car_blogger: {
    id: 'car_blogger',
    title: 'Автоблогер на районе',
    subtitle: 'Снимает обзор моек • Рейтинг x1.45 и VIP-гости!',
    duration: 36,
    trafficMultiplier: 1.2,
    tipMultiplier: 1.12,
    repMultiplier: 1.45,
    vipChanceBonus: 0.14,
    accentColor: '#F472B6',
  },
  vip_convoy: {
    id: 'vip_convoy',
    title: 'VIP-кортеж в городе!',
    subtitle: 'Премиум-авто едут на мойку • Повышенные чаевые!',
    duration: 30,
    trafficMultiplier: 1.15,
    tipMultiplier: 1.2,
    repMultiplier: 1.25,
    vipChanceBonus: 0.25,
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
    title: 'Готово! Заберите +3 500 ₽',
    body: 'Смена длится с 07:00 до 22:00. Отвоюйте клиентов у TURBO SHINE!',
    hint: 'Обучение можно повторить в «Настройках»',
    actionLabel: 'Забрать +3 500 ₽',
  },
];
