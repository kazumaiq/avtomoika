import type { AdCampaignId, UpgradeDefinition, UpgradeKey, UpgradeLevels } from '../types/game';
import { formatRub } from '../utils/currency';

export const WASH_PRICE_MIN = 500;
export const WASH_PRICE_MAX = 2200;
export const WASH_PRICE_STEP = 50;
export const WASH_PRICE_DEFAULT = 850;
export const BAY_UTILITY_PER_MIN = 240;
export const WASH_UTILITY_COST = 75;
export const WAX_BONUS_PER_LEVEL = 75;
export const LOUNGE_TIP_PER_LEVEL = 55;

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    key: 'bays',
    title: 'Моечные боксы',
    subtitle: 'Открывает новые крытые боксы с оборудованием',
    category: 'expansion',
    maxLevel: 4,
    baseCost: 34_000,
    costMultiplier: 2.65,
    effectLabel: (lv) => `${lv} из 4 боксов`,
    nextEffectLabel: (next) => `Открыть Бокс #${next}`,
  },
  {
    key: 'pressureWasher',
    title: 'Мойка высокого давления',
    subtitle: 'Мощные турбофорсунки ускоряют смыв грязи',
    category: 'equipment',
    maxLevel: 5,
    baseCost: 11_000,
    costMultiplier: 2.15,
    effectLabel: (lv) => `+${(lv - 1) * 14}% к скорости мойки`,
    nextEffectLabel: (next) => `+${(next - 1) * 14}% к скорости мойки`,
  },
  {
    key: 'foamSystem',
    title: 'Активная нано-пена',
    subtitle: 'Густая цветная пена повышает качество и чек',
    category: 'equipment',
    maxLevel: 5,
    baseCost: 13_500,
    costMultiplier: 2.2,
    effectLabel: (lv) => `+${(lv - 1) * 6}% к чеку и качество`,
    nextEffectLabel: (next) => `+${(next - 1) * 6}% к чеку и качество`,
  },
  {
    key: 'dryerWax',
    title: 'Турбосушка и жидкий воск',
    subtitle: 'Арки обдува и воск придают зеркальный блеск',
    category: 'equipment',
    maxLevel: 5,
    baseCost: 16_500,
    costMultiplier: 2.25,
    effectLabel: (lv) =>
      `+${(lv - 1) * 8}% сушка, +${formatRub((lv - 1) * WAX_BONUS_PER_LEVEL)} бонус`,
    nextEffectLabel: (next) =>
      `+${(next - 1) * 8}% сушка, +${formatRub((next - 1) * WAX_BONUS_PER_LEVEL)} бонус`,
  },
  {
    key: 'vipLounge',
    title: 'Зона ожидания и кофейня',
    subtitle: 'Комфорт и кофе удерживают очередь и растят рейтинг',
    category: 'facility',
    maxLevel: 4,
    baseCost: 15_000,
    costMultiplier: 2.25,
    effectLabel: (lv) => `+${(lv - 1) * 24}% терпение, +${((lv - 1) * 0.25).toFixed(2)}★`,
    nextEffectLabel: (next) => `+${(next - 1) * 24}% терпение, +${((next - 1) * 0.25).toFixed(2)}★`,
  },
  {
    key: 'ecoSolar',
    title: 'Рециркуляция и солнечные панели',
    subtitle: 'Снижает аренду, воду и электричество в боксах',
    category: 'facility',
    maxLevel: 4,
    baseCost: 15_500,
    costMultiplier: 2.2,
    effectLabel: (lv) => `-${(lv - 1) * 18}% расходы на боксы и воду`,
    nextEffectLabel: (next) => `-${(next - 1) * 18}% расходы на боксы и воду`,
  },
  {
    key: 'queueLot',
    title: 'Расширение очереди и парковки',
    subtitle: 'Больше мест ожидания на въезде и подсветка полос',
    category: 'expansion',
    maxLevel: 3,
    baseCost: 18_000,
    costMultiplier: 2.35,
    effectLabel: (lv) => `До ${getMaxQueueCapacity(lv)} машин в очереди`,
    nextEffectLabel: (next) => `До ${getMaxQueueCapacity(next)} машин в очереди`,
  },
];

export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number {
  const def = UPGRADE_DEFINITIONS.find((d) => d.key === key);
  if (!def) return 999_999;
  const step = Math.max(0, currentLevel - 1);
  return Math.round((def.baseCost * Math.pow(def.costMultiplier, step)) / 500) * 500;
}

export function getMaxQueueCapacity(queueLotLevel: number): number {
  if (queueLotLevel <= 1) return 4;
  if (queueLotLevel === 2) return 6;
  return 8;
}

export function getPlayerQualityScore(upgrades: UpgradeLevels): number {
  const base = 1.65;
  const foamBonus = (upgrades.foamSystem - 1) * 0.42;
  const waxBonus = (upgrades.dryerWax - 1) * 0.36;
  const loungeBonus = (upgrades.vipLounge - 1) * 0.28;
  return Math.min(5.0, +(base + foamBonus + waxBonus + loungeBonus).toFixed(2));
}

/** Fair market wash price clients gladly pay for a given quality & reputation */
export function getFairWashPrice(quality: number, reputation: number): number {
  const raw = 580 + quality * 245 + Math.max(0, reputation - 3.0) * 165;
  return Math.round(raw / 50) * 50;
}

export function getEquipmentSpeedMultiplier(upgrades: UpgradeLevels): number {
  const washer = 1 + (upgrades.pressureWasher - 1) * 0.14;
  const dryer = 1 + (upgrades.dryerWax - 1) * 0.08;
  return washer * dryer;
}

export function getUtilityDiscount(ecoSolarLevel: number): number {
  return Math.max(0.42, 1 - (ecoSolarLevel - 1) * 0.18);
}

export interface AdCampaignSpec {
  id: AdCampaignId;
  title: string;
  description: string;
  costPerMin: number;
  demandBoost: number; // additive attraction score
  trafficMultiplier: number;
}

export const AD_CAMPAIGNS: Record<AdCampaignId, AdCampaignSpec> = {
  none: {
    id: 'none',
    title: 'Без рекламы',
    description: 'Только органический трафик с проспекта',
    costPerMin: 0,
    demandBoost: 0,
    trafficMultiplier: 1.0,
  },
  flyers: {
    id: 'flyers',
    title: 'Листовки на районе',
    description: '+16% поток машин и заметность среди соседей',
    costPerMin: 1_500,
    demandBoost: 0.48,
    trafficMultiplier: 1.16,
  },
  billboard: {
    id: 'billboard',
    title: 'Неоновый билборд',
    description: 'Зажигает крышный билборд! +32% поток клиентов',
    costPerMin: 3_600,
    demandBoost: 1.05,
    trafficMultiplier: 1.32,
  },
  radio: {
    id: 'radio',
    title: 'Городское радио и соцсети',
    description: 'Максимальный охват города, +50% поток и больше VIP',
    costPerMin: 7_200,
    demandBoost: 1.75,
    trafficMultiplier: 1.5,
  },
};
