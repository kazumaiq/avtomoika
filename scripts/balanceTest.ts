import assert from 'node:assert/strict';
import {
  BUSINESS_TYPES,
  DISTRICTS,
  DISTRICT_ORDER,
  WASH_TECHNOLOGIES,
  createInitialDistrictRival,
  createInitialReports,
  createInitialSpecialists,
  getLevelForXp,
} from '../src/config/empire.ts';
import { createStarterWorker } from '../src/config/staff.ts';
import {
  WASH_PRICE_DEFAULT,
  getUpgradeCost,
} from '../src/config/upgrades.ts';
import {
  calculateMarketDemand,
  calculatePlayerExpensesPerMin,
  calculateTaxAccrual,
  calculateWashPayout,
  evaluateTaxAudit,
  getEffectivePlayerWashSpeed,
  stepCompetitorEconomy,
  stepOwnedBusiness,
} from '../src/engine/economyEngine.ts';
import type {
  CompetitorState,
  EconomyMetrics,
  EmpireState,
  OwnedBusiness,
  UpgradeKey,
  UpgradeLevels,
  WorkerProfile,
} from '../src/types/game.ts';

type StrategyId = 'A_passive' | 'B_upgrades' | 'C_staff' | 'D_dumping' | 'E_tycoon';

interface SimResult {
  strategy: StrategyId;
  minutes: number;
  balance: number;
  totalRevenue: number;
  totalExpenses: number;
  netWorth: number;
  carsWashed: number;
  bays: number;
  workers: number;
  level: number;
  businesses: number;
  playerSharePct: number;
  compBalance: number;
  compBays: number;
  compStrategy: string;
  compProfitPerMin: number;
  milestones: {
    firstUpgradeMin: number | null;
    bay2Min: number | null;
    firstBusinessMin: number | null;
    bay3Min: number | null;
    district2Min: number | null;
  };
}

function makeInitialState() {
  const eco: EconomyMetrics = {
    balance: 26_000,
    totalRevenue: 0,
    totalExpenses: 0,
    incomePerMin: 0,
    expensesPerMin: 1_120,
    profitPerMin: -1_120,
    carsWashed: 0,
    carsLost: 0,
    reputation: 3.25,
    washPrice: WASH_PRICE_DEFAULT,
    adCampaign: 'none',
    combo: 0,
    bestCombo: 0,
    dailyRevenue: 0,
    dailyExpenses: 0,
    dailyTaxes: 0,
    dailyCars: 0,
    happyHourRemaining: 0,
    happyHourCooldown: 0,
    adBoostRemaining: 0,
    adGrantCooldown: 0,
    equipmentCondition: 100,
    activeWashTech: 'manual',
    unlockedWashTechs: ['manual'],
    entrepreneurLevel: 1,
    entrepreneurXp: 0,
    lastPayoutBreakdown: null,
    history: [],
  };

  const upgrades: UpgradeLevels = {
    bays: 1,
    pressureWasher: 1,
    foamSystem: 1,
    dryerWax: 1,
    ecoSolar: 1,
    vipLounge: 1,
    queueLot: 1,
  };

  const workers: WorkerProfile[] = [createStarterWorker()];

  const districtRivals = {} as Record<(typeof DISTRICT_ORDER)[number], CompetitorState>;
  for (const d of DISTRICT_ORDER) {
    districtRivals[d] = createInitialDistrictRival(d);
  }

  const empire: EmpireState = {
    activeDistrict: 'residential',
    unlockedDistricts: ['residential'],
    weather: 'sunny',
    unlockedResearchIds: [],
    claimedLevelRewards: [],
    specialists: createInitialSpecialists(),
    properties: [],
    businesses: [],
    contracts: [],
    completedContractIds: [],
    tax: {
      accruedProfitTax: 0,
      accruedPropertyTax: 0,
      accruedPayrollTax: 0,
      overdueAmount: 0,
      lastFilingDay: 1,
      auditRisk: 14,
      documents: {
        business_reg: true,
        lease_contract: false,
        sanitary_permit: false,
        fire_safety: false,
        staff_docs: false,
        bay_permit_2: false,
        bay_permit_3: false,
        bay_permit_4: false,
      },
      history: [],
    },
    bank: {
      creditScore: 620,
      loans: [],
      insuranceActive: false,
      insuranceCostPerMin: 350,
    },
    holding: {
      founded: false,
      name: 'AUTOMOIKA GROUP',
      corporateReserve: 0,
      centralProcurement: false,
      sharedAccounting: false,
      brandSynergyLevel: 1,
    },
    reports: createInitialReports(),
    districtRivals,
  };

  return { eco, upgrades, workers, empire, comp: districtRivals.residential };
}

function runSimulation(strategy: StrategyId, totalMinutes: number, stepSec = 15): SimResult {
  const { eco, upgrades, workers, empire } = makeInitialState();
  let comp = { ...empire.districtRivals.residential };

  if (strategy === 'D_dumping') {
    eco.washPrice = 600;
  }

  const milestones = {
    firstUpgradeMin: null as number | null,
    bay2Min: null as number | null,
    firstBusinessMin: null as number | null,
    bay3Min: null as number | null,
    district2Min: null as number | null,
  };

  const totalSteps = Math.round((totalMinutes * 60) / stepSec);
  const dtMin = stepSec / 60;
  let playerCarFrac = 0;
  let compCarFrac = 0;
  let lastPlayerShare = 0.5;
  let investedAssets = 0;

  for (let step = 1; step <= totalSteps; step++) {
    const elapsedMin = step * dtMin;
    const day = Math.floor(elapsedMin / 3) + 1; // 3 real minutes = 1 shift day
    const hourOfDay = 7 + ((elapsedMin % 3) / 3) * 15;

    // Overnight rest & tax payment at shift boundary
    if (step > 1 && Math.floor(elapsedMin / 3) > Math.floor((elapsedMin - dtMin) / 3)) {
      for (const w of workers) {
        w.fatigue = Math.max(0, w.fatigue - 55);
      }
      // Pay accrued taxes if solvent
      const due =
        empire.tax.accruedProfitTax +
        empire.tax.accruedPayrollTax +
        empire.tax.accruedPropertyTax;
      if (due > 0 && eco.balance >= due) {
        eco.balance -= due;
        eco.totalExpenses += due;
        empire.tax.accruedProfitTax = 0;
        empire.tax.accruedPayrollTax = 0;
        empire.tax.accruedPropertyTax = 0;
        empire.tax.lastFilingDay = day;
      }
    }

    // 1. Finite district demand
    const demand = calculateMarketDemand({
      districtId: empire.activeDistrict,
      day,
      hourOfDay,
      weather: empire.weather,
      activeEvent: null,
      playerEco: eco,
      playerUpgrades: upgrades,
      playerQueueLen: 1,
      comp,
      compQueueLen: 1,
      hasCrmResearch: empire.unlockedResearchIds.includes('crm_loyalty'),
      hasMarketer: empire.specialists.some((s) => s.role === 'marketer' && s.hired),
      hasGasStation: empire.businesses.some((b) => !b.underConstruction && b.type === 'gas_station'),
      hasParking: empire.businesses.some((b) => !b.underConstruction && b.type === 'parking'),
    });
    lastPlayerShare = demand.playerShare;

    // 2. Real physical bay capacity (cars/min) for player & competitor
    const activeBays = Math.min(upgrades.bays, workers.length);
    const avgWorker = workers.reduce((s, w) => s + w.speed, 0) / workers.length;
    const avgFatigue = workers.reduce((s, w) => s + w.fatigue, 0) / workers.length;
    const avgQual = workers.reduce((s, w) => s + w.quality, 0) / workers.length;

    const effSpeed = getEffectivePlayerWashSpeed({
      upgrades,
      activeWashTech: eco.activeWashTech,
      workerSpeed: avgWorker,
      workerMorale: 1.0,
      workerFatigue: avgFatigue,
      equipmentCondition: eco.equipmentCondition,
      happyHourActive: false,
      hasDispatchResearch: empire.unlockedResearchIds.includes('bay_dispatch_ai'),
      hasManagerSpecialist: empire.specialists.some((s) => s.role === 'manager' && s.hired),
    });

    // Realistic cycle time per bay: ~15.5 sec base wash + 4.5 sec drive-in/out = 20 sec (3.0 cars/min/bay at 1x)
    const playerMaxCapacityPerMin = activeBays * (60 / (15.5 / effSpeed + 4.5));
    const playerActualCarsPerMin = Math.min(demand.playerDemandPerMin, playerMaxCapacityPerMin);
    playerCarFrac += playerActualCarsPerMin * dtMin;

    let stepPlayerRev = 0;
    let stepPlayerWashUtil = 0;

    while (playerCarFrac >= 1) {
      playerCarFrac -= 1;
      eco.carsWashed += 1;
      eco.combo = Math.min(20, eco.combo + 1);
      const isVip = eco.carsWashed % 22 === 0;
      const payout = calculateWashPayout({
        washPrice: eco.washPrice,
        happyHourActive: false,
        vehiclePriceMult: isVip ? 1.32 : 1.0,
        segment: isVip ? 'vip' : 'regular',
        isVip,
        activeWashTech: eco.activeWashTech,
        upgrades,
        workerQuality: avgQual,
        combo: eco.combo,
        equipmentCondition: eco.equipmentCondition,
        activeEvent: null,
        weather: empire.weather,
        hasChemShop: empire.businesses.some((b) => !b.underConstruction && b.type === 'chem_shop'),
        hasHoldingProcurement: false,
        hasWaterResearch: empire.unlockedResearchIds.includes('water_recovery_pro'),
      });
      stepPlayerRev += payout.total;
      stepPlayerWashUtil += payout.utilityCost;
      eco.reputation = Math.min(5.0, +(eco.reputation + 0.008).toFixed(3));
      eco.equipmentCondition = Math.max(15, +(eco.equipmentCondition - 0.55).toFixed(1));
      for (const w of workers) {
        w.fatigue = Math.min(100, +(w.fatigue + 1.8 / workers.length).toFixed(1));
      }
      eco.entrepreneurXp += isVip ? 26 : 12;
      const lvSpec = getLevelForXp(eco.entrepreneurXp);
      if (lvSpec.level > eco.entrepreneurLevel) {
        eco.entrepreneurLevel = lvSpec.level;
        eco.balance += lvSpec.rewardCash;
      }
    }

    // Competitor physical capacity
    const compMaxCapPerMin = Math.min(comp.bays, comp.staffCount) * (60 / (15.5 / comp.speedMultiplier + 4.5));
    const compActualCarsPerMin = Math.min(demand.compDemandPerMin, compMaxCapPerMin);
    compCarFrac += compActualCarsPerMin * dtMin;
    let stepCompRev = 0;
    let stepCompCars = 0;
    while (compCarFrac >= 1) {
      compCarFrac -= 1;
      stepCompCars += 1;
      comp.carsWashed += 1;
      const price = comp.promoActive ? comp.price * 0.82 : comp.price;
      const pay = Math.round((price * (0.94 + comp.quality * 0.06)) / 10) * 10;
      stepCompRev += pay;
      comp.totalRevenue += pay;
    }

    // 3. Auxiliary businesses
    let bizRev = 0;
    let bizExp = 0;
    for (let i = 0; i < empire.businesses.length; i++) {
      const res = stepOwnedBusiness(
        empire.businesses[i],
        empire.weather,
        false,
        false,
        false,
        false,
        false,
        dtMin
      );
      empire.businesses[i] = res.next;
      bizRev += res.revenueDelta;
      bizExp += res.expenseDelta;
    }

    // 4. Recurring expenses
    const expPerMin = calculatePlayerExpensesPerMin({
      workers,
      upgrades,
      adCampaign: eco.adCampaign,
      equipmentCondition: eco.equipmentCondition,
      empire,
      activeEvent: null,
    });
    const stepExp = Math.round(expPerMin.total * dtMin) + stepPlayerWashUtil + bizExp;
    const stepRev = stepPlayerRev + bizRev;

    eco.balance = Math.max(-150_000, eco.balance + stepRev - stepExp);
    eco.totalRevenue += stepRev;
    eco.totalExpenses += stepExp;

    // 5. Tax accrual
    const taxAcc = calculateTaxAccrual({
      netProfitDelta: stepRev - stepExp,
      salariesDelta: Math.round(expPerMin.salaries * dtMin),
      propertyValueTotal: 0,
      dtMinutes: dtMin,
      sharedAccounting: false,
    });
    empire.tax.accruedProfitTax += taxAcc.profitTax;
    empire.tax.accruedPayrollTax += taxAcc.payrollTax;

    // 6. Self-sustaining Competitor AI
    const compStep = stepCompetitorEconomy({
      comp,
      playerPrice: eco.washPrice,
      playerQuality: demand.playerQuality,
      playerShare: demand.playerShare,
      day,
      dtMinutes: dtMin,
      revenueEarnedInStep: stepCompRev,
      carsWashedInStep: stepCompCars,
    });
    comp = compStep.next;

    // 7. Player strategy decisions
    if (strategy !== 'A_passive') {
      // Repair equipment when below 60%
      if (eco.equipmentCondition < 60) {
        const repCost = Math.round((100 - eco.equipmentCondition) * 65 * upgrades.bays);
        if (eco.balance >= repCost + 4_000) {
          eco.balance -= repCost;
          eco.totalExpenses += repCost;
          eco.equipmentCondition = 100;
        }
      }

      // Dynamic fair pricing for profit-maximizing strategy E
      if (strategy === 'E_tycoon') {
        eco.washPrice = Math.min(2200, Math.max(800, demand.playerFairPrice - 50));
      }

      // Staff hiring for C_staff, B_upgrades, E_tycoon
      if (
        (strategy === 'C_staff' || strategy === 'B_upgrades' || strategy === 'E_tycoon') &&
        workers.length < upgrades.bays + (strategy === 'C_staff' ? 2 : 0) &&
        workers.length < 6 &&
        eco.balance >= 16_000
      ) {
        const hireCost = 10_500;
        eco.balance -= hireCost;
        eco.totalExpenses += hireCost;
        workers.push({
          ...createStarterWorker(),
          id: `w-${workers.length + 1}`,
          salaryPerMin: 560,
          speed: 1.05,
          quality: 1.05,
        });
      }

      // Upgrades & Permits for B_upgrades and E_tycoon
      if (strategy === 'B_upgrades' || strategy === 'E_tycoon') {
        // Buy Bay #2 permit + Bay #2 when affordable
        if (!empire.tax.documents.bay_permit_2 && eco.entrepreneurLevel >= 2 && eco.balance >= 14_000) {
          eco.balance -= 10_000;
          eco.totalExpenses += 10_000;
          empire.tax.documents.bay_permit_2 = true;
        }
        const bayCost = getUpgradeCost('bays', upgrades.bays);
        if (
          upgrades.bays === 1 &&
          empire.tax.documents.bay_permit_2 &&
          eco.balance >= bayCost + 8_000
        ) {
          eco.balance -= bayCost;
          eco.totalExpenses += bayCost;
          investedAssets += bayCost;
          upgrades.bays = 2;
          milestones.bay2Min ??= +elapsedMin.toFixed(1);
        }

        // Buy Bay #3 permit + Bay #3
        if (!empire.tax.documents.bay_permit_3 && eco.entrepreneurLevel >= 5 && eco.balance >= 36_000) {
          eco.balance -= 28_000;
          eco.totalExpenses += 28_000;
          empire.tax.documents.bay_permit_3 = true;
        }
        const bay3Cost = getUpgradeCost('bays', upgrades.bays);
        if (
          upgrades.bays === 2 &&
          empire.tax.documents.bay_permit_3 &&
          eco.balance >= bay3Cost + 15_000
        ) {
          eco.balance -= bay3Cost;
          eco.totalExpenses += bay3Cost;
          investedAssets += bay3Cost;
          upgrades.bays = 3;
          milestones.bay3Min ??= +elapsedMin.toFixed(1);
        }

        // Equipment upgrades
        const keys: UpgradeKey[] = ['pressureWasher', 'foamSystem', 'ecoSolar', 'dryerWax', 'vipLounge'];
        for (const k of keys) {
          if (upgrades[k] < 4) {
            const c = getUpgradeCost(k, upgrades[k]);
            if (eco.balance >= c + 8_000) {
              eco.balance -= c;
              eco.totalExpenses += c;
              investedAssets += c;
              upgrades[k] += 1;
              milestones.firstUpgradeMin ??= +elapsedMin.toFixed(1);
              break;
            }
          }
        }

        // Auxiliary business (Parking -> Tire shop)
        if (
          strategy === 'E_tycoon' &&
          empire.businesses.length === 0 &&
          eco.entrepreneurLevel >= 4 &&
          eco.balance >= BUSINESS_TYPES.parking.buildCost + 12_000
        ) {
          const spec = BUSINESS_TYPES.parking;
          eco.balance -= spec.buildCost;
          eco.totalExpenses += spec.buildCost;
          investedAssets += spec.buildCost;
          const biz: OwnedBusiness = {
            id: 'biz-parking-1',
            type: 'parking',
            districtId: 'residential',
            title: spec.title,
            level: 1,
            staffCount: spec.staffRequired,
            hasManager: false,
            condition: 100,
            priceLevel: 1,
            revenuePerMin: 0,
            expensesPerMin: 0,
            profitPerMin: 0,
            totalRevenue: 0,
            totalProfit: 0,
            clientsServed: 0,
            underConstruction: true,
            constructionMinutesLeft: spec.constructionMinutes,
          };
          empire.businesses.push(biz);
          milestones.firstBusinessMin ??= +elapsedMin.toFixed(1);
        }

        // Second district unlock
        if (
          strategy === 'E_tycoon' &&
          empire.unlockedDistricts.length === 1 &&
          eco.entrepreneurLevel >= DISTRICTS.industrial.unlockLevel &&
          eco.balance >= DISTRICTS.industrial.unlockCost + 25_000
        ) {
          eco.balance -= DISTRICTS.industrial.unlockCost;
          eco.totalExpenses += DISTRICTS.industrial.unlockCost;
          investedAssets += DISTRICTS.industrial.unlockCost;
          empire.unlockedDistricts.push('industrial');
          milestones.district2Min ??= +elapsedMin.toFixed(1);
        }
      }
    }
  }

  return {
    strategy,
    minutes: totalMinutes,
    balance: Math.round(eco.balance),
    totalRevenue: Math.round(eco.totalRevenue),
    totalExpenses: Math.round(eco.totalExpenses),
    netWorth: Math.round(eco.balance + investedAssets),
    carsWashed: eco.carsWashed,
    bays: upgrades.bays,
    workers: workers.length,
    level: eco.entrepreneurLevel,
    businesses: empire.businesses.length,
    playerSharePct: Math.round(lastPlayerShare * 100),
    compBalance: Math.round(comp.balance),
    compBays: comp.bays,
    compStrategy: comp.strategy,
    compProfitPerMin: comp.profitPerMin,
    milestones,
  };
}

console.log('=== AUTOMOIKA 2.0 ECONOMIC BALANCE TEST SUITE ===\n');

// 1. Multi-horizon Tycoon progression test (30m, 60m, 180m, 600m)
for (const horizon of [30, 60, 180, 600]) {
  const r = runSimulation('E_tycoon', horizon);
  console.log(
    `[E_tycoon @ ${String(horizon).padStart(3)}m] Bal: ${r.balance.toLocaleString('ru-RU')}₽ | NetWorth: ${r.netWorth.toLocaleString('ru-RU')}₽ | Cars: ${r.carsWashed} | Bays: ${r.bays} | Lv.${r.level} | Biz: ${r.businesses} | Share: ${r.playerSharePct}% | Rival(${r.compStrategy}): ${r.compBalance.toLocaleString('ru-RU')}₽ (${r.compBays}b)`
  );
  if (horizon === 600) {
    console.log('   Milestones (1x game-minutes):', r.milestones);
  }
}

console.log('\n--- Strategy Comparison @ 180 min (3 hours 1x) ---');
const stratResults: Record<StrategyId, SimResult> = {
  A_passive: runSimulation('A_passive', 180),
  B_upgrades: runSimulation('B_upgrades', 180),
  C_staff: runSimulation('C_staff', 180),
  D_dumping: runSimulation('D_dumping', 180),
  E_tycoon: runSimulation('E_tycoon', 180),
};

for (const r of Object.values(stratResults)) {
  console.log(
    `${r.strategy.padEnd(11)} | Bal: ${String(r.balance).padStart(9)}₽ | Net: ${String(r.netWorth).padStart(9)}₽ | Cars: ${String(r.carsWashed).padStart(4)} | Bays: ${r.bays} | Share: ${r.playerSharePct}% | RivalBal: ${r.compBalance}₽`
  );
}

// 2. Test F: 1x vs 3x Speed Parity (same 60 game-minutes simulated at 15s step vs 45s step)
const speed1x = runSimulation('A_passive', 60, 15);
const speed3x = runSimulation('A_passive', 60, 45);
const parityDiffPct = Math.abs(speed1x.totalRevenue - speed3x.totalRevenue) / Math.max(1, speed1x.totalRevenue);
console.log(
  `\n[F_speed_parity] 60m @ 1x rev=${speed1x.totalRevenue}₽ vs 3x rev=${speed3x.totalRevenue}₽ (diff=${(parityDiffPct * 100).toFixed(2)}%)`
);
assert(parityDiffPct < 0.03, `1x vs 3x revenue parity drifted too much: ${(parityDiffPct * 100).toFixed(2)}%`);

// 3. Test G: Anti-Exploit Stress Test (VIP + Max Combo + Best Event + Max Equipment)
const maxExploitPayout = calculateWashPayout({
  washPrice: 1200,
  happyHourActive: false,
  vehiclePriceMult: 1.38,
  segment: 'vip',
  isVip: true,
  activeWashTech: 'manual',
  upgrades: { bays: 4, pressureWasher: 5, foamSystem: 5, dryerWax: 5, ecoSolar: 4, vipLounge: 4, queueLot: 3 },
  workerQuality: 2.4,
  combo: 99,
  equipmentCondition: 100,
  activeEvent: { id: 'vip_convoy', remainingSec: 20, totalSec: 36 },
  weather: 'sunny',
  hasChemShop: false,
  hasHoldingProcurement: false,
  hasWaterResearch: false,
});
const maxAllowed = Math.round((maxExploitPayout.baseTariff + maxExploitPayout.techBonus) * 1.66);
console.log(
  `[G_anti_exploit] VIP+MaxCombo+Event payout=${maxExploitPayout.total}₽ (base=${maxExploitPayout.baseTariff}₽, cap<=${maxAllowed}₽)`
);
assert(maxExploitPayout.total <= maxAllowed, `Exploit cap exceeded: ${maxExploitPayout.total} > ${maxAllowed}`);

// 4. Explainable Tax Audit Test
const auditState = makeInitialState();
const auditRes = evaluateTaxAudit({ empire: auditState.empire, day: 3, workersCount: 2 });
assert(auditRes !== null && auditRes.fine > 0 && auditRes.reason.length > 0, 'Audit must give explainable reason when documents missing');
auditState.empire.tax.documents.lease_contract = true;
auditState.empire.tax.documents.sanitary_permit = true;
auditState.empire.tax.documents.staff_docs = true;
auditState.empire.tax.documents.fire_safety = true;
const cleanAudit = evaluateTaxAudit({ empire: auditState.empire, day: 5, workersCount: 3 });
assert(cleanAudit === null, 'Audit must pass with 0 fine when all documents are in order');
console.log(`[Tax_Audit] Missing docs -> fine ${auditRes.fine}₽ ("${auditRes.reason}") | Full docs -> 0₽ fine (PASS)`);

// 5. Key Balance Assertions
const r10 = runSimulation('E_tycoon', 10);
assert(r10.bays === 1, `Player should NOT unlock Bay #2 within 10 minutes! Got bays=${r10.bays}`);
assert(stratResults.A_passive.balance > 0, `Casual 1-bay play should be profitable, got ${stratResults.A_passive.balance}₽`);
assert(stratResults.E_tycoon.netWorth > stratResults.D_dumping.netWorth, 'Smart tycoon strategy must outperform reckless price dumping');
assert(stratResults.E_tycoon.netWorth > stratResults.A_passive.netWorth, 'Active management must outperform passive no-upgrade play');
assert(stratResults.E_tycoon.compBalance > 0, 'Competitor TURBO SHINE must remain financially viable');
assert(
  stratResults.E_tycoon.playerSharePct >= 25 && stratResults.E_tycoon.playerSharePct <= 85,
  `Market share must remain competitive, got ${stratResults.E_tycoon.playerSharePct}%`
);

console.log('\n✅ ALL ECONOMIC BALANCE & ANTI-EXPLOIT ASSERTIONS PASSED!');
