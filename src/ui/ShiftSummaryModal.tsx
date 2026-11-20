import { AnimatePresence, motion } from 'framer-motion';
import { Car, CheckCircle2, Film, Flame, Moon, Sunrise, TrendingUp } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { formatRub } from '../utils/currency';

export function ShiftSummaryModal() {
  const summary = useGameStore((s) => s.shiftSummary);
  const startNextShift = useGameStore((s) => s.startNextShift);
  const watchRewardedDoubleShiftAd = useGameStore((s) => s.watchRewardedDoubleShiftAd);

  const adBonus = summary
    ? Math.max(4_500, Math.round(Math.max(summary.profit, summary.revenue * 0.45)))
    : 0;

  return (
    <AnimatePresence>
      {summary && (
        <motion.div
          className="shift-overlay hud-interactive"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="shift-card"
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <div className="shift-badge">
              <Moon size={14} color="#93c5fd" />
              <span>22:00 • Смена завершена</span>
            </div>

            <h2 className="shift-title">Итоги дня {summary.day}</h2>

            <div className="shift-grid">
              <div className="shift-stat">
                <Car size={15} color="#00d4ff" />
                <span className="hud-metric-label">Помыто авто</span>
                <span className="shift-stat-val">{summary.carsWashed}</span>
              </div>

              <div className="shift-stat">
                <TrendingUp size={15} color="#22c55e" />
                <span className="hud-metric-label">Выручка</span>
                <span className="shift-stat-val val-positive">
                  {formatRub(summary.revenue)}
                </span>
              </div>

              <div className="shift-stat">
                <Flame size={15} color="#fb923c" />
                <span className="hud-metric-label">Чистый итог</span>
                <span
                  className={`shift-stat-val ${
                    summary.profit >= 0 ? 'val-positive' : 'val-negative'
                  }`}
                >
                  {formatRub(summary.profit, { signed: true })}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: '#94a3b8', margin: '0 0 8px', textAlign: 'center' }}>
              Расходы: {formatRub(summary.expenses)} • Налоги: {formatRub(summary.taxes)}
            </div>

            {/* Yandex Games Rewarded Video Placement: Double Shift Payout */}
            {!summary.doubledByAd ? (
              <button
                id="btn-ad-double-shift"
                type="button"
                className="btn-primary start-btn-lg"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #eab308)',
                  color: '#09101c',
                  marginBottom: 6,
                }}
                onClick={() => void watchRewardedDoubleShiftAd()}
              >
                <Film size={17} />
                <span>Удвоить итог за видео (+{formatRub(adBonus)})</span>
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#4ade80',
                  marginBottom: 6,
                }}
              >
                <CheckCircle2 size={15} /> Рекламный бонус ×2 получен!
              </div>
            )}

            <button
              id="btn-next-shift"
              className="btn-primary start-btn-lg"
              onClick={startNextShift}
            >
              <Sunrise size={18} />
              Начать день {summary.day + 1} • 07:00
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
