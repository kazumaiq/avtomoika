import {
  Crown,
  FastForward,
  Flame,
  Gift,
  Home,
  Moon,
  Pause,
  Play,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { CITY_EVENTS, QUEST_CHAIN } from '../config/progression';
import { SHIFT_END_TIME, SHIFT_START_TIME, gameSimulation } from '../engine/simulation';
import { resolveEffectiveTime } from '../scene/LightingAndSky';
import { useGameStore } from '../store/useGameStore';
import { formatRub } from '../utils/currency';

function formatClock(t: number): string {
  const totalMinutes = Math.floor(t * 24 * 60) % (24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getPhaseMeta(t: number): { label: string; color: string; icon: 'morning' | 'day' | 'sunset' | 'night' } {
  const hour = t * 24;
  if (hour < 10.5) return { label: 'Утро', color: '#fcd34d', icon: 'morning' };
  if (hour < 16.5) return { label: 'День', color: '#38bdf8', icon: 'day' };
  if (hour < 19.8) return { label: 'Закат', color: '#fb923c', icon: 'sunset' };
  return { label: 'Вечер', color: '#a5b4fc', icon: 'night' };
}

function PhaseIcon({ kind, color }: { kind: 'morning' | 'day' | 'sunset' | 'night'; color: string }) {
  if (kind === 'morning') return <Sunrise size={13} color={color} />;
  if (kind === 'day') return <Sun size={13} color={color} />;
  if (kind === 'sunset') return <Sunset size={13} color={color} />;
  return <Moon size={13} color={color} />;
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

  const [sharePct, setSharePct] = useState(50);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSharePct(Math.round(gameSimulation.getPlayerAttractionShare() * 100));
    }, 650);
    return () => window.clearInterval(id);
  }, []);

  const effTime = resolveEffectiveTime(timeOfDay, timeMode);
  const phase = getPhaseMeta(effTime);
  const shiftPct = Math.min(
    100,
    Math.max(0, Math.round(((effTime - SHIFT_START_TIME) / (SHIFT_END_TIME - SHIFT_START_TIME)) * 100))
  );
  const net = economy.profitPerMin;

  // Next active quest
  const activeQuest = QUEST_CHAIN.find((q) => !claimedQuestIds.includes(q.id)) ?? null;
  const questSnapshot = {
    economy,
    upgrades,
    workers,
    playerSharePct: sharePct,
  };
  const questCurrent = activeQuest ? activeQuest.getCurrent(questSnapshot) : 0;
  const questPct = activeQuest
    ? Math.min(100, Math.round((questCurrent / Math.max(1, activeQuest.target)) * 100))
    : 100;
  const questReady = activeQuest !== null && questCurrent >= activeQuest.target;
  const questProgressText = activeQuest
    ? activeQuest.formatProgress
      ? activeQuest.formatProgress(questCurrent, activeQuest.target)
      : `${Math.min(questCurrent, activeQuest.target)}/${activeQuest.target}`
    : '';

  const eventSpec = activeEvent ? CITY_EVENTS[activeEvent.id] : null;
  const comboTipBonus = Math.min(20, Math.floor(economy.combo / 2) * 2);

  const cycleSpeed = () => {
    const next: 1 | 2 | 3 = simSpeed === 1 ? 2 : simSpeed === 2 ? 3 : 1;
    setSimSpeed(next);
  };

  return (
    <div className="top-hud-stack">
      <header className="top-hud">
        {/* Clean Primary Metrics Bar (Balance, Profit/min, Rating, Shift Clock) */}
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
            <div>
              <div className="hud-metric-label">В мин</div>
              <div className={`hud-metric-val ${net >= 0 ? 'val-positive' : 'val-negative'}`}>
                {formatRub(net, { signed: true, compact: Math.abs(net) >= 100_000 })}
              </div>
            </div>
          </div>

          <div className="hud-metric">
            <Star size={12} color="#ffb800" fill="#ffb800" />
            <div>
              <div className="hud-metric-label">Рейтинг</div>
              <div className="hud-metric-val val-amber">{economy.reputation.toFixed(1)}</div>
            </div>
          </div>

          {/* Always-visible Work Shift Clock (07:00 -> 22:00) so time is felt on iPhone & desktop! */}
          <div className="hud-metric hud-clock-metric" title={`День ${day} • ${phase.label} (смена 07:00–22:00)`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 66 }}>
              <div className="hud-clock-top">
                <PhaseIcon kind={phase.icon} color={phase.color} />
                <span className="hud-metric-val" style={{ fontSize: 12.5 }}>
                  {formatClock(effTime)}
                </span>
                <span className="hud-day-tag">Д{day}</span>
              </div>
              <div className="shift-mini-track">
                <span
                  className="shift-mini-fill"
                  style={{ width: `${shiftPct}%`, background: phase.color }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Speed & System Controls */}
        <div className="hud-pill-group hud-controls-bar hud-interactive">
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
            title="Скорость (1x / 2x / 3x)"
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
            title="Меню"
          >
            <Home size={14} />
          </button>
        </div>
      </header>

      {/* Single Ultra-Clean Sub-Row: Quest Pill + Active Status Chips */}
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
              {questReady ? <Gift size={13} /> : <Target size={13} />}
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
            <Crown size={13} color="#facc15" />
            <span className="quest-title">Империя AUTOMOIKA</span>
          </div>
        )}

        <div className="hud-status-pills">
          {economy.combo >= 2 && (
            <div className="combo-pill hud-interactive" title="Серия без потерь очереди">
              <Flame size={12} color="#fb923c" fill="#fb923c" />
              <span>×{economy.combo}</span>
              <span className="combo-bonus">+{comboTipBonus}%</span>
            </div>
          )}

          {economy.happyHourRemaining > 0 && (
            <div className="event-pill amber hud-interactive">
              <Zap size={12} color="#ffb800" fill="#ffb800" />
              <span>{Math.ceil(economy.happyHourRemaining)}с</span>
            </div>
          )}

          {eventSpec && activeEvent && (
            <div
              className="event-pill hud-interactive"
              style={{ borderColor: eventSpec.accentColor }}
            >
              <Sparkles size={12} color={eventSpec.accentColor} />
              <span>{eventSpec.title}</span>
              <span className="event-timer">{Math.ceil(activeEvent.remainingSec)}с</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
