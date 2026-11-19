import {
  Briefcase,
  Building2,
  CheckCircle2,
  Crown,
  FileText,
  Home,
  Lock,
  MapPin,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_ORDER,
  DISTRICTS,
  DISTRICT_ORDER,
} from '../../config/empire';
import { useGameStore } from '../../store/useGameStore';
import { formatRub } from '../../utils/currency';

type EmpireTab = 'map' | 'businesses' | 'property' | 'contracts' | 'holding';

export function EmpirePanel() {
  const [tab, setTab] = useState<EmpireTab>('map');

  const economy = useGameStore((s) => s.economy);
  const empire = useGameStore((s) => s.empire);
  const workers = useGameStore((s) => s.workers);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const unlockDistrict = useGameStore((s) => s.unlockDistrict);
  const switchDistrict = useGameStore((s) => s.switchDistrict);
  const buyProperty = useGameStore((s) => s.buyProperty);
  const toggleLeaseProperty = useGameStore((s) => s.toggleLeaseProperty);
  const sellProperty = useGameStore((s) => s.sellProperty);
  const buildBusiness = useGameStore((s) => s.buildBusiness);
  const upgradeBusiness = useGameStore((s) => s.upgradeBusiness);
  const repairBusiness = useGameStore((s) => s.repairBusiness);
  const acceptContract = useGameStore((s) => s.acceptContract);
  const foundHolding = useGameStore((s) => s.foundHolding);
  const toggleHoldingProcurement = useGameStore((s) => s.toggleHoldingProcurement);
  const toggleHoldingAccounting = useGameStore((s) => s.toggleHoldingAccounting);

  const activeDistrictSpec = DISTRICTS[empire.activeDistrict];
  const totalBranches = 1 + empire.businesses.filter((b) => !b.underConstruction).length;

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Building2 size={18} color="#22c55e" />
          <h2 className="panel-title">Империя • Ур. {economy.entrepreneurLevel}</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        <div className="seg-group" style={{ flexWrap: 'wrap' }}>
          <button className={`seg-btn ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>
            <MapPin size={12} /> Карта
          </button>
          <button
            className={`seg-btn ${tab === 'businesses' ? 'active' : ''}`}
            onClick={() => setTab('businesses')}
          >
            <Briefcase size={12} /> Бизнесы ({empire.businesses.length})
          </button>
          <button
            className={`seg-btn ${tab === 'property' ? 'active' : ''}`}
            onClick={() => setTab('property')}
          >
            <Home size={12} /> Земля ({empire.properties.length})
          </button>
          <button
            className={`seg-btn ${tab === 'contracts' ? 'active' : ''}`}
            onClick={() => setTab('contracts')}
          >
            <FileText size={12} /> Контракты
          </button>
          <button
            className={`seg-btn ${tab === 'holding' ? 'active' : ''}`}
            onClick={() => setTab('holding')}
          >
            <Crown size={12} /> Холдинг
          </button>
        </div>

        {tab === 'map' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DISTRICT_ORDER.map((id) => {
              const d = DISTRICTS[id];
              const unlocked = empire.unlockedDistricts.includes(id);
              const isActive = empire.activeDistrict === id;
              const rival = empire.districtRivals[id];
              const levelOk = economy.entrepreneurLevel >= d.unlockLevel;
              const canAfford = economy.balance >= d.unlockCost;

              return (
                <div
                  key={id}
                  className="ui-card"
                  style={{
                    borderColor: isActive ? d.accentColor : undefined,
                    background: isActive ? 'rgba(0, 212, 255, 0.08)' : undefined,
                  }}
                >
                  <div className="ui-card-row">
                    <span className="card-title" style={{ color: d.accentColor }}>
                      {d.name}
                    </span>
                    <span className="pill-tag">
                      {isActive ? 'Активен' : unlocked ? 'Открыт' : `Ур. ${d.unlockLevel}`}
                    </span>
                  </div>
                  <div className="card-sub">{d.subtitle}</div>
                  <div className="stat-grid-2">
                    <div className="stat-box">
                      <span className="hud-metric-label">Аренда / мин</span>
                      <span className="hud-metric-val">{formatRub(d.rentPerMin)}</span>
                    </div>
                    <div className="stat-box">
                      <span className="hud-metric-label">Поток / Чек</span>
                      <span className="hud-metric-val" style={{ fontSize: 12 }}>
                        {d.marketCapacityPerMin}/м • ×{d.priceToleranceMult.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="card-sub">
                    Конкурент: <strong style={{ color: '#ff6b84' }}>{rival.name}</strong> ({rival.bays} бокса, {formatRub(rival.price)})
                  </div>
                  {unlocked ? (
                    <button
                      className={isActive ? 'btn-secondary' : 'btn-primary'}
                      style={{ width: '100%' }}
                      disabled={isActive}
                      onClick={() => switchDistrict(id)}
                    >
                      {isActive ? 'Активный район' : 'Перейти в район'}
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ width: '100%' }}
                      disabled={!levelOk || !canAfford}
                      onClick={() => unlockDistrict(id)}
                    >
                      {!levelOk ? (
                        <>
                          <Lock size={13} /> Нужен Уровень {d.unlockLevel}
                        </>
                      ) : (
                        `Открыть район • ${formatRub(d.unlockCost)}`
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'businesses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {empire.businesses.length > 0 && (
              <div className="ui-card">
                <span className="section-label">Ваши предприятия ({empire.businesses.length})</span>
                {empire.businesses.map((biz) => {
                  const spec = BUSINESS_TYPES[biz.type];
                  const upgCost = Math.round(spec.buildCost * 0.65 * Math.pow(1.6, biz.level - 1));
                  const repCost = Math.round((100 - biz.condition) * 180);
                  return (
                    <div key={biz.id} className="stat-box" style={{ gap: 5 }}>
                      <div className="ui-card-row">
                        <span className="card-title">{biz.title}</span>
                        <span className="pill-tag">Ур. {biz.level}/5</span>
                      </div>
                      {biz.underConstruction ? (
                        <span className="card-sub" style={{ color: '#fbbf24' }}>
                          🏗 Строится... осталось {biz.constructionMinutesLeft.toFixed(1)} мин
                        </span>
                      ) : (
                        <>
                          <div className="ui-card-row" style={{ fontSize: 12 }}>
                            <span className="card-sub">
                              Состояние: <strong>{Math.round(biz.condition)}%</strong>
                            </span>
                            <span className={biz.profitPerMin >= 0 ? 'val-positive' : 'val-negative'}>
                              {formatRub(biz.profitPerMin, { signed: true })}/м
                            </span>
                          </div>
                          <div className="ui-card-row" style={{ gap: 6 }}>
                            {biz.level < 5 && (
                              <button
                                className="btn-secondary"
                                style={{ flex: 1, height: 30, fontSize: 11.5 }}
                                disabled={economy.balance < upgCost}
                                onClick={() => upgradeBusiness(biz.id)}
                              >
                                Улучшить {formatRub(upgCost)}
                              </button>
                            )}
                            {biz.condition < 95 && (
                              <button
                                className="btn-secondary"
                                style={{ height: 30, fontSize: 11.5 }}
                                disabled={economy.balance < repCost}
                                onClick={() => repairBusiness(biz.id)}
                              >
                                <Wrench size={12} /> {formatRub(repCost)}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <span className="section-label">
              Построить в «{activeDistrictSpec.name}»
            </span>
            {BUSINESS_TYPE_ORDER.map((type) => {
              const spec = BUSINESS_TYPES[type];
              const levelOk = economy.entrepreneurLevel >= spec.unlockLevel;
              const canAfford = economy.balance >= spec.buildCost;
              return (
                <div key={type} className={`ui-card ${levelOk && canAfford ? 'upgrade-affordable' : ''}`}>
                  <div className="ui-card-row">
                    <span className="card-title">{spec.title}</span>
                    <span className="pill-tag">{spec.synergyBonus}</span>
                  </div>
                  <div className="card-sub">{spec.subtitle}</div>
                  <div className="card-sub" style={{ color: '#38bdf8' }}>
                    {spec.mechanicNote} • Стройка: {spec.constructionMinutes} мин
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: '100%' }}
                    disabled={!levelOk || !canAfford}
                    onClick={() => buildBusiness(type, empire.activeDistrict)}
                  >
                    {!levelOk
                      ? `Откроется на Уровне ${spec.unlockLevel}`
                      : `Построить • ${formatRub(spec.buildCost)}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'property' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ui-card">
              <span className="section-label">Недвижимость • {activeDistrictSpec.name}</span>
              <div className="stat-box" style={{ gap: 6 }}>
                <div className="ui-card-row">
                  <span className="card-title">Земельный участок</span>
                  <span className="val-positive" style={{ fontSize: 12 }}>
                    Аренда +{formatRub(Math.round(activeDistrictSpec.landPrice * 0.0045))}/м
                  </span>
                </div>
                <span className="card-sub">Можно сдавать в аренду или продать позже.</span>
                <button
                  className="btn-primary"
                  disabled={economy.balance < activeDistrictSpec.landPrice}
                  onClick={() => buyProperty(empire.activeDistrict, 'land')}
                >
                  Купить • {formatRub(activeDistrictSpec.landPrice)}
                </button>
              </div>

              <div className="stat-box" style={{ gap: 6 }}>
                <div className="ui-card-row">
                  <span className="card-title">Коммерческое здание</span>
                  <span className="pill-tag emerald">-50% аренда мойки</span>
                </div>
                <span className="card-sub">
                  Снижает аренду вашей мойки в районе вдвое + можно сдавать площади.
                </span>
                <button
                  className="btn-primary"
                  disabled={economy.balance < activeDistrictSpec.buildingPrice}
                  onClick={() => buyProperty(empire.activeDistrict, 'building')}
                >
                  Купить • {formatRub(activeDistrictSpec.buildingPrice)}
                </button>
              </div>
            </div>

            {empire.properties.length > 0 && (
              <div className="ui-card">
                <span className="section-label">Ваши объекты ({empire.properties.length})</span>
                {empire.properties.map((p) => (
                  <div key={p.id} className="stat-box" style={{ gap: 6 }}>
                    <div className="ui-card-row">
                      <span className="card-title">{p.title}</span>
                      <span className="pill-tag">
                        {p.leasedOut ? `+${formatRub(p.leaseIncomePerMin)}/м` : 'Свободно'}
                      </span>
                    </div>
                    <div className="ui-card-row" style={{ gap: 6 }}>
                      <button
                        className="btn-secondary"
                        style={{ flex: 1, height: 30, fontSize: 11.5 }}
                        onClick={() => toggleLeaseProperty(p.id)}
                      >
                        {p.leasedOut ? 'Снять с аренды' : 'Сдать в аренду'}
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ height: 30, fontSize: 11.5, color: '#ff6b84' }}
                        onClick={() => sellProperty(p.id)}
                      >
                        Продать {formatRub(Math.round(p.purchasePrice * 0.85))}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'contracts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {empire.contracts.map((c) => {
              const meetsReq = workers.length >= c.minStaff && totalBranches >= c.minBranches;
              const pct = Math.min(100, Math.round((c.completedCars / c.requiredCars) * 100));
              return (
                <div
                  key={c.id}
                  className="ui-card"
                  style={{ borderColor: c.active ? '#00d4ff' : undefined }}
                >
                  <div className="ui-card-row">
                    <span className="card-title">{c.clientName}</span>
                    <span className="val-positive" style={{ fontWeight: 800 }}>
                      +{formatRub(c.reward)}
                    </span>
                  </div>
                  <div className="card-sub">
                    Цель: {c.requiredCars} авто за {c.daysTotal} дн. • Штраф за срыв: {formatRub(c.penalty)}
                  </div>
                  <div className="card-sub">
                    Требования: {c.minStaff} мойщиков, {c.minBranches} филиал(а)
                  </div>
                  {c.active ? (
                    <>
                      <div className="ui-card-row" style={{ fontSize: 12 }}>
                        <span>
                          Прогресс: {c.completedCars} / {c.requiredCars}
                        </span>
                        <span style={{ color: '#fbbf24' }}>Осталось {c.daysLeft} дн.</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ width: '100%' }}
                      disabled={!meetsReq}
                      onClick={() => acceptContract(c.id)}
                    >
                      {meetsReq ? 'Подписать контракт' : 'Не выполнены требования'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'holding' && (
          <div className="ui-card">
            <div className="ui-card-row">
              <span className="card-title" style={{ color: '#facc15' }}>
                👑 Корпоративный холдинг
              </span>
              {empire.holding.founded && (
                <span className="pill-tag emerald">
                  <CheckCircle2 size={12} /> Активен
                </span>
              )}
            </div>
            {!empire.holding.founded ? (
              <>
                <p className="card-sub">
                  Объедините автомойки, автосервисы и недвижимость в единую корпорацию.
                </p>
                <div className="stat-box">
                  <span className="hud-metric-label">Преимущества</span>
                  <span className="card-sub" style={{ color: '#e2e8f0' }}>
                    • Централизованные закупки (-6% расходы сети)
                    <br />• Единая бухгалтерия (налог на прибыль 12% вместо 15%)
                  </span>
                </div>
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  disabled={
                    !empire.unlockedResearchIds.includes('holding_charter') ||
                    economy.balance < 450_000
                  }
                  onClick={() => foundHolding()}
                >
                  {!empire.unlockedResearchIds.includes('holding_charter')
                    ? 'Изучите «Устав бизнес-холдинга» (Ур. 15)'
                    : `Основать холдинг • ${formatRub(450_000)}`}
                </button>
              </>
            ) : (
              <>
                <div className="card-title">{empire.holding.name}</div>
                <button className="btn-secondary" onClick={toggleHoldingProcurement}>
                  Центральные закупки (-6% расходы):{' '}
                  <strong>{empire.holding.centralProcurement ? 'ВКЛ' : 'ВЫКЛ'}</strong>
                </button>
                <button className="btn-secondary" onClick={toggleHoldingAccounting}>
                  Единая бухгалтерия (налог 12%):{' '}
                  <strong>{empire.holding.sharedAccounting ? 'ВКЛ' : 'ВЫКЛ'}</strong>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
