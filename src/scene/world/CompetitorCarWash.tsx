import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COMPETITOR_LAYOUT } from '../../config/worldLayout';
import { gameSimulation } from '../../engine/simulation';
import {
  getBayFloorTexture,
  getLotConcreteTexture,
  getPriceTotemTexture,
  getSignTexture,
} from '../../graphics/proceduralTextures';
import { useGameStore } from '../../store/useGameStore';

export function CompetitorCarWash() {
  const compBays = useGameStore((s) => s.competitor.bays);
  const compPrice = useGameStore((s) => s.competitor.price);
  const promoActive = useGameStore((s) => s.competitor.promoActive);

  const lotTex = useMemo(() => getLotConcreteTexture('#38313F'), []);
  const bayFloorTex = useMemo(() => getBayFloorTexture('#FF4D4F'), []);
  const signTex = useMemo(
    () => getSignTexture('TURBO SHINE', 'ЭКСПРЕСС АВТОМОЙКА • КОНКУРЕНТ', '#1D0F18', '#FF4D4F', '#FFE5B4'),
    []
  );
  const promoTex = useMemo(
    () => getSignTexture('АКЦИЯ -18%!', 'СКИДКА ПРЯМО СЕЙЧАС', '#380910', '#FFB800', '#FFFFFF'),
    []
  );
  const effPrice = promoActive ? Math.round((compPrice * 0.82) / 10) * 10 : compPrice;
  const priceTotemTex = useMemo(
    () =>
      getPriceTotemTexture(
        'TURBO SHINE',
        effPrice,
        '#FF4D4F',
        promoActive ? 'АКЦИЯ -18%!' : undefined
      ),
    [effPrice, promoActive]
  );

  const ledRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([null, null, null]);

  useFrame(() => {
    for (let i = 0; i < 3; i++) {
      const mat = ledRefs.current[i];
      if (!mat) continue;
      const status = gameSimulation.getBayStatus('competitor', i);
      if (status === 'free') {
        mat.color.set('#22C55E');
        mat.emissive.set('#22C55E');
        mat.emissiveIntensity = 1.2;
      } else if (status === 'washing') {
        mat.color.set('#FF4D4F');
        mat.emissive.set('#FF4D4F');
        mat.emissiveIntensity = 2.2;
      } else {
        mat.color.set('#FFB800');
        mat.emissive.set('#FFB800');
        mat.emissiveIntensity = 1.8;
      }
    }
  });

  return (
    <group>
      {/* Competitor Live Ruble Price Totem */}
      <group position={[-14.2, 0.08, -7.9]} rotation={[0, 0.32, 0]}>
        <mesh position={[0, 2.35, 0]} castShadow>
          <boxGeometry args={[1.65, 4.7, 0.36]} />
          <meshStandardMaterial color="#1A1018" roughness={0.35} metalness={0.5} />
        </mesh>
        <mesh position={[0, 2.35, 0.2]}>
          <planeGeometry args={[1.5, 4.4]} />
          <meshStandardMaterial
            map={priceTotemTex}
            emissive="#FFFFFF"
            emissiveMap={priceTotemTex}
            emissiveIntensity={0.85}
          />
        </mesh>
        <mesh position={[0, 2.35, -0.2]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.5, 4.4]} />
          <meshStandardMaterial
            map={priceTotemTex}
            emissive="#FFFFFF"
            emissiveMap={priceTotemTex}
            emissiveIntensity={0.85}
          />
        </mesh>
      </group>

      {/* Competitor Concrete Lot Pad (Z = -30.5 to -7.5, X = -22 to +22) */}
      <mesh position={[0, 0.03, -19.0]} receiveShadow>
        <boxGeometry args={[44, 0.08, 23]} />
        <meshStandardMaterial map={lotTex} roughness={0.86} />
      </mesh>

      {/* Perimeter Crimson-Trimmed Boundary Wall */}
      <mesh position={[0, 0.45, -30.3]} castShadow receiveShadow>
        <boxGeometry args={[44, 0.9, 0.45]} />
        <meshStandardMaterial color="#251A24" roughness={0.75} />
      </mesh>
      <mesh position={[-21.8, 0.45, -19.0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.9, 23]} />
        <meshStandardMaterial color="#251A24" roughness={0.75} />
      </mesh>
      <mesh position={[21.8, 0.45, -19.0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.9, 23]} />
        <meshStandardMaterial color="#251A24" roughness={0.75} />
      </mesh>

      {/* Queue Lane Painted Stripes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.5, 0.085, -8.85]}>
        <planeGeometry args={[28, 0.16]} />
        <meshStandardMaterial color="#FF4D4F" emissive="#FF4D4F" emissiveIntensity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.5, 0.085, -11.95]}>
        <planeGeometry args={[28, 0.16]} />
        <meshStandardMaterial color="#FFB800" />
      </mesh>

      {/* Competitor Office Wing (Right/East side of their bays) */}
      <group position={[13.2, 0.07, -18.5]}>
        <mesh position={[0, 2.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.8, 4.7, 7.6]} />
          <meshStandardMaterial color="#221721" roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.85, 3.82]}>
          <planeGeometry args={[3.8, 2.5]} />
          <meshStandardMaterial
            color="#FDBA74"
            emissive="#F97316"
            emissiveIntensity={0.55}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 4.95, 0]} castShadow>
          <boxGeometry args={[5.4, 0.5, 8.2]} />
          <meshStandardMaterial color="#160F17" roughness={0.45} />
        </mesh>
        <mesh position={[0, 4.78, 4.12]}>
          <boxGeometry args={[5.4, 0.18, 0.12]} />
          <meshStandardMaterial color="#FF4D4F" emissive="#FF4D4F" emissiveIntensity={2.1} />
        </mesh>
      </group>

      {/* Main Open-Truss Skylight Canopy & Glowing TURBO SHINE Signboard */}
      <group position={[0.5, 0.07, -18.5]}>
        <mesh position={[0, 4.88, 3.95]} castShadow>
          <boxGeometry args={[20.5, 0.5, 0.45]} />
          <meshStandardMaterial color="#1A121C" roughness={0.5} />
        </mesh>
        <mesh position={[0, 4.88, -3.95]} castShadow>
          <boxGeometry args={[20.5, 0.5, 0.45]} />
          <meshStandardMaterial color="#1A121C" roughness={0.5} />
        </mesh>
        {[-9.8, -3.25, 3.25, 9.8].map((tx) => (
          <mesh key={tx} position={[tx, 4.88, 0]} castShadow>
            <boxGeometry args={[0.38, 0.48, 8.2]} />
            <meshStandardMaterial color="#1A121C" roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 4.98, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[19.8, 7.5]} />
          <meshStandardMaterial
            color="#FECACA"
            transparent
            opacity={0.16}
            roughness={0.14}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <pointLight position={[0, 4.2, 0]} color="#FFE8DC" intensity={24} distance={26} decay={1.5} />
        <mesh position={[0, 4.72, 4.2]}>
          <boxGeometry args={[20.7, 0.22, 0.14]} />
          <meshStandardMaterial color="#FF4D4F" emissive="#FF4D4F" emissiveIntensity={2.1} />
        </mesh>
        <mesh position={[0, 4.98, 4.2]}>
          <boxGeometry args={[20.7, 0.14, 0.14]} />
          <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={1.6} />
        </mesh>

        {/* TURBO SHINE Rooftop Sign */}
        <group position={[-1.0, 6.6, 3.4]}>
          {[-3.6, 0, 3.6].map((sx) => (
            <mesh key={sx} position={[sx, -1.0, 0]}>
              <boxGeometry args={[0.24, 1.7, 0.24]} />
              <meshStandardMaterial color="#120C14" />
            </mesh>
          ))}
          <mesh castShadow>
            <boxGeometry args={[10.8, 2.55, 0.42]} />
            <meshStandardMaterial color="#160E16" />
          </mesh>
          <mesh position={[0, 0, 0.23]}>
            <planeGeometry args={[10.5, 2.32]} />
            <meshStandardMaterial
              map={signTex}
              emissive="#FFFFFF"
              emissiveMap={signTex}
              emissiveIntensity={0.72}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0, -0.23]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[10.5, 2.32]} />
            <meshStandardMaterial
              map={signTex}
              emissive="#FFFFFF"
              emissiveMap={signTex}
              emissiveIntensity={0.72}
              roughness={0.3}
            />
          </mesh>
        </group>

        {/* Dynamic Promo Banner when Competitor launches a price war! */}
        {promoActive && (
          <group position={[6.8, 6.4, 3.5]} rotation={[0, 0.18, 0]}>
            <mesh castShadow>
              <boxGeometry args={[5.4, 1.75, 0.3]} />
              <meshStandardMaterial color="#2D0A10" />
            </mesh>
            <mesh position={[0, 0, 0.18]}>
              <planeGeometry args={[5.15, 1.55]} />
              <meshStandardMaterial
                map={promoTex}
                emissive="#FFFFFF"
                emissiveMap={promoTex}
                emissiveIntensity={1.35}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* Competitor 3 Wash Bays */}
      {COMPETITOR_LAYOUT.bayPositions.map((pos, idx) => {
        const active = idx < compBays;
        return (
          <group key={idx} position={[pos.x, 0.08, pos.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
              <planeGeometry args={[5.5, 7.6]} />
              <meshStandardMaterial
                map={bayFloorTex}
                color={active ? '#FFFFFF' : '#524957'}
                roughness={active ? 0.28 : 0.9}
              />
            </mesh>
            {[-2.9, 2.9].map((px) => (
              <group key={px}>
                <mesh position={[px, 2.35, -3.65]} castShadow>
                  <boxGeometry args={[0.34, 4.7, 0.34]} />
                  <meshStandardMaterial color="#2B1C28" />
                </mesh>
                <mesh position={[px, 2.35, 3.65]} castShadow>
                  <boxGeometry args={[0.34, 4.7, 0.34]} />
                  <meshStandardMaterial color="#2B1C28" />
                </mesh>
              </group>
            ))}

            {active ? (
              <>
                <mesh position={[0, 4.35, 3.72]}>
                  <boxGeometry args={[4.4, 0.2, 0.16]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      ledRefs.current[idx] = el;
                    }}
                    color="#22C55E"
                    emissive="#22C55E"
                    emissiveIntensity={1.3}
                  />
                </mesh>
                {/* Crimson Steel Wash Arch */}
                <mesh position={[-2.35, 1.75, 0]} castShadow>
                  <boxGeometry args={[0.26, 3.5, 0.4]} />
                  <meshStandardMaterial color="#FF4D4F" roughness={0.35} />
                </mesh>
                <mesh position={[2.35, 1.75, 0]} castShadow>
                  <boxGeometry args={[0.26, 3.5, 0.4]} />
                  <meshStandardMaterial color="#FF4D4F" roughness={0.35} />
                </mesh>
                <mesh position={[0, 3.45, 0]} castShadow>
                  <boxGeometry args={[5.0, 0.36, 0.5]} />
                  <meshStandardMaterial color="#261722" roughness={0.4} />
                </mesh>
              </>
            ) : (
              <mesh position={[0, 0.52, 3.2]} castShadow>
                <boxGeometry args={[4.4, 0.85, 0.24]} />
                <meshStandardMaterial color="#FF4D4F" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
