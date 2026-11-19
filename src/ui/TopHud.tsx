import {
  Car,
  Crown,
  FastForward,
  Flame,
  Gift,
  Home,
  Pause,
  Play,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { CITY_EVENTS, QUEST_CHAIN } from '../config/progression';
import { gameSimulation } from '../engine/simulation';
import { resolveEffectiveTime } from '../scene/LightingAndSky';
import { useGameStore } from '../store/useGameStore';
import { formatRub } from '../utils/currency';

function formatClock(t: number): string {
  const totalMinutes = Math.floor(t * 24 * 60) % (24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TopHud() {
  const economy = useGameStore((s) => s.economy);
  const upgrades = useGameStore((s) => s.upgrades);
  const workers = useGameStore((s) => s.workers);
  const day = useGameStore((s) => s.day);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const timeMode = useGameStore((s) => s.settings.timeMode);
  const paused = useGameStore((s) => s.paused);
  const simSpeed = useGameStore((s) => s.simSpeed);
  const muted = useGameStore((s) => s.settings.muted);
  const activeEvent = useGameStore((s) => s.activeEvent);
  const claimedQuestIds = useGameStore((s) => s.claimedQuestIds);

  const togglePause = useGameStore((s) => s.togglePause);
  const setSimSpeed = useGameStore((s) => s.setSimSpeed);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const returnToTitle = useGameStore((s) => s.returnToTitle);
  const claimQuestReward = useGameStore((s) => s.claimQuestReward);

  const [liveStats, setLiveStats] = useState({ queue: 0, washing: 0, share: 50 });

  useEffect(() => {
    const id = window.setInterval(() => {
      const queue = gameSimulation.getQueueCount('player');
      const washing = gameSimulation.vehicles.filter(
        (v) => v.owner === 'player' && (v.state === 'washing' || v.state === 'moving_to_bay')
      ).length;
      const share = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
      setLiveStats({ queue, washing, share });
    }, 320);
    return () => window.clearInterval(id);
  }, []);

  const effTime = resolveEffectiveTime(timeOfDay, timeMode);
  const net = economy.profitPerMin;

  // Next active quest from QUEST_CHAIN
  const activeQuest = QUEST_CHAIN.find((q) => !claimedQuestIds.includes(q.id)) ?? null;
  const questSnapshot = {
    economy,
    upgrades,
    workers,
    playerSharePct: liveStats.share,
  };
  const questCurrent = activeQuest ? activeQuest.getCurrent(questSnapshot) : 0;
  const questPct = activeQuest
    ? Math.min(100, Math.round((questCurrent / Math.max(1, activeQuest.target)) * 100))
    : 100;
  const questReady = activeQuest !== null && questCurrent >= activeQuest.target;
  const questProgressText = activeQuest
    ? activeQuest.formatProgress
      ? activeQuest.formatProgress(questCurrent, activeQuest.target)
      : `${Math.min(questCurrent, activeQuest.target)} / ${activeQuest.target}`
    : '';

  const eventSpec = activeEvent ? CITY_EVENTS[activeEvent.id] : null;
  const comboTipBonus = Math.min(50, Math.round(economy.combo * 5));

  const cycleSpeed = () => {
    const next: 1 | 2 | 3 = simSpeed === 1 ? 2 : simSpeed === 2 ? 3 : 1;
    setSimSpeed(next);
  };

  return (
    <div className="top-hud-stack">
      <header className="top-hud">
        {/* Primary Financial & Business Metrics */}
        <div className="hud-pill-group hud-metrics-bar hud-interactive">
          <div className="hud-metric">
            <div>
              <div className="hud-metric-label">Баланс</div>
              <div className="hud-metric-val val-balance">
                {formatRub(economy.balance, { compact: economy.balance >= 1_000_000 })}
              </div>
            </div>
          </div>

          <div className="hud-metric">
            {net >= 0 ? (
              <TrendingUp size={14} color="#22c55e" className="hide-mobile" />
            ) : (
              <TrendingDown size={14} color="#ff3b5c" className="hide-mobile" />
            )}
            <div>
              <div className="hud-metric-label">Прибыль/м</div>
              <div className={`hud-metric-val ${net >= 0 ? 'val-positive' : 'val-negative'}`}>
                {formatRub(net, { signed: true, compact: Math.abs(net) >= 100_000 })}
              </div>
            </div>
          </div>

          <div className="hud-metric">
            <Star size={13} color="#ffb800" fill="#ffb800" />
            <div>
              <div className="hud-metric-label">Рейтинг</div>
              <div className="hud-metric-val val-amber">{economy.reputation.toFixed(2)}</div>
            </div>
          </div>

          <div className="hud-metric">
            <Car size={14} color="#00d4ff" className="hide-mobile" />
            <div>
              <div className="hud-metric-label">Клиенты</div>
              <div className="hud-metric-val val-cyan">
                {liveStats.washing}/{liveStats.queue}
              </div>
            </div>
          </div>

          <div className="hud-metric hide-mobile">
            <div>
              <div className="hud-metric-label">Рынок</div>
              <div className="hud-metric-val">{liveStats.share}%</div>
            </div>
          </div>
        </div>

        {/* Time, Speed & System Controls */}
        <div className="hud-pill-group hud-controls-bar hud-interactive">
          <div className="hud-metric hide-mobile" style={{ paddingRight: 10 }}>
            <div>
              <div className="hud-metric-label">День {day}</div>
              <div className="hud-metric-val">{formatClock(effTime)}</div>
            </div>
          </div>

          <button
            id="btn-toggle-pause"
            className={`icon-btn ${paused ? 'active' : ''}`}
            onClick={togglePause}
            title={paused ? 'Продолжить' : 'Пауза'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>

          <button
            id="btn-speed-toggle"
            className={`icon-btn ${!paused && simSpeed > 1 ? 'active' : ''}`}
            onClick={cycleSpeed}
            title="Скорость симуляции (1x / 2x / 3x)"
          >
            <FastForward size={13} />
            <span>{simSpeed}x</span>
          </button>

          <button
            id="btn-toggle-mute"
            className="icon-btn"
            onClick={() => {
              soundEngine.unlock();
              updateSettings({ muted: !muted });
            }}
            title={muted ? 'Включить звук' : 'Выключить звук'}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          <button
            id="btn-main-menu"
            className="icon-btn"
            onClick={returnToTitle}
            title="Главное меню"
          >
            <Home size={14} />
          </button>
        </div>
      </header>

      {/* Secondary Gameplay Strip: Quest Goal Tracker, Combo Streak & Active City Events */}
      <div className="hud-sub-strip">
        {activeQuest ? (
          <button
            id="btn-quest-tracker"
            type="button"
            className={`quest-pill hud-interactive ${questReady ? 'ready' : ''}`}
            onClick={() => {
              if (questReady) claimQuestReward(activeQuest.id);
            }}
            title={activeQuest.description}
          >
            <span className="quest-icon">
              {questReady ? <Gift size={14} /> : <Target size={14} />}
            </span>
            <span className="quest-text">
              <span className="quest-title-row">
                <span className="quest-title">{activeQuest.title}</span>
                <span className="quest-reward">
                  {questReady ? `Забрать +${formatRub(activeQuest.reward)}` : `+${formatRub(activeQuest.reward)}`}
                </span>
              </span>
              <span className="quest-meta-row">
                <span className="quest-bar">
                  <span className="quest-bar-fill" style={{ width: `${questPct}%` }} />
                </span>
                <span className="quest-progress-val">{questProgressText}</span>
              </span>
            </span>
          </button>
        ) : (
          <div className="quest-pill completed hud-interactive">
            <Crown size={14} color="#facc15" />
            <span className="quest-title">Все цели выполнены • Империя AUTOMOIKA</span>
          </div>
        )}

        <div className="hud-status-pills">
          {economy.combo >= 2 && (
            <div className="combo-pill hud-interactive" title="Серия без потерь очереди увеличивает чаевые!">
              <Flame size={13} color="#fb923c" fill="#fb923c" />
              <span>Серия ×{economy.combo}</span>
              <span className="combo-bonus">+{comboTipBonus}%</span>
            </div>
          )}

          {economy.happyHourRemaining > 0 && (
            <div className="event-pill amber hud-interactive">
              <Zap size={13} color="#ffb800" fill="#ffb800" />
              <span>Счастливый час • {Math.ceil(economy.happyHourRemaining)}с</span>
            </div>
          )}

          {eventSpec && activeEvent && (
            <div
              className="event-pill hud-interactive"
              style={{ borderColor: eventSpec.accentColor }}
              title={eventSpec.subtitle}
            >
              <Sparkles size={13} color={eventSpec.accentColor} />
              <span>{eventSpec.title}</span>
              <span className="event-timer">{Math.ceil(activeEvent.remainingSec)}с</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
