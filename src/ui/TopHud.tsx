import {
  Car,
  FastForward,
  Home,
  Pause,
  Play,
  Star,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { gameSimulation } from '../engine/simulation';
import { useGameStore } from '../store/useGameStore';
import { resolveEffectiveTime } from '../scene/LightingAndSky';

function formatClock(t: number): string {
  const totalMinutes = Math.floor(t * 24 * 60) % (24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TopHud() {
  const economy = useGameStore((s) => s.economy);
  const day = useGameStore((s) => s.day);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const timeMode = useGameStore((s) => s.settings.timeMode);
  const paused = useGameStore((s) => s.paused);
  const simSpeed = useGameStore((s) => s.simSpeed);
  const muted = useGameStore((s) => s.settings.muted);

  const togglePause = useGameStore((s) => s.togglePause);
  const setSimSpeed = useGameStore((s) => s.setSimSpeed);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const returnToTitle = useGameStore((s) => s.returnToTitle);

  const [liveStats, setLiveStats] = useState({ queue: 0, washing: 0, share: 50 });

  useEffect(() => {
    const id = window.setInterval(() => {
      const queue = gameSimulation.getQueueCount('player');
      const washing = gameSimulation.vehicles.filter(
        (v) => v.owner === 'player' && (v.state === 'washing' || v.state === 'moving_to_bay')
      ).length;
      const share = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
      setLiveStats({ queue, washing, share });
    }, 350);
    return () => window.clearInterval(id);
  }, []);

  const effTime = resolveEffectiveTime(timeOfDay, timeMode);
  const net = economy.profitPerMin;

  return (
    <header className="top-hud">
      {/* Primary Financial & Business Metrics */}
      <div className="hud-pill-group hud-interactive">
        <div className="hud-metric">
          <div>
            <div className="hud-metric-label">Баланс</div>
            <div className="hud-metric-val">${economy.balance.toLocaleString('ru-RU')}</div>
          </div>
        </div>

        <div className="hud-metric">
          <TrendingUp size={15} color={net >= 0 ? '#22c55e' : '#ff3b5c'} />
          <div>
            <div className="hud-metric-label">Прибыль/мин</div>
            <div className={`hud-metric-val ${net >= 0 ? 'val-positive' : 'val-negative'}`}>
              {net >= 0 ? '+' : ''}
              ${net}
            </div>
          </div>
        </div>

        <div className="hud-metric">
          <Star size={14} color="#ffb800" fill="#ffb800" />
          <div>
            <div className="hud-metric-label">Рейтинг</div>
            <div className="hud-metric-val val-amber">{economy.reputation.toFixed(2)}</div>
          </div>
        </div>

        <div className="hud-metric">
          <Car size={15} color="#00d4ff" />
          <div>
            <div className="hud-metric-label">Клиенты</div>
            <div className="hud-metric-val val-cyan">
              {liveStats.washing} / {liveStats.queue}
            </div>
          </div>
        </div>

        <div className="hud-metric hide-mobile">
          <div>
            <div className="hud-metric-label">Доля рынка</div>
            <div className="hud-metric-val">{liveStats.share}%</div>
          </div>
        </div>
      </div>

      {/* Time, Speed & System Controls */}
      <div className="hud-pill-group hud-interactive">
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
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>

        <button
          id="btn-speed-toggle"
          className={`icon-btn ${!paused && simSpeed === 2 ? 'active' : ''}`}
          onClick={() => setSimSpeed(simSpeed === 1 ? 2 : 1)}
          title="Скорость симуляции"
        >
          <FastForward size={14} />
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
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        <button
          id="btn-main-menu"
          className="icon-btn"
          onClick={returnToTitle}
          title="Главное меню"
        >
          <Home size={15} />
        </button>
      </div>
    </header>
  );
}
