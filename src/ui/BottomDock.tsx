import {
  Briefcase,
  Camera,
  Settings,
  Swords,
  Users,
  Wrench,
} from 'lucide-react';
import { UPGRADE_DEFINITIONS, getUpgradeCost } from '../config/upgrades';
import { useGameStore } from '../store/useGameStore';
import type { ActivePanel, CameraPreset } from '../types/game';

const CAMERA_ITEMS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'player', label: 'Моя мойка' },
  { id: 'competitor', label: 'Конкурент' },
  { id: 'street', label: 'Улица' },
];

export function BottomDock() {
  const activePanel = useGameStore((s) => s.activePanel);
  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const balance = useGameStore((s) => s.economy.balance);
  const upgrades = useGameStore((s) => s.upgrades);
  const workersCount = useGameStore((s) => s.workers.length);
  const candidates = useGameStore((s) => s.candidates);
  const compPromo = useGameStore((s) => s.competitor.promoActive);
  const happyHourRemaining = useGameStore((s) => s.economy.happyHourRemaining);

  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);

  // Count how many upgrades the player can currently afford
  const affordableUpgrades = UPGRADE_DEFINITIONS.filter((u) => {
    const lv = upgrades[u.key];
    return lv < u.maxLevel && balance >= getUpgradeCost(u.key, lv);
  }).length;

  const canHireMore =
    workersCount < upgrades.bays + 1 &&
    workersCount < 8 &&
    candidates.some((c) => balance >= c.hireCost);

  const navItems: Array<{
    id: Exclude<ActivePanel, null>;
    label: string;
    icon: typeof Briefcase;
    badge?: number | string;
    badgeTone?: 'coral' | 'emerald' | 'amber';
  }> = [
    {
      id: 'business',
      label: 'Бизнес',
      icon: Briefcase,
      badge: happyHourRemaining > 0 ? '⚡' : undefined,
      badgeTone: 'amber',
    },
    {
      id: 'staff',
      label: 'Персонал',
      icon: Users,
      badge: canHireMore ? '+' : undefined,
      badgeTone: 'emerald',
    },
    {
      id: 'upgrades',
      label: 'Улучшения',
      icon: Wrench,
      badge: affordableUpgrades > 0 ? affordableUpgrades : undefined,
      badgeTone: 'coral',
    },
    {
      id: 'competitor',
      label: 'Конкурент',
      icon: Swords,
      badge: compPromo ? '!' : undefined,
      badgeTone: 'coral',
    },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className="bottom-bar">
      {/* Camera Quick Presets */}
      <div className="camera-strip hud-interactive">
        <Camera size={14} color="#64748b" className="hide-mobile" style={{ margin: '0 6px' }} />
        {CAMERA_ITEMS.map((c) => (
          <button
            key={c.id}
            id={`btn-cam-${c.id}`}
            className={`cam-btn ${cameraPreset === c.id ? 'active' : ''}`}
            onClick={() => setCameraPreset(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Main Management Navigation Dock */}
      <nav className="dock-nav hud-interactive" aria-label="Управление автомойкой">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              id={`btn-tab-${item.id}`}
              className={`dock-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActivePanel(item.id)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className={`dock-badge ${item.badgeTone ?? 'coral'}`}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
