import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Gift, GraduationCap, Sparkles, X } from 'lucide-react';
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

  // Highlight the target button in the HUD while the corresponding tutorial step is active
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
    <AnimatePresence>
      {tutorialActive && step && (
        <motion.aside
          key={step.id}
          className={`tutorial-card hud-interactive ${activePanel ? 'panel-open' : ''}`}
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          aria-live="polite"
        >
          <div className="tutorial-header">
            <div className="tutorial-badge">
              {isLastStep ? <Gift size={14} /> : <GraduationCap size={14} />}
              <span>
                Обучение • Шаг {tutorialStep + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>
            <button
              className="tutorial-skip-btn"
              onClick={skipTutorial}
              title="Пропустить обучение"
            >
              <span>Пропустить</span>
              <X size={13} />
            </button>
          </div>

          <div className="tutorial-progress">
            {TUTORIAL_STEPS.map((st, idx) => (
              <span
                key={st.id}
                className={`tutorial-pip ${idx <= tutorialStep ? 'done' : ''}`}
              />
            ))}
          </div>

          <h3 className="tutorial-title">{step.title}</h3>
          <p className="tutorial-body">{step.body}</p>

          <div className="tutorial-hint">
            <Sparkles size={13} color="#00d4ff" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{step.hint}</span>
          </div>

          <div className="tutorial-footer">
            <button
              id="btn-tutorial-next"
              className={`btn-primary ${isLastStep ? 'btn-emerald' : ''}`}
              style={{ width: '100%', height: 38 }}
              onClick={advanceTutorial}
            >
              {isLastStep && !tutorialCompleted ? (
                <>
                  <Gift size={15} />
                  {step.actionLabel}
                </>
              ) : isLastStep ? (
                <>
                  <ChevronRight size={16} />
                  Завершить обучение
                </>
              ) : (
                <>
                  <span>{step.actionLabel}</span>
                  <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
