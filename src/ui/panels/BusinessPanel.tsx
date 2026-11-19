import { Briefcase, Megaphone, Sliders, X } from 'lucide-react';
import { AD_CAMPAIGNS, getPlayerQualityScore } from '../../config/upgrades';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { AdCampaignId } from '../../types/game';

const AD_ORDER: AdCampaignId[] = ['none', 'flyers', 'billboard', 'radio'];

export function BusinessPanel() {
  const economy = useGameStore((s) => s.economy);
  const upgrades = useGameStore((s) => s.upgrades);
  const competitor = useGameStore((s) => s.competitor);
  const setWashPrice = useGameStore((s) => s.setWashPrice);
  const setAdCampaign = useGameStore((s) => s.setAdCampaign);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const quality = getPlayerQualityScore(upgrades);
  const sharePct = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
  const compEffPrice = competitor.promoActive
    ? Math.round(competitor.price * 0.82)
    : competitor.price;

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Briefcase size={18} color="#00d4ff" />
          <h2 className="panel-title">Управление бизнесом</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        {/* Financial Summary */}
        <div className="stat-grid-2">
          <div className="stat-box">
            <span className="hud-metric-label">Доход / мин</span>
            <span className="hud-metric-val val-positive">+${economy.incomePerMin}</span>
          </div>
          <div className="stat-box">
            <span className="hud-metric-label">Расходы / мин</span>
            <span className="hud-metric-val val-negative">-${economy.expensesPerMin}</span>
          </div>
          <div className="stat-box">
            <span className="hud-metric-label">Обслужено авто</span>
            <span className="hud-metric-val">{economy.carsWashed}</span>
          </div>
          <div className="stat-box">
            <span className="hud-metric-label">Качество сервиса</span>
            <span className="hud-metric-val val-cyan">{quality.toFixed(1)} / 5.0</span>
          </div>
        </div>

        {/* Dynamic Wash Pricing Control */}
        <div className="ui-card">
          <div className="ui-card-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={15} color="#ffb800" />
              <span className="card-title">Базовая цена мойки</span>
            </div>
            <span className="hud-metric-val val-amber">${economy.washPrice}</span>
          </div>

          <input
            id="input-wash-price"
            type="range"
            min={15}
            max={75}
            step={1}
            value={economy.washPrice}
            onChange={(e) => setWashPrice(Number(e.target.value))}
            className="ui-range"
          />

          <div className="ui-card-row" style={{ fontSize: 12 }}>
            <span className="card-sub">
              Конкурент: <strong style={{ color: '#ff6b84' }}>${compEffPrice}</strong>
            </span>
            <span className="card-sub">
              Спрос к вам: <strong style={{ color: '#00d4ff' }}>{sharePct}%</strong>
            </span>
          </div>

          <p className="card-sub">
            Спорткары и премиум платят до 2.85x от базовой цены. Высокая цена снижает поток, но
            увеличивает выручку при высоком рейтинге.
          </p>
        </div>

        {/* Advertising Campaigns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Megaphone size={14} color="#ff3b5c" />
          <span className="section-label">Рекламные кампании</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AD_ORDER.map((id) => {
            const spec = AD_CAMPAIGNS[id];
            const active = economy.adCampaign === id;
            return (
              <div
                key={id}
                className="ui-card"
                style={
                  active
                    ? {
                        borderColor: 'var(--accent-cyan)',
                        background: 'rgba(0, 212, 255, 0.1)',
                      }
                    : undefined
                }
              >
                <div className="ui-card-row">
                  <div>
                    <div className="card-title">{spec.title}</div>
                    <div className="card-sub">{spec.description}</div>
                  </div>
                  <button
                    className={active ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setAdCampaign(id)}
                  >
                    {active ? 'Активно' : spec.costPerMin === 0 ? 'Выкл' : `$${spec.costPerMin}/м`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
