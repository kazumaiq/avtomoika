import {
  BarChart3,
  Briefcase,
  Crown,
  Megaphone,
  Sliders,
  X,
  Zap,
} from 'lucide-react';
import { getBusinessRank } from '../../config/progression';
import {
  AD_CAMPAIGNS,
  WASH_PRICE_MAX,
  WASH_PRICE_MIN,
  WASH_PRICE_STEP,
  getPlayerQualityScore,
} from '../../config/upgrades';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { AdCampaignId } from '../../types/game';
import { formatRub, formatRubPerMin } from '../../utils/currency';

const AD_ORDER: AdCampaignId[] = ['none', 'flyers', 'billboard', 'radio'];

export function BusinessPanel() {
  const economy = useGameStore((s) => s.economy);
  const upgrades = useGameStore((s) => s.upgrades);
  const competitor = useGameStore((s) => s.competitor);
  const setWashPrice = useGameStore((s) => s.setWashPrice);
  const setAdCampaign = useGameStore((s) => s.setAdCampaign);
  const activateHappyHour = useGameStore((s) => s.activateHappyHour);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const quality = getPlayerQualityScore(upgrades);
  const sharePct = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
  const compEffPrice = competitor.promoActive
    ? Math.round(competitor.price * 0.82)
    : competitor.price;

  const rankInfo = getBusinessRank(economy, upgrades);
  const happyActive = economy.happyHourRemaining > 0;
  const happyCooldown = economy.happyHourCooldown > 0;

  // Build SVG polyline points for live revenue chart
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

  const maxVal = Math.max(
    1500,
    ...pts.map((p) => Math.max(p.playerRev, p.compRev))
  );
  const W = 320;
  const H = 82;
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
        {/* Business Rank Card */}
        <div className="ui-card" style={{ borderColor: `${rankInfo.current.color}55` }}>
          <div className="ui-card-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Crown size={16} color={rankInfo.current.color} />
              <div>
                <div className="hud-metric-label">Статус бизнеса</div>
                <div className="card-title" style={{ color: rankInfo.current.color }}>
                  {rankInfo.current.title}
                </div>
              </div>
            </div>
            <span className="pill-tag">
              {Math.round(rankInfo.progress * 100)}%
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.round(rankInfo.progress * 100)}%`,
                background: rankInfo.current.color,
              }}
            />
          </div>
          {rankInfo.next ? (
            <div className="card-sub">
              Следующий ранг: <strong>{rankInfo.next.title}</strong> ({formatRub(rankInfo.next.minRevenue)} выручки, ★{rankInfo.next.minReputation.toFixed(1)}, {rankInfo.next.minBays} бокса)
            </div>
          ) : (
            <div className="card-sub" style={{ color: '#22c55e' }}>
              Вы достигли вершины автомоечного бизнеса!
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
            <span className="hud-metric-label">Обслужено авто</span>
            <span className="hud-metric-val">{economy.carsWashed}</span>
          </div>
          <div className="stat-box">
            <span className="hud-metric-label">Качество сервиса</span>
            <span className="hud-metric-val val-cyan">{quality.toFixed(1)} / 5.0</span>
          </div>
        </div>

        {/* Live Revenue Chart */}
        <div className="ui-card">
          <div className="ui-card-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart3 size={14} color="#00d4ff" />
              <span className="section-label">Выручка / мин (динамика)</span>
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
              <line x1="6" y1={H - 6} x2={W - 6} y2={H - 6} stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
              <line x1="6" y1={H / 2} x2={W - 6} y2={H / 2} stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" strokeWidth="1" />
              <polygon points={playerArea} fill="url(#playerChartGrad)" />
              <polyline
                fill="none"
                stroke="#ff6b84"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={compLine}
              />
              <polyline
                fill="none"
                stroke="#00d4ff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={playerLine}
              />
            </svg>
          </div>
        </div>

        {/* Happy Hour Tactical Boost */}
        <div
          className="ui-card"
          style={
            happyActive
              ? {
                  borderColor: 'rgba(255, 184, 0, 0.7)',
                  background: 'rgba(255, 184, 0, 0.12)',
                }
              : undefined
          }
        >
          <div className="ui-card-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Zap size={16} color="#ffb800" fill="#ffb800" />
              <div>
                <div className="card-title">Счастливый час</div>
                <div className="card-sub">Скидка -15% для наплыва авто + скорость мойки +25%</div>
              </div>
            </div>
            <button
              id="btn-happy-hour"
              className={happyActive ? 'btn-primary btn-amber' : 'btn-primary btn-amber'}
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

        {/* Dynamic Wash Pricing Control */}
        <div className="ui-card">
          <div className="ui-card-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={15} color="#ffb800" />
              <span className="card-title">Базовая цена мойки</span>
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
              Спрос к вам: <strong style={{ color: '#00d4ff' }}>{sharePct}%</strong>
            </span>
          </div>

          <p className="card-sub">
            Спорткары и VIP-клиенты платят в 2–3 раза выше базовой цены. Поднимайте чек по мере
            роста рейтинга и оборудования.
          </p>
        </div>

        {/* Advertising Campaigns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
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
                style={
                  active
                    ? {
                        borderColor: 'var(--accent-cyan)',
                        background: 'rgba(0, 212, 255, 0.1)',
                      }
                    : undefined
                }
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
                    {active
                      ? 'Активно'
                      : spec.costPerMin === 0
                        ? 'Выкл'
                        : formatRubPerMin(spec.costPerMin)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
