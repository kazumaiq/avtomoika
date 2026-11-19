import { AlertTriangle, Eye, Swords, X, Zap } from 'lucide-react';
import { DISTRICTS, DISTRICT_ORDER } from '../../config/empire';
import { getPlayerQualityScore } from '../../config/upgrades';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { CompetitorStrategy } from '../../types/game';
import { formatRub } from '../../utils/currency';

const STRATEGY_LABELS: Record<CompetitorStrategy, { label: string; color: string }> = {
  aggressive_price: { label: 'Агрессивный демпинг', color: '#ff3b5c' },
  premium_service: { label: 'Премиум-сервис', color: '#a855f7' },
  mass_flow: { label: 'Массовый поток', color: '#00d4ff' },
  cost_cutting: { label: 'Экономия расходов', color: '#fbbf24' },
  expansion_invest: { label: 'Инвестиции и рост', color: '#22c55e' },
};

export function CompetitorPanel() {
  const economy = useGameStore((s) => s.economy);
  const upgrades = useGameStore((s) => s.upgrades);
  const competitor = useGameStore((s) => s.competitor);
  const empire = useGameStore((s) => s.empire);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const activateHappyHour = useGameStore((s) => s.activateHappyHour);

  const playerQuality = getPlayerQualityScore(upgrades);
  const playerShare = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
  const compShare = 100 - playerShare;
  const strat = STRATEGY_LABELS[competitor.strategy] ?? STRATEGY_LABELS.mass_flow;

  const compEffectivePrice = competitor.promoActive
    ? Math.round((competitor.price * 0.82) / 10) * 10
    : competitor.price;

  const playerEffectivePrice =
    economy.happyHourRemaining > 0
      ? Math.round((economy.washPrice * 0.85) / 10) * 10
      : economy.washPrice;

  const happyReady =
    economy.happyHourRemaining <= 0 && economy.happyHourCooldown <= 0;

  const playerAvgCheck =
    economy.carsWashed > 0 ? Math.round(economy.totalRevenue / economy.carsWashed) : economy.washPrice;

  const rows: Array<{
    label: string;
    playerVal: string;
    compVal: string;
    playerWins: boolean;
  }> = [
    {
      label: 'Капитал (баланс)',
      playerVal: formatRub(economy.balance, { compact: Math.abs(economy.balance) >= 1_000_000 }),
      compVal: formatRub(competitor.balance, { compact: Math.abs(competitor.balance) >= 1_000_000 }),
      playerWins: economy.balance >= competitor.balance,
    },
    {
      label: 'Прибыль / мин',
      playerVal: formatRub(economy.profitPerMin, { signed: true }),
      compVal: formatRub(competitor.profitPerMin, { signed: true }),
      playerWins: economy.profitPerMin >= competitor.profitPerMin,
    },
    {
      label: 'Выручка / мин',
      playerVal: formatRub(economy.incomePerMin),
      compVal: formatRub(competitor.revenuePerMin),
      playerWins: economy.incomePerMin >= competitor.revenuePerMin,
    },
    {
      label: 'Средний чек',
      playerVal: formatRub(playerAvgCheck),
      compVal: formatRub(competitor.avgCheck),
      playerWins: playerAvgCheck >= competitor.avgCheck,
    },
    {
      label: 'Текущая цена',
      playerVal: formatRub(playerEffectivePrice),
      compVal: formatRub(compEffectivePrice),
      playerWins: playerEffectivePrice <= compEffectivePrice,
    },
    {
      label: 'Качество мойки',
      playerVal: `${playerQuality.toFixed(1)} ★`,
      compVal: `${competitor.quality.toFixed(1)} ★`,
      playerWins: playerQuality >= competitor.quality,
    },
    {
      label: 'Репутация',
      playerVal: `${economy.reputation.toFixed(2)} ★`,
      compVal: `${competitor.reputation.toFixed(2)} ★`,
      playerWins: economy.reputation >= competitor.reputation,
    },
    {
      label: 'Боксы / Персонал',
      playerVal: `${upgrades.bays} бок.`,
      compVal: `${competitor.bays} бок. / ${competitor.staffCount} шт.`,
      playerWins: upgrades.bays >= competitor.bays,
    },
  ];

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Swords size={18} color="#ff3b5c" />
          <h2 className="panel-title">Рынок: {competitor.name}</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        {/* Competitor live strategy card */}
        <div className="ui-card" style={{ borderColor: `${strat.color}55` }}>
          <div className="ui-card-row">
            <span className="card-sub">Стратегия конкурента</span>
            <span className="pill-tag" style={{ color: strat.color, fontWeight: 800 }}>
              {strat.label}
            </span>
          </div>
          <div className="card-sub">
            {competitor.name} работает на собственном бюджете ({formatRub(competitor.balance)}):
            платит аренду, зарплаты и вкладывает реальную прибыль в боксы и рекламу.
          </div>
        </div>

        {competitor.promoActive && (
          <div
            className="ui-card"
            style={{
              borderColor: 'rgba(255, 59, 92, 0.55)',
              background: 'rgba(255, 59, 92, 0.14)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#ff6b84" />
              <span className="card-title" style={{ color: '#ffb3c0' }}>
                Ценовая война: {competitor.name} -18%!
              </span>
            </div>
            <span className="card-sub">
              Конкурент сбил цену, чтобы отбить долю рынка.
            </span>
          </div>
        )}

        {/* Market Share Split Bar */}
        <div className="ui-card">
          <div className="ui-card-row">
            <span className="card-title val-cyan">AUTOMOIKA {playerShare}%</span>
            <span className="card-title val-negative">
              {compShare}% {competitor.name}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 99,
              overflow: 'hidden',
              background: '#2a1d28',
            }}
          >
            <div
              style={{
                width: `${playerShare}%`,
                background: 'linear-gradient(90deg, #00d4ff, #22c55e)',
                transition: 'width 0.35s ease',
              }}
            />
            <div
              style={{
                width: `${compShare}%`,
                background: 'linear-gradient(90deg, #ff4d4f, #f97316)',
                transition: 'width 0.35s ease',
              }}
            />
          </div>
        </div>

        {/* Head-to-Head Comparison Table */}
        <div className="ui-card" style={{ gap: 6 }}>
          <div
            className="ui-card-row"
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              paddingBottom: 4,
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ flex: 1 }}>Показатель</span>
            <span style={{ width: 92, textAlign: 'right', color: '#00d4ff' }}>Вы</span>
            <span style={{ width: 92, textAlign: 'right', color: '#ff6b84' }}>Соперник</span>
          </div>

          {rows.map((r) => (
            <div
              key={r.label}
              className="ui-card-row"
              style={{
                padding: '4px 0',
                borderBottom: '1px solid rgba(148,163,184,0.08)',
                fontSize: 12.5,
              }}
            >
              <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span
                style={{
                  width: 92,
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: r.playerWins ? '#22c55e' : '#f8fafc',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.playerVal}
              </span>
              <span
                style={{
                  width: 92,
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: !r.playerWins ? '#ff6b84' : '#94a3b8',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.compVal}
              </span>
            </div>
          ))}
        </div>

        {/* District Rivals Overview */}
        <div className="ui-card" style={{ gap: 6 }}>
          <span className="section-label">Конкуренты по районам города</span>
          {DISTRICT_ORDER.map((id) => {
            const d = DISTRICTS[id];
            const r = empire.districtRivals[id];
            return (
              <div key={id} className="ui-card-row" style={{ fontSize: 12 }}>
                <span style={{ color: id === empire.activeDistrict ? d.accentColor : '#94a3b8' }}>
                  {d.name}: <strong>{r.name}</strong>
                </span>
                <span style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
                  {r.bays}б • {formatRub(r.price)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="ui-card-row" style={{ gap: 8 }}>
          {happyReady && (
            <button
              className="btn-primary btn-amber"
              style={{ flex: 1 }}
              onClick={activateHappyHour}
            >
              <Zap size={14} fill="currentColor" />
              Счастливый час
            </button>
          )}
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => {
              setCameraPreset('competitor');
              setActivePanel(null);
            }}
          >
            <Eye size={14} />
            К сопернику
          </button>
        </div>
      </div>
    </div>
  );
}
