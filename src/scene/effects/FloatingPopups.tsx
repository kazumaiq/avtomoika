import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';

const POOL_SIZE = 6;
const texCache = new Map<string, THREE.CanvasTexture>();

function getPopupTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}|${color}`;
  const cached = texCache.get(key);
  if (cached) return cached;

  // Keep cache bounded so memory stays tiny
  if (texCache.size > 48) {
    const firstKey = texCache.keys().next().value;
    if (firstKey) {
      texCache.get(firstKey)?.dispose();
      texCache.delete(firstKey);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 72);

  // Pill background
  const padX = 12;
  const padY = 10;
  const w = 232;
  const h = 52;
  const r = 24;
  ctx.beginPath();
  ctx.moveTo(padX + r, padY);
  ctx.lineTo(padX + w - r, padY);
  ctx.quadraticCurveTo(padX + w, padY, padX + w, padY + r);
  ctx.lineTo(padX + w, padY + h - r);
  ctx.quadraticCurveTo(padX + w, padY + h, padX + w - r, padY + h);
  ctx.lineTo(padX + r, padY + h);
  ctx.quadraticCurveTo(padX, padY + h, padX, padY + h - r);
  ctx.lineTo(padX, padY + r);
  ctx.quadraticCurveTo(padX, padY, padX + r, padY);
  ctx.closePath();

  ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '700 28px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 37, 214);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/**
 * 100% pure WebGL floating ruble & turbo popups using pooled THREE.Sprites.
 * Zero DOM/<Html> overlays -> zero WebKit layout thrashing on iPhone!
 */
export function FloatingPopups() {
  const spriteRefs = useRef<Array<THREE.Sprite | null>>([]);
  const matRefs = useRef<Array<THREE.SpriteMaterial | null>>([]);
  const assignedKeys = useRef<string[]>(Array.from({ length: POOL_SIZE }, () => ''));

  const emptyMats = useMemo(
    () =>
      Array.from(
        { length: POOL_SIZE },
        () =>
          new THREE.SpriteMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
          })
      ),
    []
  );

  useEffect(() => {
    return () => {
      emptyMats.forEach((m) => m.dispose());
    };
  }, [emptyMats]);

  useFrame(() => {
    const state = useGameStore.getState();
    const active = state.started && state.settings.showPopups;
    const popups = active ? gameSimulation.popups : [];
    const now = performance.now();

    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = spriteRefs.current[i];
      const mat = matRefs.current[i];
      if (!sprite || !mat) continue;

      const pop = popups[i];
      if (!pop) {
        sprite.visible = false;
        continue;
      }

      const progress = Math.min(1, Math.max(0, (now - pop.createdAt) / pop.duration));
      if (progress >= 1) {
        sprite.visible = false;
        continue;
      }

      const key = `${pop.text}|${pop.color}`;
      if (assignedKeys.current[i] !== key) {
        assignedKeys.current[i] = key;
        mat.map = getPopupTexture(pop.text, pop.color);
        mat.needsUpdate = true;
      }

      const liftY = pop.y + progress * 2.1;
      const opacity = progress < 0.65 ? 1 : 1 - (progress - 0.65) / 0.35;
      const scale = 0.85 + Math.sin(Math.min(1, progress * 3.5) * (Math.PI / 2)) * 0.2;

      sprite.visible = true;
      sprite.position.set(pop.x, liftY, pop.z);
      sprite.scale.set(3.2 * scale, 0.9 * scale, 1);
      mat.opacity = opacity;
    }
  });

  return (
    <group>
      {emptyMats.map((mat, i) => (
        <sprite
          key={i}
          ref={(el) => {
            spriteRefs.current[i] = el;
          }}
          material={mat}
          visible={false}
          renderOrder={10}
        >
          <primitive
            object={mat}
            attach="material"
            ref={(el: THREE.SpriteMaterial | null) => {
              matRefs.current[i] = el;
            }}
          />
        </sprite>
      ))}
    </group>
  );
}
