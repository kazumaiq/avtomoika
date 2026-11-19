import type {
  BusinessTypeId,
  CompetitorState,
  CorporateContract,
  CustomerSegment,
  DistrictId,
  DocumentId,
  FinancialPeriodBucket,
  FinancialReports,
  SpecialistRole,
  SpecialistStaff,
  WashTechId,
  WeatherType,
} from '../types/game';

export interface EntrepreneurLevelSpec {
  level: number;
  title: string;
  xpRequired: number;
  rewardCash: number;
  unlockNote: string;
}

const LEVEL_TITLES = [
  'Новичок гаража',
  'Самозанятый',
  'Частный мастер',
  'Владелец бокса',
  'Местный предприниматель',
  'Управляющий мойкой',
  'Районный лидер',
  'Инвестор',
  'Владелец сервиса',
  'Коммерсант',
  'Развивающий сеть',
  'Директор филиала',
  'Бизнес-стратег',
  'Региональный игрок',
  'Основатель холдинга',
  'Девелопер',
  'Владелец комплекса',
  'Корпоративный партнёр',
  'Сетевой магнат',
  'Промышленник',
  'Деловой лидер',
  'Премиум-девелопер',
  'Финансовый директор',
  'Владелец активов',
  'Городской инвестор',
  'Глава корпорации',
  'Индустриальный барон',
  'Архитектор империи',
  'Монополист проспекта',
  'Император AUTOMOIKA',
];

const LEVEL_UNLOCKS: Record<number, string> = {
  1: 'Спальный район, Ручная мойка',
  2: 'Разрешение на 2-й бокс, Листовки',
  3: 'Бесконтактная мойка, Банковский кредит',
  4: 'Шиномонтаж, Парковка, Найм Бухгалтера',
  5: 'Промышленная зона, Корпоративные контракты',
  6: 'Автоматическая портальная мойка, Кафе',
  7: 'Магазин автохимии, Найм Техника',
  8: 'Загородная зона, Химчистка салона',
  9: 'Автосервис, Найм Маркетолога',
  10: 'Магазин автозапчастей, Ипотека',
  11: 'Полировка кузова, Найм Управляющего',
  12: 'Центр города, Склад автотоваров',
  13: 'АЗС (Заправочная станция)',
  14: 'Детейлинг-комплекс, Детейлинг-центр',
  15: 'Основание Холдинга (группа компаний)',
  16: 'Деловой квартал, Кредитная линия',
  18: 'VIP-мойка люкс, Автосалон',
  20: 'Грузовая мойка, Крупные госконтракты',
  22: 'Премиальный район',
  25: 'Централизованные закупки холдинга',
  30: 'Абсолютная вершина бизнес-империи',
};

export const ENTREPRENEUR_LEVELS: EntrepreneurLevelSpec[] = Array.from({ length: 30 }, (_, i) => {
  const level = i + 1;
  // Smooth long-term XP curve: Lv.2 ~ 250 XP, Lv.5 ~ 2 200 XP, Lv.10 ~ 14 000 XP, Lv.20 ~ 110 000 XP, Lv.30 ~ 420 000 XP
  const xpRequired = level === 1 ? 0 : Math.round((105 * Math.pow(level - 1, 2.28)) / 10) * 10;
  const rewardCash = level === 1 ? 0 : Math.round((2500 + level * 1800) / 500) * 500;
  return {
    level,
    title: LEVEL_TITLES[i] ?? `Уровень ${level}`,
    xpRequired,
    rewardCash,
    unlockNote: LEVEL_UNLOCKS[level] ?? `Бонус репутации и лимита кредита`,
  };
});

export function getLevelForXp(xp: number): EntrepreneurLevelSpec {
  let current = ENTREPRENEUR_LEVELS[0];
  for (const spec of ENTREPRENEUR_LEVELS) {
    if (xp >= spec.xpRequired) current = spec;
    else break;
  }
  return current;
}

export interface CustomerSegmentSpec {
  id: CustomerSegment;
  labelRu: string;
  priceSensitivity: number; // higher = leaves faster when overpriced
  qualityDemand: number; // minimum quality expected
  willingnessMult: number; // multiplier on base fair price
  tipBonus: number; // additive % bonus (0..0.55)
}

export const CUSTOMER_SEGMENTS: Record<CustomerSegment, CustomerSegmentSpec> = {
  economy: {
    id: 'economy',
    labelRu: 'Экономный',
    priceSensitivity: 2.8,
    qualityDemand: 1.5,
    willingnessMult: 0.88,
    tipBonus: 0,
  },
  regular: {
    id: 'regular',
    labelRu: 'Обычный',
    priceSensitivity: 2.1,
    qualityDemand: 2.2,
    willingnessMult: 1.0,
    tipBonus: 0.04,
  },
  loyal: {
    id: 'loyal',
    labelRu: 'Постоянный',
    priceSensitivity: 1.6,
    qualityDemand: 2.8,
    willingnessMult: 1.08,
    tipBonus: 0.1,
  },
  corporate: {
    id: 'corporate',
    labelRu: 'Корпоративный',
    priceSensitivity: 1.8,
    qualityDemand: 3.1,
    willingnessMult: 1.15,
    tipBonus: 0.12,
  },
  premium: {
    id: 'premium',
    labelRu: 'Премиальный',
    priceSensitivity: 1.35,
    qualityDemand: 3.7,
    willingnessMult: 1.32,
    tipBonus: 0.22,
  },
  vip: {
    id: 'vip',
    labelRu: 'VIP',
    priceSensitivity: 1.15,
    qualityDemand: 4.1,
    willingnessMult: 1.52,
    tipBonus: 0.45,
  },
};

export interface WeatherSpec {
  id: WeatherType;
  labelRu: string;
  demandMult: number;
  dirtMult: number;
  utilityMult: number;
}

export const WEATHER_SPECS: Record<WeatherType, WeatherSpec> = {
  sunny: { id: 'sunny', labelRu: 'Солнечно', demandMult: 1.0, dirtMult: 0.9, utilityMult: 1.0 },
  rain: { id: 'rain', labelRu: 'Дождь', demandMult: 0.78, dirtMult: 1.05, utilityMult: 1.05 },
  after_rain: { id: 'after_rain', labelRu: 'После ливня', demandMult: 1.28, dirtMult: 1.2, utilityMult: 1.0 },
  mud_season: { id: 'mud_season', labelRu: 'Сезонная грязь', demandMult: 1.22, dirtMult: 1.25, utilityMult: 1.1 },
  snow: { id: 'snow', labelRu: 'Снегопад', demandMult: 0.92, dirtMult: 1.15, utilityMult: 1.18 },
};

export interface DistrictSpec {
  id: DistrictId;
  name: string;
  subtitle: string;
  unlockLevel: number;
  unlockCost: number;
  rentPerMin: number;
  landPrice: number;
  buildingPrice: number;
  /** Max potential cars per in-game minute in this district shared between all washes */
  marketCapacityPerMin: number;
  priceToleranceMult: number;
  rivalName: string;
  rivalStartBays: number;
  rivalStartQuality: number;
  rivalStartRep: number;
  rivalStartPrice: number;
  segmentWeights: Record<CustomerSegment, number>;
  accentColor: string;
}

export const DISTRICTS: Record<DistrictId, DistrictSpec> = {
  residential: {
    id: 'residential',
    name: 'Спальный район',
    subtitle: 'Недорогая аренда, стабильный бюджетный поток',
    unlockLevel: 1,
    unlockCost: 0,
    rentPerMin: 220,
    landPrice: 180_000,
    buildingPrice: 320_000,
    marketCapacityPerMin: 5.6,
    priceToleranceMult: 1.0,
    rivalName: 'TURBO SHINE',
    rivalStartBays: 2,
    rivalStartQuality: 2.35,
    rivalStartRep: 3.45,
    rivalStartPrice: 850,
    segmentWeights: { economy: 38, regular: 38, loyal: 14, corporate: 4, premium: 4, vip: 2 },
    accentColor: '#38BDF8',
  },
  industrial: {
    id: 'industrial',
    name: 'Промышленная зона',
    subtitle: 'Корпоративные автопарки, грузовики, большие участки',
    unlockLevel: 5,
    unlockCost: 160_000,
    rentPerMin: 720,
    landPrice: 240_000,
    buildingPrice: 440_000,
    marketCapacityPerMin: 6.4,
    priceToleranceMult: 1.08,
    rivalName: 'PROM WASH PRO',
    rivalStartBays: 2,
    rivalStartQuality: 3.1,
    rivalStartRep: 3.9,
    rivalStartPrice: 950,
    segmentWeights: { economy: 22, regular: 28, loyal: 12, corporate: 30, premium: 5, vip: 3 },
    accentColor: '#F59E0B',
  },
  suburban: {
    id: 'suburban',
    name: 'Загородная зона',
    subtitle: 'Недорогая земля, место под крупные комплексы',
    unlockLevel: 8,
    unlockCost: 290_000,
    rentPerMin: 480,
    landPrice: 150_000,
    buildingPrice: 360_000,
    marketCapacityPerMin: 5.8,
    priceToleranceMult: 1.12,
    rivalName: 'HIGHWAY CLEAN',
    rivalStartBays: 2,
    rivalStartQuality: 3.35,
    rivalStartRep: 4.0,
    rivalStartPrice: 1000,
    segmentWeights: { economy: 18, regular: 34, loyal: 22, corporate: 10, premium: 12, vip: 4 },
    accentColor: '#22C55E',
  },
  downtown: {
    id: 'downtown',
    name: 'Центр города',
    subtitle: 'Огромный трафик, высокая аренда и жёсткая конкуренция',
    unlockLevel: 12,
    unlockCost: 580_000,
    rentPerMin: 1_450,
    landPrice: 620_000,
    buildingPrice: 1_050_000,
    marketCapacityPerMin: 8.6,
    priceToleranceMult: 1.24,
    rivalName: 'METRO DETAIL',
    rivalStartBays: 3,
    rivalStartQuality: 3.8,
    rivalStartRep: 4.25,
    rivalStartPrice: 1150,
    segmentWeights: { economy: 12, regular: 30, loyal: 18, corporate: 14, premium: 18, vip: 8 },
    accentColor: '#00D4FF',
  },
  business: {
    id: 'business',
    name: 'Деловой квартал',
    subtitle: 'Премиум-седаны, корпоративные клиенты, высокий чек',
    unlockLevel: 16,
    unlockCost: 1_100_000,
    rentPerMin: 1_950,
    landPrice: 950_000,
    buildingPrice: 1_650_000,
    marketCapacityPerMin: 8.0,
    priceToleranceMult: 1.38,
    rivalName: 'PRIME LUXE WASH',
    rivalStartBays: 3,
    rivalStartQuality: 4.2,
    rivalStartRep: 4.45,
    rivalStartPrice: 1350,
    segmentWeights: { economy: 4, regular: 16, loyal: 16, corporate: 24, premium: 28, vip: 12 },
    accentColor: '#A855F7',
  },
  premium: {
    id: 'premium',
    name: 'Премиальный район',
    subtitle: 'Элитная недвижимость, VIP-клиенты и максимальная маржа',
    unlockLevel: 22,
    unlockCost: 2_400_000,
    rentPerMin: 2_800,
    landPrice: 1_850_000,
    buildingPrice: 3_100_000,
    marketCapacityPerMin: 7.5,
    priceToleranceMult: 1.55,
    rivalName: 'ROYAL CLUB SPA',
    rivalStartBays: 3,
    rivalStartQuality: 4.55,
    rivalStartRep: 4.65,
    rivalStartPrice: 1600,
    segmentWeights: { economy: 0, regular: 8, loyal: 14, corporate: 12, premium: 40, vip: 26 },
    accentColor: '#FACC15',
  },
};

export const DISTRICT_ORDER: DistrictId[] = [
  'residential',
  'industrial',
  'suburban',
  'downtown',
  'business',
  'premium',
];

export interface WashTechSpec {
  id: WashTechId;
  title: string;
  subtitle: string;
  unlockLevel: number;
  unlockCost: number;
  priceBonus: number; // additive Rubles to base tariff
  speedMult: number; // wash speed multiplier
  qualityBonus: number;
  utilityExtra: number; // extra water/chem cost per car
  minWorkers: number;
}

export const WASH_TECHNOLOGIES: Record<WashTechId, WashTechSpec> = {
  manual: {
    id: 'manual',
    title: 'Ручная мойка',
    subtitle: 'Классическая мойка АВД и губкой — базовый стандарт',
    unlockLevel: 1,
    unlockCost: 0,
    priceBonus: 0,
    speedMult: 1.0,
    qualityBonus: 0,
    utilityExtra: 0,
    minWorkers: 1,
  },
  touchless: {
    id: 'touchless',
    title: 'Бесконтактная мойка',
    subtitle: 'Быстрее на 15%, бережнее к лаку, выше расход химии',
    unlockLevel: 3,
    unlockCost: 26_000,
    priceBonus: 120,
    speedMult: 1.15,
    qualityBonus: 0.25,
    utilityExtra: 65,
    minWorkers: 1,
  },
  automatic_portal: {
    id: 'automatic_portal',
    title: 'Автоматический портал',
    subtitle: 'Высокий поток +30% к скорости, дороже обслуживание',
    unlockLevel: 6,
    unlockCost: 85_000,
    priceBonus: 180,
    speedMult: 1.3,
    qualityBonus: 0.35,
    utilityExtra: 110,
    minWorkers: 2,
  },
  dry_cleaning: {
    id: 'dry_cleaning',
    title: 'Химчистка салона',
    subtitle: 'Дольше мойка (-12%), но ощутимо выше чек и рейтинг',
    unlockLevel: 8,
    unlockCost: 135_000,
    priceBonus: 360,
    speedMult: 0.88,
    qualityBonus: 0.55,
    utilityExtra: 140,
    minWorkers: 2,
  },
  polishing: {
    id: 'polishing',
    title: 'Полировка кузова',
    subtitle: 'Зеркальный блеск для премиум-авто, требует 3 мастеров',
    unlockLevel: 11,
    unlockCost: 240_000,
    priceBonus: 520,
    speedMult: 0.84,
    qualityBonus: 0.75,
    utilityExtra: 185,
    minWorkers: 3,
  },
  detailing_pro: {
    id: 'detailing_pro',
    title: 'Детейлинг-комплекс',
    subtitle: 'Керамика + защита стекла, магнит для премиум-сегмента',
    unlockLevel: 14,
    unlockCost: 420_000,
    priceBonus: 740,
    speedMult: 0.8,
    qualityBonus: 1.0,
    utilityExtra: 250,
    minWorkers: 3,
  },
  vip_spa: {
    id: 'vip_spa',
    title: 'VIP-мойка Люкс',
    subtitle: 'Элитный уход для люксовых авто и кортежей',
    unlockLevel: 18,
    unlockCost: 780_000,
    priceBonus: 1_050,
    speedMult: 0.78,
    qualityBonus: 1.25,
    utilityExtra: 340,
    minWorkers: 4,
  },
  truck_wash: {
    id: 'truck_wash',
    title: 'Грузовая и коммерческая мойка',
    subtitle: 'Обслуживание автопарков и коммерческого транспорта',
    unlockLevel: 20,
    unlockCost: 920_000,
    priceBonus: 1_150,
    speedMult: 0.86,
    qualityBonus: 1.1,
    utilityExtra: 380,
    minWorkers: 4,
  },
};

export const WASH_TECH_ORDER: WashTechId[] = [
  'manual',
  'touchless',
  'automatic_portal',
  'dry_cleaning',
  'polishing',
  'detailing_pro',
  'vip_spa',
  'truck_wash',
];

export interface BusinessTypeSpec {
  id: BusinessTypeId;
  title: string;
  subtitle: string;
  mechanicNote: string;
  unlockLevel: number;
  buildCost: number;
  constructionMinutes: number;
  baseRevenuePerMin: number;
  baseExpensesPerMin: number;
  staffRequired: number;
  staffSalaryPerMin: number;
  reputationBoost: number;
  synergyBonus: string;
}

export const BUSINESS_TYPES: Record<BusinessTypeId, BusinessTypeSpec> = {
  parking: {
    id: 'parking',
    title: 'Платная парковка',
    subtitle: 'Стабильный низкорисковый поток авто рядом с мойкой',
    mechanicNote: '+6% к притоку клиентов на автомойку',
    unlockLevel: 4,
    buildCost: 95_000,
    constructionMinutes: 3,
    baseRevenuePerMin: 2_400,
    baseExpensesPerMin: 1_150,
    staffRequired: 1,
    staffSalaryPerMin: 450,
    reputationBoost: 0.05,
    synergyBonus: 'Приток +6%',
  },
  tire_shop: {
    id: 'tire_shop',
    title: 'Шиномонтаж',
    subtitle: 'Сезонные пики спроса и быстрая окупаемость',
    mechanicNote: 'Высокий доход в дождь и снегопад (+35%)',
    unlockLevel: 4,
    buildCost: 130_000,
    constructionMinutes: 4,
    baseRevenuePerMin: 3_350,
    baseExpensesPerMin: 1_750,
    staffRequired: 2,
    staffSalaryPerMin: 600,
    reputationBoost: 0.08,
    synergyBonus: 'Пик в непогоду',
  },
  cafe: {
    id: 'cafe',
    title: 'Автокафе',
    subtitle: 'Клиенты пьют кофе, пока ждут машину из бокса',
    mechanicNote: 'Увеличивает терпение очереди автомойки на +15%',
    unlockLevel: 6,
    buildCost: 175_000,
    constructionMinutes: 5,
    baseRevenuePerMin: 4_100,
    baseExpensesPerMin: 2_200,
    staffRequired: 2,
    staffSalaryPerMin: 650,
    reputationBoost: 0.12,
    synergyBonus: 'Терпение +15%',
  },
  chem_shop: {
    id: 'chem_shop',
    title: 'Магазин автохимии',
    subtitle: 'Розница + снижение стоимости химии для ваших моек',
    mechanicNote: 'Снижает расход химии на мойках на -12%',
    unlockLevel: 7,
    buildCost: 220_000,
    constructionMinutes: 5,
    baseRevenuePerMin: 4_900,
    baseExpensesPerMin: 2_650,
    staffRequired: 2,
    staffSalaryPerMin: 680,
    reputationBoost: 0.08,
    synergyBonus: 'Химия -12%',
  },
  car_service: {
    id: 'car_service',
    title: 'Автосервис (СТО)',
    subtitle: 'Ремонт и ТО автомобилей с высоким средним чеком',
    mechanicNote: 'Снижает стоимость ремонта вашего оборудования на -20%',
    unlockLevel: 9,
    buildCost: 340_000,
    constructionMinutes: 7,
    baseRevenuePerMin: 7_400,
    baseExpensesPerMin: 4_200,
    staffRequired: 3,
    staffSalaryPerMin: 850,
    reputationBoost: 0.15,
    synergyBonus: 'Ремонт -20%',
  },
  auto_parts: {
    id: 'auto_parts',
    title: 'Магазин автозапчастей',
    subtitle: 'Высокий оборот в связке с автосервисом и шиномонтажом',
    mechanicNote: '+15% выручки при наличии Автосервиса',
    unlockLevel: 10,
    buildCost: 420_000,
    constructionMinutes: 7,
    baseRevenuePerMin: 8_800,
    baseExpensesPerMin: 5_100,
    staffRequired: 3,
    staffSalaryPerMin: 800,
    reputationBoost: 0.1,
    synergyBonus: 'Связка с СТО',
  },
  warehouse: {
    id: 'warehouse',
    title: 'Склад автотоваров',
    subtitle: 'Логистический хаб для оптовых закупок всей сети',
    mechanicNote: 'Снижает операционные расходы всех предприятий на -8%',
    unlockLevel: 12,
    buildCost: 580_000,
    constructionMinutes: 9,
    baseRevenuePerMin: 11_200,
    baseExpensesPerMin: 6_400,
    staffRequired: 3,
    staffSalaryPerMin: 780,
    reputationBoost: 0.1,
    synergyBonus: 'Расходы сети -8%',
  },
  gas_station: {
    id: 'gas_station',
    title: 'Заправочная станция (АЗС)',
    subtitle: 'Мощный трафик-магнит на проспекте',
    mechanicNote: '+18% к общему потоку автомобилей в районе',
    unlockLevel: 13,
    buildCost: 840_000,
    constructionMinutes: 10,
    baseRevenuePerMin: 15_600,
    baseExpensesPerMin: 9_600,
    staffRequired: 4,
    staffSalaryPerMin: 850,
    reputationBoost: 0.18,
    synergyBonus: 'Трафик +18%',
  },
  detailing: {
    id: 'detailing',
    title: 'Детейлинг-центр',
    subtitle: 'Премиальный уход, оклейка плёнкой и керамика',
    mechanicNote: 'Привлекает премиум-клиентов и повышает рейтинг сети',
    unlockLevel: 14,
    buildCost: 1_050_000,
    constructionMinutes: 11,
    baseRevenuePerMin: 19_200,
    baseExpensesPerMin: 11_400,
    staffRequired: 4,
    staffSalaryPerMin: 1_050,
    reputationBoost: 0.25,
    synergyBonus: 'VIP-спрос +20%',
  },
  dealership: {
    id: 'dealership',
    title: 'Автосалон',
    subtitle: 'Флагманский актив бизнес-империи с крупнейшей выручкой',
    mechanicNote: 'Максимальный престиж и корпоративные клиенты',
    unlockLevel: 18,
    buildCost: 2_600_000,
    constructionMinutes: 15,
    baseRevenuePerMin: 38_000,
    baseExpensesPerMin: 24_500,
    staffRequired: 6,
    staffSalaryPerMin: 1_250,
    reputationBoost: 0.35,
    synergyBonus: 'Престиж империи',
  },
};

export const BUSINESS_TYPE_ORDER: BusinessTypeId[] = [
  'parking',
  'tire_shop',
  'cafe',
  'chem_shop',
  'car_service',
  'auto_parts',
  'warehouse',
  'gas_station',
  'detailing',
  'dealership',
];

export interface ResearchSpec {
  id: string;
  title: string;
  subtitle: string;
  cost: number;
  unlockLevel: number;
  requires?: string;
  effectSummary: string;
}

export const RESEARCH_TREE: ResearchSpec[] = [
  {
    id: 'crm_loyalty',
    title: 'CRM и карты лояльности',
    subtitle: 'Увеличивает долю постоянных клиентов и удержание очереди',
    cost: 35_000,
    unlockLevel: 3,
    effectSummary: '+12% привлекательности, -10% ухода из очереди',
  },
  {
    id: 'water_recovery_pro',
    title: 'Замкнутый цикл воды PRO',
    subtitle: 'Промышленная очистка снижает счета за воду и риск санпроверок',
    cost: 68_000,
    unlockLevel: 5,
    requires: 'crm_loyalty',
    effectSummary: '-18% коммунальные расходы, -20% риск проверок',
  },
  {
    id: 'bay_dispatch_ai',
    title: 'Умная диспетчеризация боксов',
    subtitle: 'Оптимизирует распределение мойщиков и снижает усталость',
    cost: 120_000,
    unlockLevel: 7,
    requires: 'crm_loyalty',
    effectSummary: '+10% скорость персонала, -25% усталость',
  },
  {
    id: 'preventive_maint',
    title: 'Предиктивное обслуживание',
    subtitle: 'Датчики давления замедляют износ оборудования вдвое',
    cost: 185_000,
    unlockLevel: 9,
    requires: 'water_recovery_pro',
    effectSummary: '-40% скорость износа оборудования',
  },
  {
    id: 'corp_licensing',
    title: 'Корпоративная сертификация',
    subtitle: 'Открывает доступ к крупным контрактам автопарков и госзаказам',
    cost: 290_000,
    unlockLevel: 12,
    requires: 'bay_dispatch_ai',
    effectSummary: '+20% награды по корпоративным контрактам',
  },
  {
    id: 'holding_charter',
    title: 'Устав бизнес-холдинга',
    subtitle: 'Юридическая база для создания единой корпорации AUTOMOIKA',
    cost: 550_000,
    unlockLevel: 15,
    requires: 'corp_licensing',
    effectSummary: 'Открывает создание Холдинга и общие закупки',
  },
];

export interface DocumentSpec {
  id: DocumentId;
  title: string;
  subtitle: string;
  cost: number;
  unlockLevel: number;
  requiredFor?: string;
}

export const DOCUMENTS_CATALOG: DocumentSpec[] = [
  {
    id: 'business_reg',
    title: 'Регистрация ИП / ООО',
    subtitle: 'Базовая постановка на налоговый учёт (обязательно)',
    cost: 0,
    unlockLevel: 1,
  },
  {
    id: 'lease_contract',
    title: 'Договор аренды площадки',
    subtitle: 'Защищает от штрафов за незаконную эксплуатацию земли',
    cost: 8_000,
    unlockLevel: 1,
  },
  {
    id: 'sanitary_permit',
    title: 'Санитарный паспорт (СЭС)',
    subtitle: 'Обязателен для проверок стоков и автохимии',
    cost: 14_000,
    unlockLevel: 2,
  },
  {
    id: 'fire_safety',
    title: 'Сертификат пожарной безопасности',
    subtitle: 'Снижает риск внеплановых штрафов МЧС',
    cost: 16_000,
    unlockLevel: 3,
  },
  {
    id: 'staff_docs',
    title: 'Кадровый пакет и медкнижки',
    subtitle: 'Официальное оформление сотрудников без штрафов',
    cost: 12_000,
    unlockLevel: 2,
  },
  {
    id: 'bay_permit_2',
    title: 'Разрешение на строительство Бокса #2',
    subtitle: 'Требуется для расширения мойки до 2 боксов',
    cost: 10_000,
    unlockLevel: 2,
    requiredFor: 'Бокс #2',
  },
  {
    id: 'bay_permit_3',
    title: 'Разрешение на строительство Бокса #3',
    subtitle: 'Требуется для расширения мойки до 3 боксов',
    cost: 28_000,
    unlockLevel: 5,
    requiredFor: 'Бокс #3',
  },
  {
    id: 'bay_permit_4',
    title: 'Разрешение на строительство Бокса #4',
    subtitle: 'Требуется для расширения мойки до 4 боксов',
    cost: 65_000,
    unlockLevel: 9,
    requiredFor: 'Бокс #4',
  },
];

export interface SpecialistSpec {
  role: SpecialistRole;
  title: string;
  subtitle: string;
  defaultName: string;
  unlockLevel: number;
  hireCost: number;
  salaryPerMin: number;
}

export const SPECIALIST_CATALOG: SpecialistSpec[] = [
  {
    role: 'administrator',
    title: 'Администратор',
    subtitle: 'Ускоряет приём авто и снижает усталость мойщиков (-30%)',
    defaultName: 'Ольга Смирнова',
    unlockLevel: 2,
    hireCost: 14_000,
    salaryPerMin: 520,
  },
  {
    role: 'accountant',
    title: 'Бухгалтер',
    subtitle: 'Авто-подача деклараций и снижение риска штрафов на 70%',
    defaultName: 'Елена Волкова',
    unlockLevel: 4,
    hireCost: 22_000,
    salaryPerMin: 680,
  },
  {
    role: 'technician',
    title: 'Технический специалист',
    subtitle: 'Замедляет износ оборудования на 45% и чинит поломки автоматически',
    defaultName: 'Сергей Петров',
    unlockLevel: 7,
    hireCost: 34_000,
    salaryPerMin: 820,
  },
  {
    role: 'marketer',
    title: 'Маркетолог',
    subtitle: 'Повышает эффективность рекламы (+25%) и привлекает корпоративных клиентов',
    defaultName: 'Артём Крылов',
    unlockLevel: 9,
    hireCost: 48_000,
    salaryPerMin: 950,
  },
  {
    role: 'manager',
    title: 'Операционный менеджер',
    subtitle: 'Оптимизирует смены (+12% скорость всех боксов) и контролирует качество',
    defaultName: 'Дмитрий Орлов',
    unlockLevel: 10,
    hireCost: 65_000,
    salaryPerMin: 1_150,
  },
  {
    role: 'branch_director',
    title: 'Управляющий филиалами',
    subtitle: 'Повышает чистую эффективность всех сторонних предприятий на +18%',
    defaultName: 'Виктор Громов',
    unlockLevel: 11,
    hireCost: 95_000,
    salaryPerMin: 1_450,
  },
];

export interface LoanProductSpec {
  kind: 'business' | 'mortgage' | 'credit_line';
  title: string;
  subtitle: string;
  amount: number;
  annualRate: number;
  days: number;
  minLevel: number;
  minCreditScore: number;
}

export const LOAN_PRODUCTS: LoanProductSpec[] = [
  {
    kind: 'business',
    title: 'Бизнес-кредит «Старт»',
    subtitle: 'Оборотные средства на оборудование и персонал',
    amount: 60_000,
    annualRate: 0.18,
    days: 8,
    minLevel: 3,
    minCreditScore: 520,
  },
  {
    kind: 'business',
    title: 'Инвестиционный кредит',
    subtitle: 'На открытие новых боксов или покупку предприятия',
    amount: 220_000,
    annualRate: 0.16,
    days: 12,
    minLevel: 6,
    minCreditScore: 600,
  },
  {
    kind: 'mortgage',
    title: 'Коммерческая ипотека',
    subtitle: 'Долгосрочное финансирование недвижимости и зданий',
    amount: 650_000,
    annualRate: 0.13,
    days: 20,
    minLevel: 10,
    minCreditScore: 660,
  },
  {
    kind: 'credit_line',
    title: 'Корпоративная кредитная линия',
    subtitle: 'Крупный капитал для экспансии в центр и премиум-районы',
    amount: 1_500_000,
    annualRate: 0.12,
    days: 24,
    minLevel: 16,
    minCreditScore: 720,
  },
];

export const CONTRACT_TEMPLATES: Array<Omit<CorporateContract, 'id' | 'completedCars' | 'daysLeft' | 'active'>> = [
  {
    clientName: 'Таксопарк «Городской Экспресс»',
    sector: 'taxi',
    requiredCars: 18,
    minQuality: 2.2,
    minBranches: 1,
    minStaff: 2,
    reward: 24_000,
    penalty: 6_000,
    daysTotal: 3,
  },
  {
    clientName: 'Служба доставки «БыстроЕда»',
    sector: 'delivery',
    requiredCars: 26,
    minQuality: 2.6,
    minBranches: 1,
    minStaff: 2,
    reward: 38_000,
    penalty: 9_500,
    daysTotal: 4,
  },
  {
    clientName: 'Курьерская сеть «ПочтаЭкспресс»',
    sector: 'courier',
    requiredCars: 35,
    minQuality: 3.1,
    minBranches: 2,
    minStaff: 3,
    reward: 62_000,
    penalty: 15_000,
    daysTotal: 4,
  },
  {
    clientName: 'Каршеринг «ДрайвСити»',
    sector: 'rental',
    requiredCars: 48,
    minQuality: 3.5,
    minBranches: 2,
    minStaff: 4,
    reward: 95_000,
    penalty: 24_000,
    daysTotal: 5,
  },
  {
    clientName: 'Корпоративный парк «ТехноГрупп»',
    sector: 'fleet',
    requiredCars: 60,
    minQuality: 4.0,
    minBranches: 3,
    minStaff: 5,
    reward: 145_000,
    penalty: 35_000,
    daysTotal: 5,
  },
  {
    clientName: 'Госавтопарк Администрации',
    sector: 'gov',
    requiredCars: 75,
    minQuality: 4.4,
    minBranches: 4,
    minStaff: 6,
    reward: 230_000,
    penalty: 55_000,
    daysTotal: 6,
  },
];

export function createEmptyPeriodBucket(): FinancialPeriodBucket {
  return {
    washRevenue: 0,
    enterpriseRevenue: 0,
    contractRevenue: 0,
    rentIncome: 0,
    salaries: 0,
    utilities: 0,
    rent: 0,
    maintenance: 0,
    ads: 0,
    taxes: 0,
    loanInterest: 0,
    insurance: 0,
    fines: 0,
    upgrades: 0,
    carsWashed: 0,
  };
}

export function createInitialReports(): FinancialReports {
  return {
    today: createEmptyPeriodBucket(),
    week: createEmptyPeriodBucket(),
    month: createEmptyPeriodBucket(),
    year: createEmptyPeriodBucket(),
  };
}

export function createInitialSpecialists(): SpecialistStaff[] {
  return SPECIALIST_CATALOG.map((s) => ({
    id: `spec-${s.role}`,
    role: s.role,
    name: s.defaultName,
    level: 1,
    salaryPerMin: s.salaryPerMin,
    hireCost: s.hireCost,
    hired: false,
  }));
}

export function createInitialDistrictRival(districtId: DistrictId): CompetitorState {
  const d = DISTRICTS[districtId];
  return {
    name: d.rivalName,
    districtId,
    bays: d.rivalStartBays,
    staffCount: d.rivalStartBays,
    price: d.rivalStartPrice,
    quality: d.rivalStartQuality,
    speedMultiplier: 1.08 + (d.rivalStartBays - 2) * 0.14,
    reputation: d.rivalStartRep,
    carsWashed: 0,
    balance: 45_000 + d.unlockLevel * 8_000,
    totalRevenue: 0,
    totalExpenses: 0,
    revenuePerMin: 0,
    expensesPerMin: d.rentPerMin + d.rivalStartBays * 950,
    profitPerMin: 0,
    avgCheck: d.rivalStartPrice,
    adLevel: 0,
    strategy: 'mass_flow',
    promoActive: false,
    promoTimer: 42,
    lastUpgradeDay: 1,
  };
}
