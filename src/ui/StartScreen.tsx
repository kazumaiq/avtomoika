import { motion } from 'framer-motion';
import { Hand, Play, RotateCcw } from 'lucide-react';
import { getBusinessRank } from '../config/progression';
import { useGameStore } from '../store/useGameStore';
import type { GraphicsQuality } from '../types/game';
import { formatRub } from '../utils/currency';

export function StartScreen() {
  const hasSave = useGameStore((s) => s.hasSave);
  const day = useGameStore((s) => s.day);
  const economy = useGameStore((s) => s.economy);
  const upgrades = useGameStore((s) => s.upgrades);
  const quality = useGameStore((s) => s.settings.quality);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const continueSavedGame = useGameStore((s) => s.continueSavedGame);
  const updateSettings = useGameStore((s) => s.updateSettings);

  const rank = getBusinessRank(economy, upgrades).current;

  const qualityOptions: Array<{ id: GraphicsQuality; label: string }> = [
    { id: 'low', label: 'Низкая' },
    { id: 'medium', label: 'Средняя' },
    { id: 'high', label: 'Высокая' },
    { id: 'ultra', label: 'Ультра HD' },
  ];

  return (
    <div className="start-overlay">
      <motion.div
        className="start-card"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="brand-accent-bar" />
            <span className="pill-tag">3D • 60 FPS</span>
          </div>
          <h1 className="start-title">AUTOMOIKA</h1>
          <p className="start-subtitle">
            Своя 3D-автомойка • Смена 07:00–22:00 • Победи <strong style={{ color: '#ff6b84' }}>TURBO SHINE</strong>
          </p>
        </div>

        <div className="start-actions">
          {hasSave ? (
            <>
              <button
                id="btn-continue-game"
                className="btn-primary start-btn-lg"
                onClick={continueSavedGame}
                style={{ flexDirection: 'column', gap: 2, height: 54 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Play size={17} />
                  Продолжить
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.82 }}>
                  День {day} • {formatRub(economy.balance)} • {rank.title}
                </span>
              </button>
              <button
                id="btn-new-game"
                className="btn-secondary start-btn-lg"
                onClick={startNewGame}
              >
                <RotateCcw size={15} />
                Новая игра
              </button>
            </>
          ) : (
            <button
              id="btn-start-game"
              className="btn-primary start-btn-lg"
              onClick={startNewGame}
            >
              <Play size={18} />
              Играть
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="section-label">Графика</span>
          <div className="seg-group">
            {qualityOptions.map((q) => (
              <button
                key={q.id}
                className={`seg-btn ${quality === q.id ? 'active' : ''}`}
                onClick={() => updateSettings({ quality: q.id })}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="start-gesture-hint">
          <Hand size={13} color="#00d4ff" style={{ flexShrink: 0 }} />
          <span>1 палец — обзор • 2 пальца — зум и поворот • Тап по авто — Турбо</span>
        </div>
      </motion.div>
    </div>
  );
}
