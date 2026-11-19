import { motion } from 'framer-motion';
import { Award, Car, Crosshair, DollarSign, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getRaiseAmount, getTrainingCost } from '../config/staff';
import { VEHICLE_SPECS } from '../config/vehicles';
import { gameSimulation } from '../engine/simulation';
import { useGameStore } from '../store/useGameStore';
import type { VehicleEntity, WashStage, WorkerActionState } from '../types/game';

const STAGE_LABEL: Record<WashStage, string> = {
  none: 'Подъезд / очередь',
  greeting: 'Приём заказа',
  rinse: 'Смыв высоким давлением',
  foam: 'Нанесение активной пены',
  scrub: 'Ручная мойка и чистка',
  dry: 'Турбосушка и полировка',
  done: 'Автомобиль чист!',
};

const WORKER_ACTION_LABEL: Record<WorkerActionState, string> = {
  idle: 'Ожидает клиента',
  walking: 'Идёт к боксу',
  greeting: 'Встречает автомобиль',
  rinsing: 'Смывает грязь (АВД)',
  foaming: 'Наносит пену',
  scrubbing: 'Оттирает кузов',
  drying: 'Сушит и полирует',
  celebrating: 'Завершил заказ!',
};

export function SelectionInspector() {
  const selection = useGameStore((s) => s.selection);
  const followSelected = useGameStore((s) => s.followSelected);
  const balance = useGameStore((s) => s.economy.balance);
  const playerWorkers = useGameStore((s) => s.workers);
  const unlockedBays = useGameStore((s) => s.upgrades.bays);

  const setSelection = useGameStore((s) => s.setSelection);
  const toggleFollowSelected = useGameStore((s) => s.toggleFollowSelected);
  const trainWorker = useGameStore((s) => s.trainWorker);
  const giveWorkerRaise = useGameStore((s) => s.giveWorkerRaise);
  const assignWorkerBay = useGameStore((s) => s.assignWorkerBay);

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!selection) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 220);
    return () => window.clearInterval(id);
  }, [selection]);

  if (!selection) return null;

  if (selection.type === 'vehicle') {
    const car: VehicleEntity | undefined = gameSimulation.vehicles.find(
      (v) => v.id === selection.id
    );
    if (!car) return null;

    const spec = VEHICLE_SPECS[car.category];
    const cleanPct = Math.round((1 - car.dirtLevel) * 100);
    const washPct = Math.round(car.washProgress * 100);

    return (
      <motion.aside
        className="inspector-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
      >
        <div className="ui-card-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Car size={16} color={car.owner === 'player' ? '#00d4ff' : '#ff4d4f'} />
            <div>
              <div className="card-title">{car.modelName}</div>
              <div className="card-sub">
                {spec.labelRu} • {car.owner === 'player' ? 'AUTOMOIKA' : 'TURBO SHINE'}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={() => setSelection(null)} aria-label="Закрыть">
            <X size={14} />
          </button>
        </div>

        <div className="ui-card-row">
          <span className="pill-tag">{STAGE_LABEL[car.washStage]}</span>
          <span className="hud-metric-sub val-positive">~${car.expectedPrice}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="ui-card-row" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Чистота кузова</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{cleanPct}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${cleanPct}%`, background: '#00d4ff' }}
            />
          </div>
        </div>

        {car.state === 'washing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="ui-card-row" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>Прогресс мойки</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{washPct}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${washPct}%`, background: '#22c55e' }}
              />
            </div>
          </div>
        )}

        {car.state === 'queued' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="ui-card-row" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>Терпение клиента</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(car.patience * 100)}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.round(car.patience * 100)}%`,
                  background: car.patience > 0.35 ? '#ffb800' : '#ff3b5c',
                }}
              />
            </div>
          </div>
        )}

        <button
          className={`btn-secondary ${followSelected ? 'active' : ''}`}
          style={
            followSelected
              ? { background: 'rgba(0,212,255,0.2)', borderColor: '#00d4ff', color: '#00d4ff' }
              : undefined
          }
          onClick={toggleFollowSelected}
        >
          <Crosshair size={14} />
          {followSelected ? 'Камера следит за авто' : 'Следить камерой'}
        </button>
      </motion.aside>
    );
  }

  // Worker inspector
  const rt = gameSimulation.workerRuntimes.get(selection.id);
  const profile =
    playerWorkers.find((w) => w.id === selection.id) ??
    gameSimulation.competitorWorkers.find((w) => w.id === selection.id);

  if (!profile || !rt) return null;

  const isPlayer = profile.owner === 'player';
  const trainCost = getTrainingCost(profile);
  const raiseAmt = getRaiseAmount(profile);
  const xpPct = Math.min(100, Math.round((profile.xp / Math.max(1, profile.xpToNext)) * 100));

  return (
    <motion.aside
      className="inspector-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
    >
      <div className="ui-card-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={16} color={isPlayer ? '#ffb800' : '#ff4d4f'} />
          <div>
            <div className="card-title">
              {profile.name} <span className="val-cyan">Lv.{profile.level}</span>
            </div>
            <div className="card-sub">
              {profile.roleTitle} • {isPlayer ? 'AUTOMOIKA' : 'TURBO SHINE'}
            </div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setSelection(null)} aria-label="Закрыть">
          <X size={14} />
        </button>
      </div>

      <div className="ui-card-row">
        <span className="pill-tag amber">{WORKER_ACTION_LABEL[rt.action]}</span>
        <span className="card-sub">Помыто: {profile.carsWashed}</span>
      </div>

      <div className="stat-grid-2">
        <div className="stat-box">
          <span className="hud-metric-label">Скорость</span>
          <span className="hud-metric-val val-cyan">{profile.speed.toFixed(2)}x</span>
        </div>
        <div className="stat-box">
          <span className="hud-metric-label">Качество</span>
          <span className="hud-metric-val val-positive">{profile.quality.toFixed(2)}x</span>
        </div>
      </div>

      {isPlayer && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="ui-card-row" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>Опыт до Lv.{Math.min(10, profile.level + 1)}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{xpPct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${xpPct}%`, background: '#ffb800' }} />
            </div>
          </div>

          <div className="ui-card-row" style={{ gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Бокс:</span>
            <select
              value={profile.assignedBay}
              onChange={(e) => assignWorkerBay(profile.id, Number(e.target.value))}
              style={{
                flex: 1,
                height: 28,
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0 8px',
                fontSize: 12,
              }}
            >
              <option value={-1} style={{ background: '#111626' }}>
                Авто-назначение
              </option>
              {Array.from({ length: unlockedBays }).map((_, idx) => (
                <option key={idx} value={idx} style={{ background: '#111626' }}>
                  Бокс #{idx + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-card-row" style={{ gap: 6 }}>
            <button
              className="btn-primary"
              style={{ flex: 1, height: 32, fontSize: 12 }}
              disabled={profile.level >= 10 || balance < trainCost}
              onClick={() => trainWorker(profile.id)}
            >
              <Award size={13} />
              {profile.level >= 10 ? 'Макс' : `Обучить $${trainCost}`}
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1, height: 32, fontSize: 12 }}
              disabled={profile.morale >= 1.35}
              onClick={() => giveWorkerRaise(profile.id)}
            >
              <DollarSign size={13} />
              +${raiseAmt}/м
            </button>
          </div>
        </>
      )}

      <button className="btn-secondary" onClick={toggleFollowSelected}>
        <Crosshair size={14} />
        {followSelected ? 'Камера следит' : 'Следить камерой'}
      </button>
    </motion.aside>
  );
}
