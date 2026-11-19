import { ArrowUpRight, CheckCircle2, FlaskConical, Lock, Sparkles, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { RESEARCH_TREE, WASH_TECHNOLOGIES, WASH_TECH_ORDER } from '../../config/empire';
import { UPGRADE_DEFINITIONS, getUpgradeCost } from '../../config/upgrades';
import { useGameStore } from '../../store/useGameStore';
import type { DocumentId } from '../../types/game';
import { formatRub } from '../../utils/currency';

export function UpgradesPanel() {
  const [tab, setTab] = useState<'wash' | 'tech' | 'research'>('wash');

  const upgrades = useGameStore((s) => s.upgrades);
  const economy = useGameStore((s) => s.economy);
  const empire = useGameStore((s) => s.empire);
  const workersCount = useGameStore((s) => s.workers.length);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const repairEquipment = useGameStore((s) => s.repairEquipment);
  const unlockWashTech = useGameStore((s) => s.unlockWashTech);
  const selectWashTech = useGameStore((s) => s.selectWashTech);
  const buyResearch = useGameStore((s) => s.buyResearch);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const missingCond = Math.max(0, 100 - economy.equipmentCondition);
  const hasCarService = empire.businesses.some((b) => !b.underConstruction && b.type === 'car_service');
  const repairCost = Math.round(missingCond * 110 * upgrades.bays * (hasCarService ? 0.8 : 1.0));

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Wrench size={18} color="#00d4ff" />
          <h2 className="panel-title">Развитие и технологии</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        <div className="seg-group">
          <button className={`seg-btn ${tab === 'wash' ? 'active' : ''}`} onClick={() => setTab('wash')}>
            <Wrench size={12} /> Мойка
          </button>
          <button className={`seg-btn ${tab === 'tech' ? 'active' : ''}`} onClick={() => setTab('tech')}>
            <Sparkles size={12} /> Технологии
          </button>
          <button
            className={`seg-btn ${tab === 'research' ? 'active' : ''}`}
            onClick={() => setTab('research')}
          >
            <FlaskConical size={12} /> R&D ({empire.unlockedResearchIds.length}/{RESEARCH_TREE.length})
          </button>
        </div>

        {tab === 'wash' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Equipment condition & repair */}
            <div className="ui-card">
              <div className="ui-card-row">
                <div>
                  <div className="card-title">Состояние оборудования</div>
                  <div className="card-sub">
                    Износ замедляет мойку и повышает расход воды/электричества
                  </div>
                </div>
                <span
                  className="hud-metric-val"
                  style={{
                    color:
                      economy.equipmentCondition < 40
                        ? '#ff3b5c'
                        : economy.equipmentCondition < 75
                          ? '#ffb800'
                          : '#22c55e',
                  }}
                >
                  {Math.round(economy.equipmentCondition)}%
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.round(economy.equipmentCondition)}%`,
                    background:
                      economy.equipmentCondition < 40
                        ? '#ff3b5c'
                        : economy.equipmentCondition < 75
                          ? '#ffb800'
                          : '#22c55e',
                  }}
                />
              </div>
              {missingCond >= 2 && (
                <button
                  className="btn-secondary"
                  disabled={economy.balance < repairCost}
                  onClick={repairEquipment}
                >
                  <Wrench size={13} /> Ремонт до 100% • {formatRub(repairCost)}
                </button>
              )}
            </div>

            {UPGRADE_DEFINITIONS.map((def) => {
              const level = upgrades[def.key];
              const isMax = level >= def.maxLevel;
              const cost = getUpgradeCost(def.key, level);

              let permitMissing = false;
              if (def.key === 'bays' && !isMax) {
                const nextBay = level + 1;
                const permitKey: DocumentId | null =
                  nextBay === 2
                    ? 'bay_permit_2'
                    : nextBay === 3
                      ? 'bay_permit_3'
                      : nextBay === 4
                        ? 'bay_permit_4'
                        : null;
                if (permitKey && !empire.tax.documents[permitKey]) {
                  permitMissing = true;
                }
              }

              const canAfford = !isMax && !permitMissing && economy.balance >= cost;

              return (
                <div
                  key={def.key}
                  className={`ui-card ${canAfford ? 'upgrade-affordable' : ''}`}
                >
                  <div className="ui-card-row">
                    <div>
                      <div className="card-title">{def.title}</div>
                      <div className="card-sub">{def.subtitle}</div>
                    </div>
                    <div className="level-pips" aria-label={`Уровень ${level} из ${def.maxLevel}`}>
                      {Array.from({ length: def.maxLevel }).map((_, i) => (
                        <span key={i} className={`level-pip ${i < level ? 'filled' : ''}`} />
                      ))}
                    </div>
                  </div>

                  <div className="ui-card-row" style={{ marginTop: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        {def.effectLabel(level)}
                      </span>
                      {!isMax && (
                        <span style={{ fontSize: 11, color: permitMissing ? '#fbbf24' : 'var(--text-secondary)' }}>
                          {permitMissing
                            ? `Нужно разрешение на Бокс #${level + 1} (Бизнес → Налоги)`
                            : `Далее: ${def.nextEffectLabel(level + 1)}`}
                        </span>
                      )}
                    </div>

                    {isMax ? (
                      <span className="pill-tag emerald">
                        <CheckCircle2 size={12} />
                        Максимум
                      </span>
                    ) : (
                      <button
                        id={`btn-upgrade-${def.key}`}
                        className="btn-primary"
                        disabled={!canAfford}
                        onClick={() => buyUpgrade(def.key)}
                      >
                        {permitMissing ? <Lock size={13} /> : <ArrowUpRight size={14} />}
                        {formatRub(cost)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'tech' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {WASH_TECH_ORDER.map((id) => {
              const spec = WASH_TECHNOLOGIES[id];
              const unlocked = economy.unlockedWashTechs.includes(id);
              const active = economy.activeWashTech === id;
              const levelOk = economy.entrepreneurLevel >= spec.unlockLevel;
              const workersOk = workersCount >= spec.minWorkers;

              return (
                <div
                  key={id}
                  className="ui-card"
                  style={{
                    borderColor: active ? '#00d4ff' : undefined,
                    background: active ? 'rgba(0, 212, 255, 0.08)' : undefined,
                  }}
                >
                  <div className="ui-card-row">
                    <span className="card-title">{spec.title}</span>
                    <span className="pill-tag">
                      {active ? 'Активна' : unlocked ? 'Открыта' : `Ур. ${spec.unlockLevel}`}
                    </span>
                  </div>
                  <div className="card-sub">{spec.subtitle}</div>
                  <div className="card-sub" style={{ color: '#cbd5e1' }}>
                    Чек +{formatRub(spec.priceBonus)} • Скорость ×{spec.speedMult.toFixed(2)} • Качество +{spec.qualityBonus.toFixed(2)}★ • Химия +{formatRub(spec.utilityExtra)}/авто
                  </div>
                  {unlocked ? (
                    <button
                      className={active ? 'btn-secondary' : 'btn-primary'}
                      disabled={active || !workersOk}
                      onClick={() => selectWashTech(id)}
                    >
                      {active
                        ? 'Используется в боксах'
                        : !workersOk
                          ? `Нужно ${spec.minWorkers} мойщика`
                          : 'Выбрать технологию'}
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      disabled={!levelOk || economy.balance < spec.unlockCost}
                      onClick={() => unlockWashTech(id)}
                    >
                      {!levelOk
                        ? `Нужен Уровень ${spec.unlockLevel}`
                        : `Открыть • ${formatRub(spec.unlockCost)}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'research' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RESEARCH_TREE.map((r) => {
              const done = empire.unlockedResearchIds.includes(r.id);
              const reqOk = !r.requires || empire.unlockedResearchIds.includes(r.requires);
              const levelOk = economy.entrepreneurLevel >= r.unlockLevel;
              const canBuy = !done && reqOk && levelOk && economy.balance >= r.cost;

              return (
                <div key={r.id} className={`ui-card ${canBuy ? 'upgrade-affordable' : ''}`}>
                  <div className="ui-card-row">
                    <span className="card-title">{r.title}</span>
                    {done ? (
                      <span className="pill-tag emerald">
                        <CheckCircle2 size={12} /> Изучено
                      </span>
                    ) : (
                      <span className="pill-tag">Ур. {r.unlockLevel}</span>
                    )}
                  </div>
                  <div className="card-sub">{r.subtitle}</div>
                  <div className="card-sub" style={{ color: '#00d4ff' }}>
                    {r.effectSummary}
                  </div>
                  {!done && (
                    <button
                      className="btn-primary"
                      disabled={!canBuy}
                      onClick={() => buyResearch(r.id)}
                    >
                      {!levelOk
                        ? `Нужен Уровень ${r.unlockLevel}`
                        : !reqOk
                          ? 'Требуется предыдущее исследование'
                          : `Изучить • ${formatRub(r.cost)}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
