import { Award, RefreshCw, RussianRuble, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { getRaiseAmount, getTrainingCost } from '../../config/staff';
import { useGameStore } from '../../store/useGameStore';
import { formatRub, formatRubPerMin } from '../../utils/currency';

export function StaffPanel() {
  const workers = useGameStore((s) => s.workers);
  const candidates = useGameStore((s) => s.candidates);
  const balance = useGameStore((s) => s.economy.balance);
  const unlockedBays = useGameStore((s) => s.upgrades.bays);
  const tutorialActive = useGameStore((s) => s.tutorialActive);
  const tutorialStep = useGameStore((s) => s.tutorialStep);

  const hireCandidate = useGameStore((s) => s.hireCandidate);
  const fireWorker = useGameStore((s) => s.fireWorker);
  const trainWorker = useGameStore((s) => s.trainWorker);
  const giveWorkerRaise = useGameStore((s) => s.giveWorkerRaise);
  const assignWorkerBay = useGameStore((s) => s.assignWorkerBay);
  const refreshCandidates = useGameStore((s) => s.refreshCandidates);
  const setSelection = useGameStore((s) => s.setSelection);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  // During tutorial step 1 ("Hire a second worker"), open directly on the Hire tab for frictionless UX
  const [tab, setTab] = useState<'team' | 'hire'>(
    tutorialActive && tutorialStep === 1 ? 'hire' : 'team'
  );

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
            Команда ({workers.length})
          </button>
          <button
            className={`seg-btn ${tab === 'hire' ? 'active' : ''}`}
            onClick={() => setTab('hire')}
          >
            Найм ({candidates.length})
          </button>
        </div>

        {tab === 'team' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

                  {/* Stats line */}
                  <div className="ui-card-row" style={{ fontSize: 12 }}>
                    <span className="card-sub">
                      Скорость: <strong style={{ color: '#00d4ff' }}>{w.speed.toFixed(2)}x</strong>
                    </span>
                    <span className="card-sub">
                      Качество: <strong style={{ color: '#22c55e' }}>{w.quality.toFixed(2)}x</strong>
                    </span>
                    <span className="card-sub">
                      Мораль: <strong style={{ color: '#ffb800' }}>{Math.round(w.morale * 100)}%</strong>
                    </span>
                  </div>

                  {/* XP Bar */}
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${xpPct}%`, background: '#ffb800' }} />
                  </div>

                  {/* Bay assignment */}
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

                  {/* Train & Raise actions */}
                  <div className="ui-card-row" style={{ gap: 6 }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, height: 32, fontSize: 12 }}
                      disabled={w.level >= 10 || balance < trainCost}
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ui-card-row">
              <span className="section-label">Доступные кандидаты</span>
              <button className="btn-secondary" style={{ height: 28 }} onClick={refreshCandidates}>
                <RefreshCw size={12} />
                Обновить
              </button>
            </div>

            {candidates.map((cand) => {
              const canAfford = balance >= cand.hireCost && workers.length < 8;
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
