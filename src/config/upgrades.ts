import type { AdCampaignId, UpgradeDefinition, UpgradeKey, UpgradeLevels } from '../types/game';

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    key: 'bays',
    title: 'Моечные боксы',
    subtitle: 'Открывает новые крытые боксы с оборудованием',
    category: 'expansion',
    maxLevel: 4,
    baseCost: 750,
    costMultiplier: 2.15,
    effectLabel: (lv) => `${lv} из 4 боксов`,
    nextEffectLabel: (next) => `Открыть Бокс #${next}`,
  },
  {
    key: 'pressureWasher',
    title: 'Мойка высокого давления',
    subtitle: 'Мощные турбофорсунки ускоряют смыв грязи',
    category: 'equipment',
    maxLevel: 5,
    baseCost: 340,
    costMultiplier: 1.75,
    effectLabel: (lv) => `+${(lv - 1) * 18}% к скорости мойки`,
    nextEffectLabel: (next) => `+${(next - 1) * 18}% к скорости мойки`,
  },
  {
    key: 'foamSystem',
    title: 'Активная нано-пена',
    subtitle: 'Густая цветная пена повышает качество и чаевые',
    category: 'equipment',
    maxLevel: 5,
    baseCost: 380,
    costMultiplier: 1.8,
    effectLabel: (lv) => `+${(lv - 1) * 14}% качество и чаевые`,
    nextEffectLabel: (next) => `+${(next - 1) * 14}% качество и чаевые`,
  },
  {
    key: 'dryerWax',
    title: 'Турбосушка и воск',
    subtitle: 'Арки обдува и жидкий воск дают зеркальный блеск',
    category: 'equipment',
    maxLevel: 5,
    baseCost: 460,
    costMultiplier: 1.85,
    effectLabel: (lv) => `-${(lv - 1) * 12}% время сушки, +$${(lv - 1) * 4} бонус`,
    nextEffectLabel: (next) => `-${(next - 1) * 12}% время сушки, +$${(next - 1) * 4} бонус`,
  },
  {
    key: 'vipLounge',
    title: 'Зона ожидания и кофейня',
    subtitle: 'Комфорт для клиентов удерживает очередь и растит репутацию',
    category: 'facility',
    maxLevel: 4,
    baseCost: 420,
    costMultiplier: 1.9,
    effectLabel: (lv) => `+${(lv - 1) * 28}% терпение, +${((lv - 1) * 0.25).toFixed(2)}★`,
    nextEffectLabel: (next) => `+${(next - 1) * 28}% терпение, +${((next - 1) * 0.25).toFixed(2)}★`,
  },
  {
    key: 'ecoSolar',
    title: 'Рециркуляция и солнечные панели',
    subtitle: 'Снижает счета за воду и электричество на территории',
    category: 'facility',
    maxLevel: 4,
    baseCost: 520,
    costMultiplier: 1.85,
    effectLabel: (lv) => `-${(lv - 1) * 18}% коммунальные расходы`,
    nextEffectLabel: (next) => `-${(next - 1) * 18}% коммунальные расходы`,
  },
  {
    key: 'queueLot',
    title: 'Расширение очереди и парковки',
    subtitle: 'Больше мест ожидания на въезде и подсветка полос',
    category: 'expansion',
    maxLevel: 3,
    baseCost: 550,
    costMultiplier: 2.0,
    effectLabel: (lv) => `До ${getMaxQueueCapacity(lv)} машин в очереди`,
    nextEffectLabel: (next) => `До ${getMaxQueueCapacity(next)} машин в очереди`,
  },
];

export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number {
  const def = UPGRADE_DEFINITIONS.find((d) => d.key === key);
  if (!def) return 99999;
  const step = Math.max(0, currentLevel - 1);
  return Math.round((def.baseCost * Math.pow(def.costMultiplier, step)) / 10) * 10;
}

export function getMaxQueueCapacity(queueLotLevel: number): number {
  if (queueLotLevel <= 1) return 4;
  if (queueLotLevel === 2) return 6;
  return 8;
}

export function getPlayerQualityScore(upgrades: UpgradeLevels): number {
  const base = 1.6;
  const foamBonus = (upgrades.foamSystem - 1) * 0.42;
  const waxBonus = (upgrades.dryerWax - 1) * 0.36;
  const loungeBonus = (upgrades.vipLounge - 1) * 0.28;
  return Math.min(5.0, +(base + foamBonus + waxBonus + loungeBonus).toFixed(2));
}

export function getEquipmentSpeedMultiplier(upgrades: UpgradeLevels): number {
  const washer = 1 + (upgrades.pressureWasher - 1) * 0.18;
  const dryer = 1 + (upgrades.dryerWax - 1) * 0.1;
  return washer * dryer;
}

export function getUtilityDiscount(ecoSolarLevel: number): number {
  return Math.max(0.35, 1 - (ecoSolarLevel - 1) * 0.18);
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
    description: 'Только органический трафик с улицы',
    costPerMin: 0,
    demandBoost: 0,
    trafficMultiplier: 1.0,
  },
  flyers: {
    id: 'flyers',
    title: 'Листовки на районе',
    description: '+18% поток машин и заметность среди соседей',
    costPerMin: 18,
    demandBoost: 0.55,
    trafficMultiplier: 1.18,
  },
  billboard: {
    id: 'billboard',
    title: 'Неоновый билборд',
    description: 'Зажигает крышный билборд! +36% поток клиентов',
    costPerMin: 45,
    demandBoost: 1.2,
    trafficMultiplier: 1.36,
  },
  radio: {
    id: 'radio',
    title: 'Городское радио и соцсети',
    description: 'Максимальный охват города, +58% поток и VIP-гости',
    costPerMin: 95,
    demandBoost: 2.0,
    trafficMultiplier: 1.58,
  },
};
