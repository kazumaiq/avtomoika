import { Html } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { FloatingPopup } from '../../types/game';

export function FloatingPopups() {
  const showPopups = useGameStore((s) => s.settings.showPopups);
  const [items, setItems] = useState<FloatingPopup[]>([]);

  useEffect(() => {
    if (!showPopups) {
      setItems([]);
      return;
    }
    const timer = window.setInterval(() => {
      setItems([...gameSimulation.popups]);
    }, 120);
    return () => window.clearInterval(timer);
  }, [showPopups]);

  if (!showPopups || items.length === 0) return null;

  const now = performance.now();

  return (
    <group>
      {items.map((pop) => {
        const progress = Math.min(1, Math.max(0, (now - pop.createdAt) / pop.duration));
        const liftY = pop.y + progress * 1.9;
        const opacity = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

        return (
          <Html
            key={pop.id}
            position={[pop.x, liftY, pop.z]}
            center
            distanceFactor={26}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              style={{
                opacity,
                transform: `scale(${0.92 + (1 - progress) * 0.16})`,
                color: pop.color,
                background: 'rgba(12, 16, 28, 0.88)',
                border: `1.5px solid ${pop.color}`,
                borderRadius: '8px',
                padding: '3px 9px',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
              }}
            >
              {pop.text}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
