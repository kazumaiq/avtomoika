import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Crown, Sparkles, Trophy, Zap } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import type { ToastNotification } from '../types/game';

function ToneIcon({ tone }: { tone: ToastNotification['tone'] }) {
  switch (tone) {
    case 'vip':
      return <Crown size={15} color="#facc15" />;
    case 'emerald':
      return <Trophy size={15} color="#22c55e" />;
    case 'amber':
      return <Zap size={15} color="#ffb800" />;
    case 'coral':
      return <Bell size={15} color="#ff6b84" />;
    default:
      return <Sparkles size={15} color="#00d4ff" />;
  }
}

export function ToastFeed() {
  const toasts = useGameStore((s) => s.toasts);
  const dismissToast = useGameStore((s) => s.dismissToast);

  return (
    <div className="toast-feed" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ duration: 0.22 }}
            className={`toast-card tone-${toast.tone}`}
            onClick={() => dismissToast(toast.id)}
            role="status"
          >
            <div className="toast-icon">
              <ToneIcon tone={toast.tone} />
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              {toast.subtitle && <div className="toast-sub">{toast.subtitle}</div>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
