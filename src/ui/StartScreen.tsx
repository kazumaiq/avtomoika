import { motion } from 'framer-motion';
import { Crown, GraduationCap, Play, RotateCcw, Sparkles, Swords, Zap } from 'lucide-react';
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="brand-accent-bar" />
            <span className="pill-tag">3D Tycoon • Рубли ₽</span>
          </div>
          <h1 className="start-title">AUTOMOIKA</h1>
          <p className="start-subtitle">
            Построй лучшую 3D-автомойку в городе! Нанимай мастеров, открывай боксы, лови золотые
            VIP-авто и победи конкурента <strong style={{ color: '#ff6b84' }}>TURBO SHINE</strong>{' '}
            напротив.
          </p>
        </div>

        <div className="start-features">
          <div className="start-feature-chip">
            <Crown size={13} color="#facc15" />
            <span>VIP-клиенты и события</span>
          </div>
          <div className="start-feature-chip">
            <Zap size={13} color="#00d4ff" />
            <span>Турбо-мойка и комбо</span>
          </div>
          <div className="start-feature-chip">
            <Swords size={13} color="#ff6b84" />
            <span>Битва за долю рынка</span>
          </div>
          <div className="start-feature-chip">
            <GraduationCap size={13} color="#22c55e" />
            <span>Обучение +5 000 ₽</span>
          </div>
        </div>

        <div className="start-actions">
          {hasSave ? (
            <>
              <button
                id="btn-continue-game"
                className="btn-primary start-btn-lg"
                onClick={continueSavedGame}
                style={{ flexDirection: 'column', gap: 2, height: 56 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Play size={17} />
                  Продолжить игру
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>
                  День {day} • {formatRub(economy.balance)} • {rank.title}
                </span>
              </button>
              <button
                id="btn-new-game"
                className="btn-secondary start-btn-lg"
                onClick={startNewGame}
              >
                <RotateCcw size={16} />
                Начать новую игру (с обучением)
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
            paddingTop: 6,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Sparkles size={14} color="#00d4ff" style={{ flexShrink: 0 }} />
          <span>Вращайте камеру мышью или пальцем • Нажимайте на машины для «Турбо-помощи»</span>
        </div>
      </motion.div>
    </div>
  );
}
