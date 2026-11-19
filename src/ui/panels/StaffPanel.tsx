import {
  Award,
  Briefcase,
  Coffee,
  RefreshCw,
  RussianRuble,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { SPECIALIST_CATALOG } from '../../config/empire';
import { getRaiseAmount, getTrainingCost } from '../../config/staff';
import { useGameStore } from '../../store/useGameStore';
import { formatRub, formatRubPerMin } from '../../utils/currency';

export function StaffPanel() {
  const workers = useGameStore((s) => s.workers);
  const candidates = useGameStore((s) => s.candidates);
  const economy = useGameStore((s) => s.economy);
  const empire = useGameStore((s) => s.empire);
  const unlockedBays = useGameStore((s) => s.upgrades.bays);
  const tutorialActive = useGameStore((s) => s.tutorialActive);
  const tutorialStep = useGameStore((s) => s.tutorialStep);

  const hireCandidate = useGameStore((s) => s.hireCandidate);
  const fireWorker = useGameStore((s) => s.fireWorker);
  const trainWorker = useGameStore((s) => s.trainWorker);
  const giveWorkerRaise = useGameStore((s) => s.giveWorkerRaise);
  const restWorkers = useGameStore((s) => s.restWorkers);
  const assignWorkerBay = useGameStore((s) => s.assignWorkerBay);
  const refreshCandidates = useGameStore((s) => s.refreshCandidates);
  const hireSpecialist = useGameStore((s) => s.hireSpecialist);
  const fireSpecialist = useGameStore((s) => s.fireSpecialist);
  const setSelection = useGameStore((s) => s.setSelection);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const [tab, setTab] = useState<'team' | 'specialists' | 'hire'>(
    tutorialActive && tutorialStep === 1 ? 'hire' : 'team'
  );

  const restCost = workers.length * 1_200;
  const anyTired = workers.some((w) => w.fatigue > 25);

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Users size={18} color="#ffb800" />
          <h2 className="panel-title">Персонал ({workers.length}/8)</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        <div className="seg-group">
          <button
            className={`seg-btn ${tab === 'team' ? 'active' : ''}`}
            onClick={() => setTab('team')}
          >
            Мойщики ({workers.length})
          </button>
          <button
            className={`seg-btn ${tab === 'specialists' ? 'active' : ''}`}
            onClick={() => setTab('specialists')}
          >
            <Briefcase size={12} /> Штат ({empire.specialists.filter((s) => s.hired).length}/6)
          </button>
          <button
            className={`seg-btn ${tab === 'hire' ? 'active' : ''}`}
            onClick={() => setTab('hire')}
          >
            Найм ({candidates.length})
          </button>
        </div>

        {tab === 'team' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {anyTired && (
              <button
                className="btn-secondary"
                disabled={economy.balance < restCost}
                onClick={restWorkers}
              >
                <Coffee size={14} /> Кофе-брейк команде (усталость → 0%) • {formatRub(restCost)}
              </button>
            )}

            {workers.map((w) => {
              const trainCost = getTrainingCost(w);
              const raiseAmt = getRaiseAmount(w);
              const xpPct = Math.min(100, Math.round((w.xp / Math.max(1, w.xpToNext)) * 100));

              return (
                <div key={w.id} className="ui-card">
                  <div className="ui-card-row">
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
                      onClick={() => setSelection({ type: 'worker', id: w.id }, true)}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: w.appearance.vestColor,
                          color: '#09101c',
                          fontWeight: 800,
                          fontSize: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {w.name.slice(0, 1)}
                      </span>
                      <div>
                        <div className="card-title">
                          {w.name} <span className="val-cyan">Lv.{w.level}</span>
                        </div>
                        <div className="card-sub">
                          {w.roleTitle} • {formatRubPerMin(w.salaryPerMin)}
                        </div>
                      </div>
                    </div>

                    <button
                      className="icon-btn danger"
                      disabled={workers.length <= 1}
                      onClick={() => fireWorker(w.id)}
                      title={
                        workers.length <= 1
                          ? 'Нельзя уволить последнего сотрудника'
                          : 'Уволить сотрудника'
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="ui-card-row" style={{ fontSize: 12 }}>
                    <span className="card-sub">
                      Скорость: <strong style={{ color: '#00d4ff' }}>{w.speed.toFixed(2)}x</strong>
                    </span>
                    <span className="card-sub">
                      Качество: <strong style={{ color: '#22c55e' }}>{w.quality.toFixed(2)}x</strong>
                    </span>
                    <span className="card-sub">
                      Усталость:{' '}
                      <strong style={{ color: w.fatigue > 65 ? '#ff3b5c' : '#ffb800' }}>
                        {Math.round(w.fatigue)}%
                      </strong>
                    </span>
                  </div>

                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${xpPct}%`, background: '#ffb800' }} />
                  </div>

                  <div className="ui-card-row">
                    <span className="card-sub">Назначение:</span>
                    <select
                      value={w.assignedBay}
                      onChange={(e) => assignWorkerBay(w.id, Number(e.target.value))}
                      style={{
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
                        Авто-бокс
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
                      disabled={w.level >= 10 || economy.balance < trainCost}
                      onClick={() => trainWorker(w.id)}
                    >
                      <Award size={13} />
                      {w.level >= 10 ? 'Макс. уровень' : `Навыки ${formatRub(trainCost)}`}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, height: 32, fontSize: 12 }}
                      disabled={w.morale >= 1.35}
                      onClick={() => giveWorkerRaise(w.id)}
                    >
                      <RussianRuble size={12} />
                      {w.morale >= 1.35 ? 'Макс. мораль' : `ЗП +${raiseAmt} ₽`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'specialists' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SPECIALIST_CATALOG.map((spec) => {
              const st = empire.specialists.find((x) => x.role === spec.role);
              const hired = Boolean(st?.hired);
              const levelOk = economy.entrepreneurLevel >= spec.unlockLevel;
              return (
                <div
                  key={spec.role}
                  className="ui-card"
                  style={hired ? { borderColor: '#22c55e', background: 'rgba(34,197,94,0.08)' } : undefined}
                >
                  <div className="ui-card-row">
                    <div>
                      <div className="card-title">{spec.title}</div>
                      <div className="card-sub">
                        {spec.defaultName} • ЗП {formatRubPerMin(spec.salaryPerMin)}
                      </div>
                    </div>
                    {hired ? (
                      <button
                        className="btn-secondary"
                        style={{ color: '#ff6b84' }}
                        onClick={() => fireSpecialist(spec.role)}
                      >
                        Уволить
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        disabled={!levelOk || economy.balance < spec.hireCost}
                        onClick={() => hireSpecialist(spec.role)}
                      >
                        {!levelOk ? `Ур. ${spec.unlockLevel}` : formatRub(spec.hireCost)}
                      </button>
                    )}
                  </div>
                  <div className="card-sub" style={{ color: '#cbd5e1' }}>
                    {spec.subtitle}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'hire' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ui-card-row">
              <span className="section-label">Доступные кандидаты</span>
              <button className="btn-secondary" style={{ height: 28 }} onClick={refreshCandidates}>
                <RefreshCw size={12} />
                Обновить
              </button>
            </div>

            {candidates.map((cand) => {
              const canAfford = economy.balance >= cand.hireCost && workers.length < 8;
              return (
                <div
                  key={cand.id}
                  className={`ui-card ${canAfford ? 'upgrade-affordable' : ''}`}
                >
                  <div className="ui-card-row">
                    <div>
                      <div className="card-title">
                        {cand.name} <span className="val-cyan">Lv.{cand.level}</span>
                      </div>
                      <div className="card-sub">
                        {cand.roleTitle} • Зарплата {formatRubPerMin(cand.salaryPerMin)}
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      disabled={!canAfford}
                      onClick={() => hireCandidate(cand.id)}
                    >
                      <UserPlus size={14} />
                      {formatRub(cand.hireCost)}
                    </button>
                  </div>
                  <div className="ui-card-row" style={{ fontSize: 12 }}>
                    <span className="card-sub">
                      Скорость: <strong style={{ color: '#00d4ff' }}>{cand.speed.toFixed(2)}x</strong>
                    </span>
                    <span className="card-sub">
                      Качество: <strong style={{ color: '#22c55e' }}>{cand.quality.toFixed(2)}x</strong>
                    </span>
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
