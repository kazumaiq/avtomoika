import { RotateCcw, Save, Settings, Sun, Volume2, X } from 'lucide-react';
import { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { useGameStore } from '../../store/useGameStore';
import type { GraphicsQuality, TimeOfDayMode } from '../../types/game';

export function SettingsPanel() {
  const settings = useGameStore((s) => s.settings);
  const lastSavedAt = useGameStore((s) => s.lastSavedAt);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const saveNow = useGameStore((s) => s.saveNow);
  const resetProgress = useGameStore((s) => s.resetProgress);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const [confirmReset, setConfirmReset] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const qualityModes: Array<{ id: GraphicsQuality; label: string }> = [
    { id: 'low', label: 'Низкая' },
    { id: 'medium', label: 'Средняя' },
    { id: 'high', label: 'Высокая' },
  ];

  const timeModes: Array<{ id: TimeOfDayMode; label: string }> = [
    { id: 'cycle', label: 'Цикл' },
    { id: 'morning', label: 'Утро' },
    { id: 'day', label: 'День' },
    { id: 'sunset', label: 'Закат' },
    { id: 'night', label: 'Ночь' },
  ];

  const handleSave = () => {
    soundEngine.playClick();
    saveNow();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1800);
  };

  return (
    <div className="panel-sheet">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Settings size={18} color="#94a3b8" />
          <h2 className="panel-title">Настройки и сохранение</h2>
        </div>
        <button className="icon-btn" onClick={() => setActivePanel(null)} aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        {/* Graphics Quality */}
        <div className="ui-card">
          <span className="section-label">Качество 3D-графики</span>
          <div className="seg-group">
            {qualityModes.map((q) => (
              <button
                key={q.id}
                className={`seg-btn ${settings.quality === q.id ? 'active' : ''}`}
                onClick={() => updateSettings({ quality: q.id })}
              >
                {q.label}
              </button>
            ))}
          </div>
          <span className="card-sub">
            Влияет на разрешение теней, сглаживание и плотность частиц воды и пены.
          </span>
        </div>

        {/* Time of Day */}
        <div className="ui-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sun size={14} color="#ffb800" />
            <span className="section-label">Время суток и атмосфера</span>
          </div>
          <div className="seg-group">
            {timeModes.map((tm) => (
              <button
                key={tm.id}
                className={`seg-btn ${settings.timeMode === tm.id ? 'active' : ''}`}
                onClick={() => updateSettings({ timeMode: tm.id })}
              >
                {tm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audio Sliders */}
        <div className="ui-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Volume2 size={14} color="#00d4ff" />
            <span className="section-label">Звук и музыка</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="ui-card-row" style={{ fontSize: 12 }}>
              <span>Эффекты (мойка, авто, UI)</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => {
                soundEngine.unlock();
                updateSettings({ sfxVolume: Number(e.target.value), muted: false });
              }}
              className="ui-range"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="ui-card-row" style={{ fontSize: 12 }}>
              <span>Фоновая музыка</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => {
                soundEngine.unlock();
                updateSettings({ musicVolume: Number(e.target.value), muted: false });
              }}
              className="ui-range"
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            <span>Всплывающие +$ над боксами</span>
            <input
              type="checkbox"
              checked={settings.showPopups}
              onChange={(e) => updateSettings({ showPopups: e.target.checked })}
            />
          </label>
        </div>

        {/* Save & Reset */}
        <div className="ui-card">
          <span className="section-label">Прогресс и сохранения</span>
          <span className="card-sub">
            Автосохранение работает каждые 15 секунд.
            {lastSavedAt
              ? ` Последнее: ${new Date(lastSavedAt).toLocaleTimeString('ru-RU')}`
              : ''}
          </span>

          <div className="ui-card-row" style={{ gap: 8 }}>
            <button id="btn-manual-save" className="btn-primary" style={{ flex: 1 }} onClick={handleSave}>
              <Save size={14} />
              {justSaved ? 'Сохранено!' : 'Сохранить сейчас'}
            </button>

            {!confirmReset ? (
              <button
                className="btn-secondary"
                style={{ borderColor: 'rgba(255,59,92,0.45)', color: '#ff6b84' }}
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw size={14} />
                Сброс
              </button>
            ) : (
              <button
                className="btn-primary btn-coral"
                onClick={() => {
                  setConfirmReset(false);
                  resetProgress();
                }}
              >
                Подтвердить сброс
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
