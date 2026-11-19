import { ArrowUpRight, CheckCircle2, Wrench, X } from 'lucide-react';
import { UPGRADE_DEFINITIONS, getUpgradeCost } from '../../config/upgrades';
import { useGameStore } from '../../store/useGameStore';
import { formatRub } from '../../utils/currency';

export function UpgradesPanel() {
  const upgrades = useGameStore((s) => s.upgrades);
  const balance = useGameStore((s) => s.economy.balance);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Wrench size={18} color="#00d4ff" />
          <h2 className="panel-title">Улучшения и расширение</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        {UPGRADE_DEFINITIONS.map((def) => {
          const level = upgrades[def.key];
          const isMax = level >= def.maxLevel;
          const cost = getUpgradeCost(def.key, level);
          const canAfford = !isMax && balance >= cost;

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
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Далее: {def.nextEffectLabel(level + 1)}
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
                    <ArrowUpRight size={14} />
                    {formatRub(cost)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
