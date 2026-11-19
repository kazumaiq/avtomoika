import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Crown, Sparkles, Trophy, Zap } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import type { ToastNotification } from '../types/game';

function ToneIcon({ tone }: { tone: ToastNotification['tone'] }) {
  switch (tone) {
    case 'vip':
      return <Crown size={13} color="#facc15" />;
    case 'emerald':
      return <Trophy size={13} color="#22c55e" />;
    case 'amber':
      return <Zap size={13} color="#ffb800" />;
    case 'coral':
      return <Bell size={13} color="#ff6b84" />;
    default:
      return <Sparkles size={13} color="#00d4ff" />;
  }
}

export function ToastFeed() {
  const toasts = useGameStore((s) => s.toasts);
  const dismissToast = useGameStore((s) => s.dismissToast);

  return (
    <div className="toast-feed" aria-live="polite">
      <AnimatePresence mode="wait">
        {toasts.slice(-1).map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            className={`toast-pill tone-${toast.tone}`}
            onClick={() => dismissToast(toast.id)}
            role="status"
          >
            <ToneIcon tone={toast.tone} />
            <span className="toast-pill-text">{toast.title}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
