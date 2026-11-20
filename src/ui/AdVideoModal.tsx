import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Film, Sparkles, Tv, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type SimulatedAdState, adService } from '../services/adService';

export function AdVideoModal() {
  const [adState, setAdState] = useState<SimulatedAdState | null>(null);

  useEffect(() => {
    void adService.init();
    return adService.subscribeSimAd(setAdState);
  }, []);

  if (!adState || !adState.active) return null;

  const pct = Math.min(
    100,
    Math.round(((adState.totalSeconds - adState.secondsLeft) / Math.max(1, adState.totalSeconds)) * 100)
  );

  return (
    <AnimatePresence>
      <motion.div
        className="shift-overlay hud-interactive"
        style={{ zIndex: 120 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="shift-card"
          style={{
            maxWidth: 400,
            borderColor: adState.kind === 'rewarded' ? 'rgba(250, 204, 21, 0.55)' : 'rgba(56, 189, 248, 0.45)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          }}
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
        >
          <div
            className="shift-badge"
            style={{
              background:
                adState.kind === 'rewarded' ? 'rgba(250, 204, 21, 0.16)' : 'rgba(56, 189, 248, 0.16)',
              color: adState.kind === 'rewarded' ? '#facc15' : '#38bdf8',
              borderColor:
                adState.kind === 'rewarded' ? 'rgba(250, 204, 21, 0.4)' : 'rgba(56, 189, 248, 0.35)',
            }}
          >
            {adState.kind === 'rewarded' ? <Film size={14} /> : <Tv size={14} />}
            <span>
              {adState.kind === 'rewarded'
                ? 'Яндекс Игры • Видео за награду'
                : 'Яндекс Игры • Рекламная пауза'}
            </span>
          </div>

          <h2 className="shift-title" style={{ fontSize: 19 }}>
            {adState.title}
          </h2>

          {/* Stylized Animated Video Preview Frame */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 132,
              borderRadius: 12,
              background:
                'radial-gradient(circle at 30% 30%, rgba(0, 212, 255, 0.25), rgba(15, 23, 42, 0.96) 75%)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 16,
              overflow: 'hidden',
            }}
          >
            <Sparkles size={28} color={adState.kind === 'rewarded' ? '#facc15' : '#00d4ff'} />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc', textAlign: 'center' }}>
              {adState.rewardLabel}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {adState.canClaim
                ? 'Просмотр завершён — награда готова!'
                : `Осталось: ${adState.secondsLeft} сек...`}
            </div>
          </div>

          <div className="progress-track" style={{ height: 7 }}>
            <div
              className="progress-fill"
              style={{
                width: `${pct}%`,
                background:
                  adState.kind === 'rewarded'
                    ? 'linear-gradient(90deg, #f59e0b, #facc15)'
                    : 'linear-gradient(90deg, #0284c7, #00d4ff)',
                transition: 'width 0.35s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
            {adState.kind === 'rewarded' && !adState.canClaim && (
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => adService.completeSimulatedAd(false)}
              >
                <X size={14} /> Отмена (без награды)
              </button>
            )}

            {adState.canClaim && (
              <button
                type="button"
                className="btn-primary start-btn-lg"
                style={{
                  flex: 1,
                  background:
                    adState.kind === 'rewarded'
                      ? 'linear-gradient(135deg, #f59e0b, #eab308)'
                      : undefined,
                  color: adState.kind === 'rewarded' ? '#09101c' : undefined,
                }}
                onClick={() => adService.completeSimulatedAd(true)}
              >
                <CheckCircle2 size={17} />
                {adState.kind === 'rewarded' ? 'Забрать награду!' : 'Продолжить игру'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
