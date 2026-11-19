import { motion } from 'framer-motion';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import type { GraphicsQuality } from '../types/game';

export function StartScreen() {
  const hasSave = useGameStore((s) => s.hasSave);
  const quality = useGameStore((s) => s.settings.quality);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const continueSavedGame = useGameStore((s) => s.continueSavedGame);
  const updateSettings = useGameStore((s) => s.updateSettings);

  const qualityOptions: Array<{ id: GraphicsQuality; label: string }> = [
    { id: 'low', label: 'Низкая' },
    { id: 'medium', label: 'Средняя' },
    { id: 'high', label: 'Высокая' },
  ];

  return (
    <div className="start-overlay">
      <motion.div
        className="start-card"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="brand-accent-bar" />
          <h1 className="start-title">AUTOMOIKA</h1>
          <p className="start-subtitle">
            Управляй стилизованной 3D-автомойкой в живом городе. Нанимай мастеров, развивай
            боксы и обойди конкурента <strong style={{ color: '#ff6b84' }}>TURBO SHINE</strong> через дорогу.
          </p>
        </div>

        <div className="start-actions">
          {hasSave ? (
            <>
              <button
                id="btn-continue-game"
                className="btn-primary start-btn-lg"
                onClick={continueSavedGame}
              >
                <Play size={18} />
                Продолжить игру
              </button>
              <button
                id="btn-new-game"
                className="btn-secondary start-btn-lg"
                onClick={startNewGame}
              >
                <RotateCcw size={16} />
                Начать заново
              </button>
            </>
          ) : (
            <button
              id="btn-start-game"
              className="btn-primary start-btn-lg"
              onClick={startNewGame}
            >
              <Play size={18} />
              Запустить автомойку
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="section-label">Графика 3D</span>
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-secondary)',
            paddingTop: 4,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Sparkles size={14} color="#00d4ff" style={{ flexShrink: 0 }} />
          <span>Вращайте камеру мышью или пальцем • Нажмите на авто или сотрудника для инспекции</span>
        </div>
      </motion.div>
    </div>
  );
}
