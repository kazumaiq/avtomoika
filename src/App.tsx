import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { soundEngine } from './audio/soundEngine';
import { GameCanvas } from './scene/GameCanvas';
import { useGameStore } from './store/useGameStore';
import { BottomDock } from './ui/BottomDock';
import { SelectionInspector } from './ui/SelectionInspector';
import { ShiftSummaryModal } from './ui/ShiftSummaryModal';
import { StartScreen } from './ui/StartScreen';
import { ToastFeed } from './ui/ToastFeed';
import { TopHud } from './ui/TopHud';
import { TutorialOverlay } from './ui/TutorialOverlay';
import { BusinessPanel } from './ui/panels/BusinessPanel';
import { CompetitorPanel } from './ui/panels/CompetitorPanel';
import { EmpirePanel } from './ui/panels/EmpirePanel';
import { SettingsPanel } from './ui/panels/SettingsPanel';
import { StaffPanel } from './ui/panels/StaffPanel';
import { UpgradesPanel } from './ui/panels/UpgradesPanel';

export function App() {
  const started = useGameStore((s) => s.started);
  const activePanel = useGameStore((s) => s.activePanel);
  const settings = useGameStore((s) => s.settings);
  const saveNow = useGameStore((s) => s.saveNow);

  // Sync audio settings on mount
  useEffect(() => {
    soundEngine.setSettings(settings.sfxVolume, settings.musicVolume, settings.muted);
  }, [settings.sfxVolume, settings.musicVolume, settings.muted]);

  // Periodic auto-save every 15 seconds while actively playing + save on page unload
  useEffect(() => {
    if (!started) return;
    const interval = window.setInterval(() => {
      saveNow();
    }, 15000);
    const onUnload = () => saveNow();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [started, saveNow]);

  return (
    <main className="app-root">
      {/* Live 3D World runs behind title screen and throughout gameplay */}
      <GameCanvas />

      {!started ? (
        <StartScreen />
      ) : (
        <div className="hud-layer">
          <TopHud />
          <ToastFeed />

          <AnimatePresence>
            <SelectionInspector />
          </AnimatePresence>

          {activePanel === 'business' && <BusinessPanel />}
          {activePanel === 'empire' && <EmpirePanel />}
          {activePanel === 'staff' && <StaffPanel />}
          {activePanel === 'upgrades' && <UpgradesPanel />}
          {activePanel === 'competitor' && <CompetitorPanel />}
          {activePanel === 'settings' && <SettingsPanel />}

          <TutorialOverlay />
          <BottomDock />
          <ShiftSummaryModal />
        </div>
      )}
    </main>
  );
}

export default App;
