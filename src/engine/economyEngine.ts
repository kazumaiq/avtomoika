import {
  BUSINESS_TYPES,
  CUSTOMER_SEGMENTS,
  DISTRICTS,
  WASH_TECHNOLOGIES,
  WEATHER_SPECS,
} from '../config/empire';
import { CITY_EVENTS } from '../config/progression';
import {
  AD_CAMPAIGNS,
  BAY_UTILITY_PER_MIN,
  WASH_UTILITY_COST,
  getEquipmentSpeedMultiplier,
  getFairWashPrice,
  getPlayerQualityScore,
  getUtilityDiscount,
} from '../config/upgrades';
import type {
  ActiveCityEvent,
  AdCampaignId,
  CompetitorState,
  CompetitorStrategy,
  CustomerSegment,
  DistrictId,
  EconomyMetrics,
  EmpireState,
  FinancialPeriodBucket,
  FinancialReports,
  OwnedBusiness,
  UpgradeLevels,
  VehicleCategory,
  WeatherType,
  WorkerProfile,
} from '../types/game';

export interface WashPayoutBreakdown {
  baseTariff: number;
  techBonus: number;
  qualityTip: number;
  comboBonus: number;
  vipBonus: number;
  eventBonus: number;
  total: number;
  utilityCost: number;
}

export interface ExpenseBreakdownPerMin {
  salaries: number;
  specialistSalaries: number;
  rent: number;
  utilities: number;
  maintenance: number;
  ads: number;
  insurance: number;
  total: number;
}

export interface MarketDemandResult {
  totalDistrictDemandPerMin: number;
  playerShare: number;
  compShare: number;
  playerDemandPerMin: number;
  compDemandPerMin: number;
  playerQuality: number;
  playerFairPrice: number;
}

export interface TaxAuditResult {
  fine: number;
  reason: string;
}

/**
 * Pure, centralized wash payout calculation.
 * All percentage bonuses are ADDITIVE and strictly capped at +65% above (baseTariff + techBonus)
 * to completely prevent multiplicative snowballing.
 */
export function calculateWashPayout(params: {
  washPrice: number;
  happyHourActive: boolean;
  vehiclePriceMult: number;
  segment: CustomerSegment;
  isVip: boolean;
  activeWashTech: EconomyMetrics['activeWashTech'];
  upgrades: UpgradeLevels;
  workerQuality: number;
  combo: number;
  equipmentCondition: number;
  activeEvent: ActiveCityEvent | null;
  weather: WeatherType;
  hasChemShop: boolean;
  hasHoldingProcurement: boolean;
  hasWaterResearch: boolean;
}): WashPayoutBreakdown {
  const effectivePrice = params.happyHourActive ? params.washPrice * 0.85 : params.washPrice;
  const baseTariff = Math.round(effectivePrice * params.vehiclePriceMult);
  const tech = WASH_TECHNOLOGIES[params.activeWashTech] ?? WASH_TECHNOLOGIES.manual;
  const techBonus = tech.priceBonus;
  const baseSum = Math.max(250, baseTariff + techBonus);

  // Additive bonus rates (strictly bounded, never multiplied together)
  const qualityTipRate = Math.max(
    -0.08,
    Math.min(
      0.30,
      (params.workerQuality - 1.0) * 0.08 +
        (params.upgrades.foamSystem - 1) * 0.035 +
        (params.upgrades.dryerWax - 1) * 0.025 +
        (params.upgrades.vipLounge - 1) * 0.02
    )
  );

  // Combo capped at +12% (1 step per 3 consecutive cars)
  const comboRate = Math.min(0.12, Math.floor(params.combo / 3) * 0.02);

  // VIP / segment tip is additive (+32% for VIP, NOT x2.35)
  const segSpec = CUSTOMER_SEGMENTS[params.segment] ?? CUSTOMER_SEGMENTS.regular;
  const vipRate = params.isVip ? 0.32 : segSpec.tipBonus * 0.5;

  const eventSpec = params.activeEvent ? CITY_EVENTS[params.activeEvent.id] : null;
  const eventRate = eventSpec ? Math.max(-0.15, Math.min(0.18, eventSpec.tipBonus)) : 0;

  // Worn equipment reduces perceived quality & tips
  const wearPenaltyRate =
    params.equipmentCondition < 50 ? ((50 - params.equipmentCondition) / 50) * 0.18 : 0;

  const rawRate = qualityTipRate + comboRate + vipRate + eventRate - wearPenaltyRate;
  const clampedRate = Math.max(-0.25, Math.min(0.65, rawRate));
  const scale = rawRate > 0 && rawRate > clampedRate ? clampedRate / rawRate : 1;

  const qualityTip = Math.round(baseSum * qualityTipRate * scale);
  const comboBonus = Math.round(baseSum * comboRate * scale);
  const vipBonus = Math.round(baseSum * vipRate * scale);
  const eventBonus = Math.round(baseSum * eventRate * scale);
  const wearDeduction = Math.round(baseSum * wearPenaltyRate);

  const total = Math.max(
    250,
    Math.round((baseSum + qualityTip + comboBonus + vipBonus + eventBonus - wearDeduction) / 10) * 10
  );

  // Real per-car water, electricity & chemical cost
  const weatherSpec = WEATHER_SPECS[params.weather] ?? WEATHER_SPECS.sunny;
  const utilDiscount = getUtilityDiscount(params.upgrades.ecoSolar);
  const chemMult = params.hasChemShop ? 0.88 : 1.0;
  const holdingMult = params.hasHoldingProcurement ? 0.94 : 1.0;
  const waterResMult = params.hasWaterResearch ? 0.82 : 1.0;
  const eventUtilMult = eventSpec ? eventSpec.utilityMultiplier : 1.0;
  const wearUtilMult = 1 + Math.max(0, 80 - params.equipmentCondition) * 0.0045;

  const utilityCost = Math.round(
    (WASH_UTILITY_COST + tech.utilityExtra) *
      utilDiscount *
      weatherSpec.utilityMult *
      eventUtilMult *
      wearUtilMult *
      chemMult *
      holdingMult *
      waterResMult
  );

  return {
    baseTariff,
    techBonus,
    qualityTip,
    comboBonus,
    vipBonus,
    eventBonus,
    total,
    utilityCost,
  };
}

/**
 * Computes effective wash speed multiplier for a player bay including wear, fatigue, tech, and specialists.
 */
export function getEffectivePlayerWashSpeed(params: {
  upgrades: UpgradeLevels;
  activeWashTech: EconomyMetrics['activeWashTech'];
  workerSpeed: number;
  workerMorale: number;
  workerFatigue: number;
  equipmentCondition: number;
  happyHourActive: boolean;
  hasDispatchResearch: boolean;
  hasManagerSpecialist: boolean;
}): number {
  const equipMult = getEquipmentSpeedMultiplier(params.upgrades);
  const techMult = (WASH_TECHNOLOGIES[params.activeWashTech] ?? WASH_TECHNOLOGIES.manual).speedMult;
  const fatigueMult =
    params.workerFatigue > 65
      ? Math.max(0.68, 1 - (params.workerFatigue - 65) * 0.009)
      : 1.0;
  const conditionMult =
    params.equipmentCondition < 15
      ? 0.38
      : params.equipmentCondition < 70
        ? 0.68 + (params.equipmentCondition / 70) * 0.32
        : 1.0;

  const researchMult = params.hasDispatchResearch ? 1.1 : 1.0;
  const managerMult = params.hasManagerSpecialist ? 1.12 : 1.0;
  const happyMult = params.happyHourActive ? 1.15 : 1.0;

  return Math.max(
    0.35,
    params.workerSpeed *
      params.workerMorale *
      fatigueMult *
      equipMult *
      techMult *
      conditionMult *
      researchMult *
      managerMult *
      happyMult
  );
}

/**
 * Picks a customer segment based on active district demographics, reputation, and city events.
 */
export function pickCustomerSegment(
  districtId: DistrictId,
  reputation: number,
  activeEvent: ActiveCityEvent | null,
  hasDetailing: boolean,
  hasMarketer: boolean,
  rng: () => number = Math.random
): CustomerSegment {
  const district = DISTRICTS[districtId] ?? DISTRICTS.residential;
  const w = { ...district.segmentWeights };

  if (reputation >= 4.0) {
    w.loyal += 6;
    w.premium += 5;
    w.vip += 3;
  }
  if (hasDetailing) {
    w.premium += 6;
    w.vip += 4;
  }
  if (hasMarketer) {
    w.corporate += 6;
    w.loyal += 4;
  }
  if (activeEvent?.id === 'vip_convoy') {
    w.vip += 18;
    w.premium += 10;
  } else if (activeEvent?.id === 'corp_offer') {
    w.corporate += 16;
  } else if (activeEvent?.id === 'economic_crisis') {
    w.economy += 18;
    w.vip = Math.max(0, w.vip - 4);
  }

  const entries = Object.entries(w) as Array<[CustomerSegment, number]>;
  const total = entries.reduce((sum, [, val]) => sum + Math.max(0, val), 0);
  if (total <= 0) return 'regular';
  let roll = rng() * total;
  for (const [seg, val] of entries) {
    roll -= Math.max(0, val);
    if (roll <= 0) return seg;
  }
  return 'regular';
}

export function getVehicleCategoryForSegment(
  segment: CustomerSegment,
  rng: () => number = Math.random
): VehicleCategory {
  const r = rng();
  switch (segment) {
    case 'economy':
      return r < 0.55 ? 'budget' : r < 0.85 ? 'hatchback' : 'sedan';
    case 'regular':
      return r < 0.35 ? 'sedan' : r < 0.65 ? 'hatchback' : r < 0.88 ? 'suv' : 'budget';
    case 'loyal':
      return r < 0.4 ? 'sedan' : r < 0.78 ? 'suv' : 'hatchback';
    case 'corporate':
      return r < 0.55 ? 'sedan' : 'suv';
    case 'premium':
      return r < 0.45 ? 'suv' : r < 0.8 ? 'premium' : 'sports';
    case 'vip':
      return r < 0.58 ? 'premium' : 'sports';
  }
}

/**
 * Finite district market demand split between player and local competitor.
 */
export function calculateMarketDemand(params: {
  districtId: DistrictId;
  day: number;
  hourOfDay: number;
  weather: WeatherType;
  activeEvent: ActiveCityEvent | null;
  playerEco: EconomyMetrics;
  playerUpgrades: UpgradeLevels;
  playerQueueLen: number;
  comp: CompetitorState;
  compQueueLen: number;
  hasCrmResearch: boolean;
  hasMarketer: boolean;
  hasGasStation: boolean;
  hasParking: boolean;
}): MarketDemandResult {
  const district = DISTRICTS[params.districtId] ?? DISTRICTS.residential;
  const weatherSpec = WEATHER_SPECS[params.weather] ?? WEATHER_SPECS.sunny;
  const eventSpec = params.activeEvent ? CITY_EVENTS[params.activeEvent.id] : null;

  // Day-of-week cycle (Mon..Sun): Fri/Sat/Sun stronger demand
  const dayOfWeek = ((params.day - 1) % 7) + 1;
  const dayOfWeekMult = dayOfWeek >= 6 ? 1.18 : dayOfWeek === 5 ? 1.1 : 0.96;

  // Time-of-day wave (07:00..22:00)
  const h = params.hourOfDay;
  const timeWave =
    h < 9.5 ? 0.82 : h >= 16.5 && h <= 19.8 ? 1.22 : h > 20.5 ? 0.85 : 1.02;

  const synergyMult =
    (params.hasGasStation ? 1.18 : 1.0) * (params.hasParking ? 1.06 : 1.0);

  const totalDistrictDemandPerMin =
    district.marketCapacityPerMin *
    weatherSpec.demandMult *
    dayOfWeekMult *
    timeWave *
    (eventSpec ? eventSpec.trafficMultiplier : 1.0) *
    synergyMult;

  const tech = WASH_TECHNOLOGIES[params.playerEco.activeWashTech] ?? WASH_TECHNOLOGIES.manual;
  const wearQualPenalty =
    params.playerEco.equipmentCondition < 50
      ? ((50 - params.playerEco.equipmentCondition) / 50) * 0.65
      : 0;
  const playerQuality = Math.max(
    1.0,
    Math.min(
      5.0,
      +(getPlayerQualityScore(params.playerUpgrades) + tech.qualityBonus - wearQualPenalty).toFixed(2)
    )
  );
  const playerFairPrice = Math.round(
    (getFairWashPrice(playerQuality, params.playerEco.reputation) * district.priceToleranceMult) / 50
  ) * 50;

  const playerEffPrice =
    params.playerEco.happyHourRemaining > 0
      ? params.playerEco.washPrice * 0.85
      : params.playerEco.washPrice;
  const compEffPrice = params.comp.promoActive ? params.comp.price * 0.82 : params.comp.price;

  // Multiplicative price elasticity
  const pPriceMult =
    playerEffPrice <= playerFairPrice
      ? Math.min(1.22, 1 + ((playerFairPrice - playerEffPrice) / playerFairPrice) * 0.42)
      : Math.max(0.12, Math.pow(playerFairPrice / playerEffPrice, 2.4));

  const compFairPrice = Math.round(
    (getFairWashPrice(params.comp.quality, params.comp.reputation) * district.priceToleranceMult) / 50
  ) * 50;
  const cPriceMult =
    compEffPrice <= compFairPrice
      ? Math.min(1.22, 1 + ((compFairPrice - compEffPrice) / compFairPrice) * 0.45)
      : Math.max(0.18, Math.pow(compFairPrice / compEffPrice, 2.15));

  const priceGapBonus = Math.max(-0.65, Math.min(0.55, (compEffPrice - playerEffPrice) / 420));
  const adBoost =
    AD_CAMPAIGNS[params.playerEco.adCampaign].demandBoost * (params.hasMarketer ? 1.25 : 1.0);
  const crmBoost = params.hasCrmResearch ? 0.35 : 0;
  const happyBoost = params.playerEco.happyHourRemaining > 0 ? 0.65 : 0;
  const pQueuePenalty = Math.max(
    0.22,
    1 - params.playerQueueLen * (0.12 - (params.playerUpgrades.vipLounge - 1) * 0.018)
  );

  const pBase = Math.max(
    0.3,
    0.6 +
      params.playerEco.reputation * 0.48 +
      playerQuality * 0.42 +
      (params.playerUpgrades.bays - 1) * 0.24 +
      adBoost +
      crmBoost +
      happyBoost +
      priceGapBonus
  );
  const pScore = Math.max(0.15, pBase * pPriceMult * pQueuePenalty);

  const cAdBoost = params.comp.adLevel * 0.45 + (params.comp.promoActive ? 0.75 : 0.15);
  const cQueuePenalty = Math.max(0.24, 1 - params.compQueueLen * 0.11);
  const cBase = Math.max(
    0.35,
    0.6 +
      params.comp.reputation * 0.48 +
      params.comp.quality * 0.42 +
      (params.comp.bays - 1) * 0.26 +
      cAdBoost -
      priceGapBonus * 0.85
  );
  const cScore = Math.max(0.2, cBase * cPriceMult * cQueuePenalty);

  const playerShare = Math.min(0.86, Math.max(0.10, pScore / (pScore + cScore)));
  const compShare = 1 - playerShare;

  return {
    totalDistrictDemandPerMin,
    playerShare,
    compShare,
    playerDemandPerMin: totalDistrictDemandPerMin * playerShare,
    compDemandPerMin: totalDistrictDemandPerMin * compShare,
    playerQuality,
    playerFairPrice,
  };
}

/**
 * Centralized calculation of all recurring player expenses per in-game minute.
 */
export function calculatePlayerExpensesPerMin(params: {
  workers: WorkerProfile[];
  upgrades: UpgradeLevels;
  adCampaign: AdCampaignId;
  equipmentCondition: number;
  empire: EmpireState;
  activeEvent: ActiveCityEvent | null;
}): ExpenseBreakdownPerMin {
  const district = DISTRICTS[params.empire.activeDistrict] ?? DISTRICTS.residential;
  const weatherSpec = WEATHER_SPECS[params.empire.weather] ?? WEATHER_SPECS.sunny;
  const eventSpec = params.activeEvent ? CITY_EVENTS[params.activeEvent.id] : null;

  const hasWarehouse = params.empire.businesses.some(
    (b) => !b.underConstruction && b.type === 'warehouse'
  );
  const hasWaterRes = params.empire.unlockedResearchIds.includes('water_recovery_pro');
  const hasHoldingProc = params.empire.holding.founded && params.empire.holding.centralProcurement;
  const ownsDistrictBuilding = params.empire.properties.some(
    (p) =>
      p.districtId === params.empire.activeDistrict &&
      p.kind === 'building' &&
      !p.underConstruction
  );

  const salaries = params.workers.reduce((sum, w) => sum + w.salaryPerMin, 0);
  const specialistSalaries = params.empire.specialists.reduce(
    (sum, s) => sum + (s.hired ? s.salaryPerMin : 0),
    0
  );

  // Owning a building in the district cuts rent in half!
  const rent = Math.round(district.rentPerMin * (ownsDistrictBuilding ? 0.5 : 1.0));

  const utilDiscount = getUtilityDiscount(params.upgrades.ecoSolar);
  const wearUtilMult = 1 + Math.max(0, 75 - params.equipmentCondition) * 0.006;
  const utilities = Math.round(
    params.upgrades.bays *
      BAY_UTILITY_PER_MIN *
      utilDiscount *
      weatherSpec.utilityMult *
      (eventSpec ? eventSpec.utilityMultiplier : 1.0) *
      wearUtilMult *
      (hasWaterRes ? 0.82 : 1.0) *
      (hasHoldingProc ? 0.94 : 1.0)
  );

  const maintenance = Math.round(
    (params.upgrades.bays * 70 + Math.max(0, 100 - params.equipmentCondition) * 3) *
      (hasWarehouse ? 0.92 : 1.0) *
      (hasHoldingProc ? 0.94 : 1.0)
  );

  const ads = AD_CAMPAIGNS[params.adCampaign].costPerMin;
  const insurance = params.empire.bank.insuranceActive
    ? params.empire.bank.insuranceCostPerMin
    : 0;

  return {
    salaries,
    specialistSalaries,
    rent,
    utilities,
    maintenance,
    ads,
    insurance,
    total: salaries + specialistSalaries + rent + utilities + maintenance + ads + insurance,
  };
}

/**
 * Autonomous, financially self-sustaining Competitor AI.
 * The competitor has its own balance, real expenses, 5 dynamic strategies,
 * and ONLY upgrades/expands when it has genuinely earned enough profit!
 */
export function stepCompetitorEconomy(params: {
  comp: CompetitorState;
  playerPrice: number;
  playerQuality: number;
  playerShare: number;
  day: number;
  dtMinutes: number;
  revenueEarnedInStep: number;
  carsWashedInStep: number;
}): { next: CompetitorState; announcement?: string } {
  const c = { ...params.comp };
  const district = DISTRICTS[c.districtId] ?? DISTRICTS.residential;

  // Real competitor operating costs per minute
  const expensesPerMin = Math.round(
    district.rentPerMin * 0.95 +
      c.bays * 440 +
      c.staffCount * 440 +
      c.adLevel * 780 +
      (c.promoActive ? 350 : 0)
  );
  const stepExpense = Math.round(expensesPerMin * params.dtMinutes);
  const stepRev = Math.round(params.revenueEarnedInStep);

  c.balance = Math.round(c.balance + stepRev - stepExpense);
  c.totalExpenses += stepExpense;
  c.expensesPerMin = expensesPerMin;

  if (params.dtMinutes > 0) {
    const instRevPerMin = stepRev / params.dtMinutes;
    c.revenuePerMin = Math.round(c.revenuePerMin * 0.55 + instRevPerMin * 0.45);
  }
  c.profitPerMin = c.revenuePerMin - c.expensesPerMin;

  if (params.carsWashedInStep > 0) {
    const stepAvg = stepRev / params.carsWashedInStep;
    c.avgCheck = Math.round(c.avgCheck * 0.65 + stepAvg * 0.35);
  }

  // Dynamic strategy selection based on real financial health & market position
  let strategy: CompetitorStrategy = c.strategy;
  if (c.profitPerMin < -250 || c.balance < 18_000) {
    strategy = 'cost_cutting';
  } else if (c.balance >= 70_000 && (c.bays < 4 || c.quality < 4.7)) {
    strategy = 'expansion_invest';
  } else if (params.playerShare > 0.56 && c.balance >= 24_000) {
    strategy = 'aggressive_price';
  } else if (c.quality >= params.playerQuality + 0.35 || district.priceToleranceMult >= 1.2) {
    strategy = 'premium_service';
  } else {
    strategy = 'mass_flow';
  }
  c.strategy = strategy;

  const compFair = Math.round(
    (getFairWashPrice(c.quality, c.reputation) * district.priceToleranceMult) / 50
  ) * 50;

  let desiredPrice = c.price;
  let announcement: string | undefined;

  if (strategy === 'cost_cutting') {
    c.adLevel = Math.max(0, c.adLevel - 1);
    c.promoActive = false;
    desiredPrice = Math.min(compFair, Math.max(800, c.price + 50));
  } else if (strategy === 'aggressive_price') {
    desiredPrice = Math.max(700, Math.min(compFair, params.playerPrice - 50));
    if (c.adLevel < 2 && c.balance > 32_000) {
      c.adLevel += 1;
    }
    if (!c.promoActive && c.balance > 28_000 && params.playerShare > 0.6) {
      c.promoActive = true;
      c.promoTimer = 36;
      announcement = `${c.name}: агрессивная акция -18%!`;
    }
  } else if (strategy === 'premium_service') {
    desiredPrice = Math.min(1_950, Math.round((compFair * 1.04) / 50) * 50);
    c.promoActive = false;
  } else if (strategy === 'mass_flow') {
    desiredPrice = Math.min(compFair, Math.max(750, params.playerPrice));
    if (c.adLevel < 1 && c.balance > 35_000) {
      c.adLevel = 1;
    }
  } else if (strategy === 'expansion_invest') {
    desiredPrice = Math.min(compFair, Math.max(850, params.playerPrice));
    const bayCost = c.bays === 2 ? 68_000 : c.bays === 3 ? 165_000 : 999_999;
    const equipCost = Math.round(28_000 + (c.quality - 2.0) * 22_000);

    if (c.bays < 4 && c.balance >= bayCost + 18_000) {
      c.balance -= bayCost;
      c.bays += 1;
      c.staffCount = Math.max(c.staffCount, c.bays);
      c.lastUpgradeDay = params.day;
      announcement = `${c.name} инвестировал прибыль и открыл Бокс #${c.bays}!`;
    } else if (c.quality < 4.75 && c.balance >= equipCost + 15_000) {
      c.balance -= equipCost;
      c.quality = Math.min(4.8, +(c.quality + 0.22).toFixed(2));
      c.speedMultiplier = Math.min(1.85, +(c.speedMultiplier + 0.06).toFixed(2));
      c.lastUpgradeDay = params.day;
      announcement = `${c.name} обновил оборудование (качество ${c.quality.toFixed(1)}★)`;
    }
  }

  // Gradual price step (±50 ₽ per decision tick)
  const priceDelta = Math.max(-50, Math.min(50, desiredPrice - c.price));
  c.price = Math.max(650, Math.min(2_000, Math.round((c.price + priceDelta) / 50) * 50));

  // Keep staff aligned with bays when affordable
  if (c.staffCount < c.bays && c.balance > 22_000) {
    c.staffCount = c.bays;
  }

  return { next: c, announcement };
}

/**
 * Steps a single player-owned auxiliary enterprise (car service, tire shop, cafe, etc.)
 * for `dtMinutes` in-game minutes.
 */
export function stepOwnedBusiness(
  biz: OwnedBusiness,
  weather: WeatherType,
  hasBranchDirector: boolean,
  hasWarehouse: boolean,
  hasCarService: boolean,
  hasHoldingProcurement: boolean,
  hasTechnician: boolean,
  dtMinutes: number
): {
  next: OwnedBusiness;
  revenueDelta: number;
  expenseDelta: number;
  justCompleted: boolean;
} {
  const spec = BUSINESS_TYPES[biz.type];
  const district = DISTRICTS[biz.districtId] ?? DISTRICTS.residential;

  if (biz.underConstruction) {
    const left = Math.max(0, biz.constructionMinutesLeft - dtMinutes);
    const done = left <= 0;
    return {
      next: {
        ...biz,
        constructionMinutesLeft: left,
        underConstruction: !done,
      },
      revenueDelta: 0,
      expenseDelta: 0,
      justCompleted: done,
    };
  }

  const levelRevMult = 1 + (biz.level - 1) * 0.28;
  const levelExpMult = 1 + (biz.level - 1) * 0.20;
  const conditionMult = biz.condition < 40 ? 0.65 : 0.8 + (biz.condition / 100) * 0.2;
  const weatherBoost =
    biz.type === 'tire_shop' && (weather === 'rain' || weather === 'snow' || weather === 'mud_season')
      ? 1.35
      : 1.0;
  const autoPartsSynergy = biz.type === 'auto_parts' && hasCarService ? 1.15 : 1.0;
  const directorMult = hasBranchDirector ? 1.18 : 1.0;
  const managerMult = biz.hasManager ? 1.1 : 1.0;
  const costReduction = (hasWarehouse ? 0.92 : 1.0) * (hasHoldingProcurement ? 0.94 : 1.0);

  const revenuePerMin = Math.round(
    spec.baseRevenuePerMin *
      levelRevMult *
      district.priceToleranceMult *
      conditionMult *
      weatherBoost *
      autoPartsSynergy *
      directorMult *
      managerMult
  );
  const expensesPerMin = Math.round(
    (spec.baseExpensesPerMin * levelExpMult + biz.staffCount * spec.staffSalaryPerMin) *
      costReduction
  );
  const profitPerMin = revenuePerMin - expensesPerMin;

  const revenueDelta = Math.round(revenuePerMin * dtMinutes);
  const expenseDelta = Math.round(expensesPerMin * dtMinutes);
  const wearDelta = dtMinutes * (hasTechnician ? 0.55 : 1.25);

  return {
    next: {
      ...biz,
      condition: Math.max(15, +(biz.condition - wearDelta).toFixed(1)),
      revenuePerMin,
      expensesPerMin,
      profitPerMin,
      totalRevenue: biz.totalRevenue + revenueDelta,
      totalProfit: biz.totalProfit + (revenueDelta - expenseDelta),
      clientsServed: biz.clientsServed + Math.max(0, Math.round(dtMinutes * (1.2 + biz.level * 0.4))),
    },
    revenueDelta,
    expenseDelta,
    justCompleted: false,
  };
}

/**
 * Calculates tax accruals for a billing tick.
 */
export function calculateTaxAccrual(params: {
  netProfitDelta: number;
  salariesDelta: number;
  propertyValueTotal: number;
  dtMinutes: number;
  sharedAccounting: boolean;
}): { profitTax: number; payrollTax: number; propertyTax: number } {
  const profitRate = params.sharedAccounting ? 0.12 : 0.15;
  const profitTax = params.netProfitDelta > 0 ? Math.round(params.netProfitDelta * profitRate) : 0;
  const payrollTax = Math.round(params.salariesDelta * 0.13);
  const propertyTax = Math.round(params.propertyValueTotal * 0.00025 * params.dtMinutes);
  return { profitTax, payrollTax, propertyTax };
}

/**
 * Computes current tax audit risk (0..100) transparently from missing documents & overdue taxes.
 */
export function computeAuditRisk(params: {
  empire: EmpireState;
  day: number;
  bays: number;
  workersCount: number;
}): number {
  const docs = params.empire.tax.documents;
  let risk = 5;
  if (!docs.lease_contract) risk += 18;
  if (!docs.sanitary_permit && params.day >= 2) risk += 20;
  if (!docs.fire_safety && params.day >= 3) risk += 18;
  if (!docs.staff_docs && params.workersCount >= 2) risk += 16;
  if (params.empire.tax.overdueAmount > 5_000) risk += 28;
  if (params.day - params.empire.tax.lastFilingDay >= 3) risk += 15;

  const hasAccountant = params.empire.specialists.some((s) => s.role === 'accountant' && s.hired);
  const hasWaterRes = params.empire.unlockedResearchIds.includes('water_recovery_pro');

  if (hasAccountant) risk *= 0.3;
  if (hasWaterRes) risk *= 0.8;

  return Math.max(2, Math.min(95, Math.round(risk)));
}

/**
 * Evaluates a tax audit when triggered by city event or end-of-shift overdue check.
 * Always returns an explainable reason so fines are never opaque.
 */
export function evaluateTaxAudit(params: {
  empire: EmpireState;
  day: number;
  workersCount: number;
}): TaxAuditResult | null {
  const docs = params.empire.tax.documents;
  const hasAccountant = params.empire.specialists.some((s) => s.role === 'accountant' && s.hired);
  const reduction = hasAccountant ? 0.45 : 1.0;

  if (params.empire.tax.overdueAmount > 4_000) {
    return {
      fine: Math.round(params.empire.tax.overdueAmount * 0.25 * reduction),
      reason: 'Пеня за просрочку налогов',
    };
  }
  if (!docs.lease_contract && params.day >= 2) {
    return {
      fine: Math.round(6_500 * reduction),
      reason: 'Отсутствует договор аренды площадки',
    };
  }
  if (!docs.sanitary_permit && params.day >= 3) {
    return {
      fine: Math.round(9_000 * reduction),
      reason: 'Отсутствует санитарный паспорт (СЭС)',
    };
  }
  if (!docs.staff_docs && params.workersCount >= 2) {
    return {
      fine: Math.round(7_500 * reduction),
      reason: 'Не оформлен кадровый пакет сотрудников',
    };
  }
  if (!docs.fire_safety && params.day >= 4) {
    return {
      fine: Math.round(8_500 * reduction),
      reason: 'Нет сертификата пожарной безопасности',
    };
  }
  return null;
}

/**
 * Adds a financial delta into all four report periods (today / week / month / year).
 */
export function recordLedger(
  reports: FinancialReports,
  delta: Partial<FinancialPeriodBucket>
): FinancialReports {
  const apply = (b: FinancialPeriodBucket): FinancialPeriodBucket => ({
    washRevenue: b.washRevenue + (delta.washRevenue ?? 0),
    enterpriseRevenue: b.enterpriseRevenue + (delta.enterpriseRevenue ?? 0),
    contractRevenue: b.contractRevenue + (delta.contractRevenue ?? 0),
    rentIncome: b.rentIncome + (delta.rentIncome ?? 0),
    salaries: b.salaries + (delta.salaries ?? 0),
    utilities: b.utilities + (delta.utilities ?? 0),
    rent: b.rent + (delta.rent ?? 0),
    maintenance: b.maintenance + (delta.maintenance ?? 0),
    ads: b.ads + (delta.ads ?? 0),
    taxes: b.taxes + (delta.taxes ?? 0),
    loanInterest: b.loanInterest + (delta.loanInterest ?? 0),
    insurance: b.insurance + (delta.insurance ?? 0),
    fines: b.fines + (delta.fines ?? 0),
    upgrades: b.upgrades + (delta.upgrades ?? 0),
    carsWashed: b.carsWashed + (delta.carsWashed ?? 0),
  });

  return {
    today: apply(reports.today),
    week: apply(reports.week),
    month: apply(reports.month),
    year: apply(reports.year),
  };
}

export function getBucketTotals(b: FinancialPeriodBucket): {
  revenue: number;
  expenses: number;
  profit: number;
} {
  const revenue = b.washRevenue + b.enterpriseRevenue + b.contractRevenue + b.rentIncome;
  const expenses =
    b.salaries +
    b.utilities +
    b.rent +
    b.maintenance +
    b.ads +
    b.taxes +
    b.loanInterest +
    b.insurance +
    b.fines;
  return { revenue, expenses, profit: revenue - expenses };
}
