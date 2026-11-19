import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Gift, GraduationCap, X } from 'lucide-react';
import { useEffect } from 'react';
import { TUTORIAL_STEPS } from '../config/progression';
import { useGameStore } from '../store/useGameStore';

export function TutorialOverlay() {
  const tutorialActive = useGameStore((s) => s.tutorialActive);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const tutorialCompleted = useGameStore((s) => s.tutorialCompleted);
  const activePanel = useGameStore((s) => s.activePanel);
  const advanceTutorial = useGameStore((s) => s.advanceTutorial);
  const skipTutorial = useGameStore((s) => s.skipTutorial);

  const step = TUTORIAL_STEPS[Math.min(tutorialStep, TUTORIAL_STEPS.length - 1)];
  const isLastStep = tutorialStep >= TUTORIAL_STEPS.length - 1;

  // Highlight the target dock button while the corresponding step is active
  useEffect(() => {
    if (!tutorialActive || !step?.highlightId) return;
    const target = document.getElementById(step.highlightId);
    if (!target) return;
    target.classList.add('tutorial-pulse');
    return () => {
      target.classList.remove('tutorial-pulse');
    };
  }, [tutorialActive, step?.highlightId]);

  return (
    <AnimatePresence mode="wait">
      {tutorialActive && step && (
        <motion.aside
          key={step.id}
          className={`tutorial-bar hud-interactive ${activePanel ? 'panel-open' : ''}`}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          aria-live="polite"
        >
          <div className="tutorial-bar-left">
            <span className="tutorial-step-pill">
              {isLastStep ? <Gift size={12} /> : <GraduationCap size={12} />}
              {tutorialStep + 1}/{TUTORIAL_STEPS.length}
            </span>
            <div className="tutorial-bar-copy">
              <div className="tutorial-bar-title">{step.title}</div>
              <div className="tutorial-bar-sub">{step.body}</div>
            </div>
          </div>

          <div className="tutorial-bar-actions">
            <button
              id="btn-tutorial-next"
              className={`tutorial-next-btn ${isLastStep ? 'reward' : ''}`}
              onClick={advanceTutorial}
            >
              <span>
                {isLastStep && tutorialCompleted ? 'Готово' : step.actionLabel}
              </span>
              {!isLastStep && <ChevronRight size={14} />}
            </button>

            <button
              className="tutorial-close-btn"
              onClick={skipTutorial}
              aria-label="Пропустить обучение"
              title="Пропустить обучение"
            >
              <X size={14} />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
