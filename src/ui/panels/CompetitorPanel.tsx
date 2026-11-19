import { AlertTriangle, Eye, Swords, X, Zap } from 'lucide-react';
import { getPlayerQualityScore } from '../../config/upgrades';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import { formatRub } from '../../utils/currency';

export function CompetitorPanel() {
  const economy = useGameStore((s) => s.economy);
  const upgrades = useGameStore((s) => s.upgrades);
  const competitor = useGameStore((s) => s.competitor);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const activateHappyHour = useGameStore((s) => s.activateHappyHour);

  const playerQuality = getPlayerQualityScore(upgrades);
  const playerShare = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
  const compShare = 100 - playerShare;

  const compEffectivePrice = competitor.promoActive
    ? Math.round(competitor.price * 0.82)
    : competitor.price;

  const playerEffectivePrice =
    economy.happyHourRemaining > 0
      ? Math.round(economy.washPrice * 0.85)
      : economy.washPrice;

  const happyReady =
    economy.happyHourRemaining <= 0 && economy.happyHourCooldown <= 0;

  const rows: Array<{
    label: string;
    playerVal: string;
    compVal: string;
    playerWins: boolean;
  }> = [
    {
      label: 'Выручка / мин',
      playerVal: formatRub(economy.incomePerMin),
      compVal: formatRub(competitor.revenuePerMin),
      playerWins: economy.incomePerMin >= competitor.revenuePerMin,
    },
    {
      label: 'Обслужено машин',
      playerVal: `${economy.carsWashed}`,
      compVal: `${competitor.carsWashed}`,
      playerWins: economy.carsWashed >= competitor.carsWashed,
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
      label: 'Моечные боксы',
      playerVal: `${upgrades.bays}`,
      compVal: `${competitor.bays}`,
      playerWins: upgrades.bays >= competitor.bays,
    },
    {
      label: 'Очередь сейчас',
      playerVal: `${gameSimulation.getQueueCount('player')}`,
      compVal: `${gameSimulation.getQueueCount('competitor')}`,
      playerWins:
        gameSimulation.getQueueCount('player') <= gameSimulation.getQueueCount('competitor'),
    },
  ];

  // Dynamic strategic insight
  let tip =
    'Отличный баланс! Расширяйте боксы и нанимайте мастеров, чтобы перехватить основной поток проспекта.';
  if (competitor.promoActive) {
    tip =
      'TURBO SHINE запустил скидку -18%! Запустите «Счастливый час» или рекламу, чтобы перехватить клиентов.';
  } else if (
    playerEffectivePrice > compEffectivePrice + 250 &&
    playerQuality < competitor.quality + 0.6
  ) {
    tip =
      'Ваша цена ощутимо выше конкурента при схожем качестве. Улучшите пену и воск или слегка снизьте цену.';
  } else if (upgrades.bays < competitor.bays) {
    tip = `У конкурента ${competitor.bays} бокса, а у вас ${upgrades.bays}. Откройте новый бокс во вкладке «Улучшения»!`;
  }

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Swords size={18} color="#ff3b5c" />
          <h2 className="panel-title">Конкуренция: TURBO SHINE</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
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
                Конкурент запустил акцию -18%!
              </span>
            </div>
            <span className="card-sub">
              Напротив горит баннер скидки — часть трафика временно уходит в TURBO SHINE.
            </span>
          </div>
        )}

        {/* Market Share Split Bar */}
        <div className="ui-card">
          <div className="ui-card-row">
            <span className="card-title val-cyan">AUTOMOIKA {playerShare}%</span>
            <span className="card-title val-negative">{compShare}% TURBO SHINE</span>
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
          <div className="ui-card-row" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Всего заработано: {formatRub(economy.totalRevenue, { compact: economy.totalRevenue >= 1_000_000 })}</span>
            <span>Соперник: {formatRub(competitor.totalRevenue, { compact: competitor.totalRevenue >= 1_000_000 })}</span>
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

        {/* Strategic Tip & Quick Actions */}
        <div className="ui-card">
          <span className="section-label">Совет аналитика</span>
          <p className="card-sub" style={{ color: '#e2e8f0' }}>
            {tip}
          </p>
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
    </div>
  );
}
