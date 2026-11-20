import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  Crown,
  Landmark,
  Megaphone,
  Receipt,
  ShieldCheck,
  Sliders,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  DOCUMENTS_CATALOG,
  ENTREPRENEUR_LEVELS,
  LOAN_PRODUCTS,
  WEATHER_SPECS,
} from '../../config/empire';
import {
  AD_CAMPAIGNS,
  WASH_PRICE_MAX,
  WASH_PRICE_MIN,
  WASH_PRICE_STEP,
  getFairWashPrice,
  getPlayerQualityScore,
} from '../../config/upgrades';
import { getBucketTotals } from '../../engine/economyEngine';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { AdCampaignId } from '../../types/game';
import { formatRub, formatRubPerMin } from '../../utils/currency';

const AD_ORDER: AdCampaignId[] = ['none', 'flyers', 'billboard', 'radio'];
type BizTab = 'overview' | 'finance' | 'tax' | 'bank';
type PeriodKey = 'today' | 'week' | 'month' | 'year';

export function BusinessPanel() {
  const [tab, setTab] = useState<BizTab>('overview');
  const [period, setPeriod] = useState<PeriodKey>('today');

  const economy = useGameStore((s) => s.economy);
  const upgrades = useGameStore((s) => s.upgrades);
  const competitor = useGameStore((s) => s.competitor);
  const empire = useGameStore((s) => s.empire);
  const setWashPrice = useGameStore((s) => s.setWashPrice);
  const setAdCampaign = useGameStore((s) => s.setAdCampaign);
  const activateHappyHour = useGameStore((s) => s.activateHappyHour);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const buyDocument = useGameStore((s) => s.buyDocument);
  const payTaxes = useGameStore((s) => s.payTaxes);
  const fileTaxDeclaration = useGameStore((s) => s.fileTaxDeclaration);
  const takeLoan = useGameStore((s) => s.takeLoan);
  const repayLoan = useGameStore((s) => s.repayLoan);
  const toggleInsurance = useGameStore((s) => s.toggleInsurance);

  const quality = getPlayerQualityScore(upgrades);
  const fairPrice = getFairWashPrice(quality, economy.reputation);
  const sharePct = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
  const compEffPrice = competitor.promoActive
    ? Math.round((competitor.price * 0.82) / 10) * 10
    : competitor.price;

  const lvSpec = ENTREPRENEUR_LEVELS[economy.entrepreneurLevel - 1] ?? ENTREPRENEUR_LEVELS[0];
  const nextLvSpec = ENTREPRENEUR_LEVELS[economy.entrepreneurLevel] ?? null;
  const lvProgress = nextLvSpec
    ? Math.min(
        1,
        Math.max(
          0,
          (economy.entrepreneurXp - lvSpec.xpRequired) /
            Math.max(1, nextLvSpec.xpRequired - lvSpec.xpRequired)
        )
      )
    : 1;

  const happyActive = economy.happyHourRemaining > 0;
  const happyCooldown = economy.happyHourCooldown > 0;

  const taxTotal =
    empire.tax.accruedProfitTax +
    empire.tax.accruedPayrollTax +
    empire.tax.accruedPropertyTax +
    empire.tax.overdueAmount;

  const bucket = empire.reports[period];
  const bucketTotals = getBucketTotals(bucket);

  // Live revenue chart
  const pts =
    economy.history.length >= 2
      ? economy.history
      : [
          economy.history[0] ?? { minute: 0, playerRev: 0, compRev: 0, balance: economy.balance },
          {
            minute: 1,
            playerRev: economy.incomePerMin,
            compRev: competitor.revenuePerMin,
            balance: economy.balance,
          },
        ];

  const maxVal = Math.max(1500, ...pts.map((p) => Math.max(p.playerRev, p.compRev)));
  const W = 320;
  const H = 76;
  const toX = (i: number) => (i / Math.max(1, pts.length - 1)) * (W - 12) + 6;
  const toY = (v: number) => H - 8 - (v / maxVal) * (H - 18);

  const playerLine = pts.map((p, i) => `${toX(i).toFixed(1)},${toY(p.playerRev).toFixed(1)}`).join(' ');
  const compLine = pts.map((p, i) => `${toX(i).toFixed(1)},${toY(p.compRev).toFixed(1)}`).join(' ');
  const playerArea = `6,${H - 6} ${playerLine} ${toX(pts.length - 1).toFixed(1)},${H - 6}`;

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Briefcase size={18} color="#00d4ff" />
          <h2 className="panel-title">Управление бизнесом</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        <div className="seg-group">
          <button
            className={`seg-btn ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Обзор
          </button>
          <button
            className={`seg-btn ${tab === 'finance' ? 'active' : ''}`}
            onClick={() => setTab('finance')}
          >
            Финансы
          </button>
          <button
            className={`seg-btn ${tab === 'tax' ? 'active' : ''}`}
            onClick={() => setTab('tax')}
          >
            Налоги{taxTotal > 0 ? ' •' : ''}
          </button>
          <button
            className={`seg-btn ${tab === 'bank' ? 'active' : ''}`}
            onClick={() => setTab('bank')}
          >
            Банк
          </button>
        </div>

        {tab === 'overview' && (
          <>
            {/* Entrepreneur Level Card */}
            <div className="ui-card" style={{ borderColor: 'rgba(0, 212, 255, 0.35)' }}>
              <div className="ui-card-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Crown size={16} color="#facc15" />
                  <div>
                    <div className="hud-metric-label">
                      Уровень {economy.entrepreneurLevel}/30 • {WEATHER_SPECS[empire.weather].labelRu}
                    </div>
                    <div className="card-title" style={{ color: '#facc15' }}>
                      {lvSpec.title}
                    </div>
                  </div>
                </div>
                <span className="pill-tag">{Math.round(lvProgress * 100)}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round(lvProgress * 100)}%`, background: '#facc15' }}
                />
              </div>
              {nextLvSpec && (
                <div className="card-sub">
                  Далее Ур. {nextLvSpec.level}: <strong>{nextLvSpec.unlockNote}</strong>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="stat-grid-2">
              <div className="stat-box">
                <span className="hud-metric-label">Доход / мин</span>
                <span className="hud-metric-val val-positive">
                  {formatRub(economy.incomePerMin, { signed: true })}
                </span>
              </div>
              <div className="stat-box">
                <span className="hud-metric-label">Расходы / мин</span>
                <span className="hud-metric-val val-negative">
                  -{formatRub(economy.expensesPerMin)}
                </span>
              </div>
              <div className="stat-box">
                <span className="hud-metric-label">Чистая прибыль / мин</span>
                <span
                  className={`hud-metric-val ${economy.profitPerMin >= 0 ? 'val-positive' : 'val-negative'}`}
                >
                  {formatRub(economy.profitPerMin, { signed: true })}
                </span>
              </div>
              <div className="stat-box">
                <span className="hud-metric-label">Оборудование</span>
                <span className="hud-metric-val val-cyan">
                  {Math.round(economy.equipmentCondition)}%
                </span>
              </div>
            </div>

            {/* Live Revenue Chart */}
            <div className="ui-card">
              <div className="ui-card-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={14} color="#00d4ff" />
                  <span className="section-label">Выручка / мин</span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, fontWeight: 700 }}>
                  <span style={{ color: '#00d4ff' }}>● Вы</span>
                  <span style={{ color: '#ff6b84' }}>● Соперник</span>
                </div>
              </div>
              <div className="rev-chart">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="playerChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points={playerArea} fill="url(#playerChartGrad)" />
                  <polyline fill="none" stroke="#ff6b84" strokeWidth="2" points={compLine} />
                  <polyline fill="none" stroke="#00d4ff" strokeWidth="2.4" points={playerLine} />
                </svg>
              </div>
            </div>

            {/* Rewarded Video Boosts (Yandex Games Monetization) */}
            <div className="ui-card" style={{ borderColor: 'rgba(250, 204, 21, 0.45)' }}>
              <div className="ui-card-row">
                <div>
                  <div className="card-title" style={{ color: '#facc15' }}>
                    📺 Спонсорский грант и VIP-кортеж
                  </div>
                  <div className="card-sub">
                    Быстрый бонус за просмотр короткого видеоролика
                  </div>
                </div>
              </div>
              <div className="ui-card-row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn-primary btn-amber"
                  style={{ flex: 1 }}
                  disabled={(economy.adGrantCooldown ?? 0) > 0}
                  onClick={() => void useGameStore.getState().watchRewardedSponsorAd()}
                >
                  {(economy.adGrantCooldown ?? 0) > 0
                    ? `Грант (${Math.ceil(economy.adGrantCooldown)}с)`
                    : `+${formatRub(Math.round(7_000 + economy.entrepreneurLevel * 1_500 + upgrades.bays * 2_000))} + Ремонт`}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={(economy.adBoostRemaining ?? 0) > 0}
                  onClick={() => void useGameStore.getState().watchRewardedTurboAd()}
                >
                  {(economy.adBoostRemaining ?? 0) > 0
                    ? `VIP ×1.5 (${Math.ceil(economy.adBoostRemaining)}с)`
                    : 'VIP-кортеж ×1.5'}
                </button>
              </div>
            </div>

            {/* Happy Hour */}
            <div className="ui-card">
              <div className="ui-card-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Zap size={16} color="#ffb800" fill="#ffb800" />
                  <div>
                    <div className="card-title">Счастливый час</div>
                    <div className="card-sub">Скидка -15% для притока авто + скорость +15%</div>
                  </div>
                </div>
                <button
                  id="btn-happy-hour"
                  className="btn-primary btn-amber"
                  disabled={happyActive || happyCooldown}
                  onClick={activateHappyHour}
                >
                  {happyActive
                    ? `${Math.ceil(economy.happyHourRemaining)}с`
                    : happyCooldown
                      ? `КД ${Math.ceil(economy.happyHourCooldown)}с`
                      : 'Запустить'}
                </button>
              </div>
            </div>

            {/* Pricing */}
            <div className="ui-card">
              <div className="ui-card-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sliders size={15} color="#ffb800" />
                  <span className="card-title">Цена мойки</span>
                </div>
                <span className="hud-metric-val val-amber">{formatRub(economy.washPrice)}</span>
              </div>
              <input
                id="input-wash-price"
                type="range"
                min={WASH_PRICE_MIN}
                max={WASH_PRICE_MAX}
                step={WASH_PRICE_STEP}
                value={economy.washPrice}
                onChange={(e) => setWashPrice(Number(e.target.value))}
                className="ui-range"
              />
              <div className="ui-card-row" style={{ fontSize: 12 }}>
                <span className="card-sub">
                  Конкурент: <strong style={{ color: '#ff6b84' }}>{formatRub(compEffPrice)}</strong>
                </span>
                <span className="card-sub">
                  Доля спроса: <strong style={{ color: '#00d4ff' }}>{sharePct}%</strong>
                </span>
              </div>
              <p className="card-sub">
                Рыночная цена для вашего качества: <strong>~{formatRub(fairPrice)}</strong>
              </p>
            </div>

            {/* Advertising */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Megaphone size={14} color="#ff3b5c" />
              <span className="section-label">Рекламные кампании</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AD_ORDER.map((id) => {
                const spec = AD_CAMPAIGNS[id];
                const active = economy.adCampaign === id;
                return (
                  <div
                    key={id}
                    className="ui-card"
                    style={active ? { borderColor: 'var(--accent-cyan)', background: 'rgba(0,212,255,0.08)' } : undefined}
                  >
                    <div className="ui-card-row">
                      <div>
                        <div className="card-title">{spec.title}</div>
                        <div className="card-sub">{spec.description}</div>
                      </div>
                      <button
                        className={active ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setAdCampaign(id)}
                      >
                        {active ? 'Активно' : spec.costPerMin === 0 ? 'Выкл' : formatRubPerMin(spec.costPerMin)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'finance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="seg-group">
              {(
                [
                  ['today', 'День'],
                  ['week', 'Неделя'],
                  ['month', 'Месяц'],
                  ['year', 'Год'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  className={`seg-btn ${period === k ? 'active' : ''}`}
                  onClick={() => setPeriod(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ui-card" style={{ gap: 6 }}>
              <div className="ui-card-row">
                <span className="section-label">Отчёт о прибылях и убытках</span>
                <span className="pill-tag">{bucket.carsWashed} авто</span>
              </div>
              <div className="ui-card-row" style={{ fontSize: 12.5 }}>
                <span className="card-sub">Мойка автомобилей</span>
                <span className="val-positive">{formatRub(bucket.washRevenue)}</span>
              </div>
              <div className="ui-card-row" style={{ fontSize: 12.5 }}>
                <span className="card-sub">Сторонние предприятия</span>
                <span className="val-positive">{formatRub(bucket.enterpriseRevenue)}</span>
              </div>
              <div className="ui-card-row" style={{ fontSize: 12.5 }}>
                <span className="card-sub">Контракты и аренда</span>
                <span className="val-positive">
                  {formatRub(bucket.contractRevenue + bucket.rentIncome)}
                </span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '2px 0' }} />
              <div className="ui-card-row" style={{ fontSize: 12 }}>
                <span className="card-sub">Зарплаты и специалисты</span>
                <span className="val-negative">-{formatRub(bucket.salaries)}</span>
              </div>
              <div className="ui-card-row" style={{ fontSize: 12 }}>
                <span className="card-sub">Вода, химия и электричество</span>
                <span className="val-negative">-{formatRub(bucket.utilities)}</span>
              </div>
              <div className="ui-card-row" style={{ fontSize: 12 }}>
                <span className="card-sub">Аренда, ремонт и реклама</span>
                <span className="val-negative">
                  -{formatRub(bucket.rent + bucket.maintenance + bucket.ads)}
                </span>
              </div>
              <div className="ui-card-row" style={{ fontSize: 12 }}>
                <span className="card-sub">Налоги, проценты, штрафы</span>
                <span className="val-negative">
                  -{formatRub(bucket.taxes + bucket.loanInterest + bucket.insurance + bucket.fines)}
                </span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '2px 0' }} />
              <div className="ui-card-row" style={{ fontSize: 13.5, fontWeight: 800 }}>
                <span>Чистая прибыль</span>
                <span className={bucketTotals.profit >= 0 ? 'val-positive' : 'val-negative'}>
                  {formatRub(bucketTotals.profit, { signed: true })}
                </span>
              </div>
            </div>

            {economy.lastPayoutBreakdown && (
              <div className="ui-card" style={{ gap: 4 }}>
                <span className="section-label">Прозрачный чек последней мойки</span>
                <div className="ui-card-row" style={{ fontSize: 12 }}>
                  <span className="card-sub">Базовый тариф</span>
                  <span>{formatRub(economy.lastPayoutBreakdown.baseTariff)}</span>
                </div>
                <div className="ui-card-row" style={{ fontSize: 12 }}>
                  <span className="card-sub">Технология / Качество</span>
                  <span className="val-positive">
                    +{formatRub(economy.lastPayoutBreakdown.techBonus + economy.lastPayoutBreakdown.qualityTip)}
                  </span>
                </div>
                <div className="ui-card-row" style={{ fontSize: 12 }}>
                  <span className="card-sub">Комбо / VIP / Событие</span>
                  <span className="val-positive">
                    +{formatRub(
                      economy.lastPayoutBreakdown.comboBonus +
                        economy.lastPayoutBreakdown.vipBonus +
                        economy.lastPayoutBreakdown.eventBonus
                    )}
                  </span>
                </div>
                <div className="ui-card-row" style={{ fontSize: 13, fontWeight: 800 }}>
                  <span>Итого клиентом оплачено</span>
                  <span className="val-cyan">{formatRub(economy.lastPayoutBreakdown.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'tax' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ui-card">
              <div className="ui-card-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Receipt size={15} color="#fbbf24" />
                  <span className="card-title">ФНС • Налоговая инспекция</span>
                </div>
                <span
                  className="pill-tag"
                  style={{
                    color: empire.tax.auditRisk > 45 ? '#ff6b84' : '#22c55e',
                  }}
                >
                  Риск проверки: {empire.tax.auditRisk}%
                </span>
              </div>

              <div className="stat-grid-2">
                <div className="stat-box">
                  <span className="hud-metric-label">К оплате всего</span>
                  <span className="hud-metric-val val-amber">{formatRub(taxTotal)}</span>
                </div>
                <div className="stat-box">
                  <span className="hud-metric-label">Просрочка</span>
                  <span className="hud-metric-val val-negative">
                    {formatRub(empire.tax.overdueAmount)}
                  </span>
                </div>
              </div>

              <div className="ui-card-row" style={{ gap: 8 }}>
                <button
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={taxTotal <= 0 || economy.balance < taxTotal}
                  onClick={payTaxes}
                >
                  Оплатить {formatRub(taxTotal)}
                </button>
                <button className="btn-secondary" onClick={fileTaxDeclaration}>
                  Подать декларацию
                </button>
              </div>
            </div>

            <span className="section-label">Документы и разрешения</span>
            {DOCUMENTS_CATALOG.map((doc) => {
              const owned = empire.tax.documents[doc.id];
              const levelOk = economy.entrepreneurLevel >= doc.unlockLevel;
              return (
                <div key={doc.id} className="ui-card">
                  <div className="ui-card-row">
                    <div>
                      <div className="card-title">{doc.title}</div>
                      <div className="card-sub">{doc.subtitle}</div>
                    </div>
                    {owned ? (
                      <span className="pill-tag emerald">
                        <CheckCircle2 size={12} /> Есть
                      </span>
                    ) : (
                      <button
                        className="btn-primary"
                        disabled={!levelOk || economy.balance < doc.cost}
                        onClick={() => buyDocument(doc.id)}
                      >
                        {!levelOk ? `Ур. ${doc.unlockLevel}` : formatRub(doc.cost)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'bank' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ui-card">
              <div className="ui-card-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Landmark size={15} color="#38bdf8" />
                  <span className="card-title">Кредитный рейтинг</span>
                </div>
                <span className="hud-metric-val val-cyan">{empire.bank.creditScore} / 850</span>
              </div>
              <div className="ui-card-row" style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={14} color="#22c55e" />
                  <span className="card-sub">
                    Страхование бизнеса ({formatRubPerMin(empire.bank.insuranceCostPerMin)})
                  </span>
                </div>
                <button
                  className={empire.bank.insuranceActive ? 'btn-primary' : 'btn-secondary'}
                  onClick={toggleInsurance}
                >
                  {empire.bank.insuranceActive ? 'Активно' : 'Включить'}
                </button>
              </div>
            </div>

            {empire.bank.loans.length > 0 && (
              <div className="ui-card">
                <span className="section-label">Активные кредиты</span>
                {empire.bank.loans.map((l) => (
                  <div key={l.id} className="stat-box" style={{ gap: 5 }}>
                    <div className="ui-card-row">
                      <span className="card-title">{l.title}</span>
                      <span className="val-negative">{formatRub(l.remaining)}</span>
                    </div>
                    <div className="ui-card-row" style={{ fontSize: 11.5 }}>
                      <span className="card-sub">
                        Платёж {formatRub(l.paymentPerDay)}/день • Осталось {l.daysLeft} дн.
                      </span>
                      <button
                        className="btn-secondary"
                        style={{ height: 28, fontSize: 11 }}
                        disabled={economy.balance < l.remaining}
                        onClick={() => repayLoan(l.id)}
                      >
                        Погасить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <span className="section-label">Кредитные программы</span>
            {LOAN_PRODUCTS.map((prod, idx) => {
              const eligible =
                economy.entrepreneurLevel >= prod.minLevel &&
                empire.bank.creditScore >= prod.minCreditScore &&
                empire.bank.loans.length < 3;
              return (
                <div key={prod.title} className="ui-card">
                  <div className="ui-card-row">
                    <div>
                      <div className="card-title">{prod.title}</div>
                      <div className="card-sub">
                        {prod.subtitle} • {Math.round(prod.annualRate * 100)}% • {prod.days} дн.
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      disabled={!eligible}
                      onClick={() => takeLoan(idx)}
                    >
                      +{formatRub(prod.amount)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
