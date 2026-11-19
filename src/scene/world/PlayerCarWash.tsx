import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PLAYER_LAYOUT } from '../../config/worldLayout';
import { gameSimulation } from '../../engine/simulation';
import {
  getBayFloorTexture,
  getLotConcreteTexture,
  getPriceTotemTexture,
  getSignTexture,
} from '../../graphics/proceduralTextures';
import { useGameStore } from '../../store/useGameStore';

export function PlayerCarWash() {
  const upgrades = useGameStore((s) => s.upgrades);
  const adCampaign = useGameStore((s) => s.economy.adCampaign);
  const washPrice = useGameStore((s) => s.economy.washPrice);
  const happyHourActive = useGameStore((s) => s.economy.happyHourRemaining > 0);

  const lotTex = useMemo(() => getLotConcreteTexture('#3B475C'), []);
  const bayFloorTex = useMemo(() => getBayFloorTexture('#00D4FF'), []);
  const mainSignTex = useMemo(
    () => getSignTexture('AUTOMOIKA', 'ПРЕМИУМ ДЕТЕЙЛИНГ • 24/7', '#0E1526', '#00D4FF', '#FFFFFF'),
    []
  );
  const billboardTex = useMemo(
    () => getSignTexture('SUPER WASH!', 'АКТИВНАЯ ПЕНА + ВОСК', '#181024', '#FF3B5C', '#FFF5E1'),
    []
  );
  const effPrice = happyHourActive ? Math.round((washPrice * 0.85) / 10) * 10 : washPrice;
  const priceTotemTex = useMemo(
    () =>
      getPriceTotemTexture(
        'AUTOMOIKA',
        effPrice,
        happyHourActive ? '#FFB800' : '#00D4FF',
        happyHourActive ? 'ЧАС -15%!' : undefined
      ),
    [effPrice, happyHourActive]
  );

  const ledRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([null, null, null, null]);
  const gantryRefs = useRef<Array<THREE.Group | null>>([null, null, null, null]);

  // Update bay LED strips & animated sliding wash gantry arches smoothly in real time
  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    for (let i = 0; i < 4; i++) {
      const mat = ledRefs.current[i];
      const status = gameSimulation.getBayStatus('player', i);
      if (mat) {
        if (status === 'free') {
          mat.color.set('#22C55E');
          mat.emissive.set('#22C55E');
          mat.emissiveIntensity = 1.4;
        } else if (status === 'incoming') {
          mat.color.set('#FFB800');
          mat.emissive.set('#FFB800');
          mat.emissiveIntensity = 1.9;
        } else if (status === 'washing') {
          mat.color.set('#00D4FF');
          mat.emissive.set('#00D4FF');
          mat.emissiveIntensity = 2.4;
        } else {
          mat.color.set('#A3E635');
          mat.emissive.set('#A3E635');
          mat.emissiveIntensity = 2.6;
        }
      }

      const gantry = gantryRefs.current[i];
      if (gantry) {
        const car = gameSimulation.getBayVehicle('player', i);
        const desiredZ =
          car && (car.washStage === 'rinse' || car.washStage === 'foam' || car.washStage === 'dry')
            ? Math.sin(t * 1.4 + i) * 1.85
            : -0.35;
        gantry.position.z = THREE.MathUtils.lerp(gantry.position.z, desiredZ, 0.08);
      }
    }
  });

  const billboardActive = adCampaign === 'billboard' || adCampaign === 'radio';

  return (
    <group>
      {/* Main Concrete Lot Pad (Z = 7.5 to 31.5, X = -22 to +22) */}
      <mesh position={[0, 0.03, 19.5]} receiveShadow>
        <boxGeometry args={[44, 0.08, 24]} />
        <meshStandardMaterial map={lotTex} roughness={0.86} metalness={0.04} />
      </mesh>

      {/* Perimeter Stylized Low Wall & Cyan Accent Curb */}
      <mesh position={[0, 0.45, 31.3]} castShadow receiveShadow>
        <boxGeometry args={[44, 0.9, 0.45]} />
        <meshStandardMaterial color="#1F2838" roughness={0.7} />
      </mesh>
      <mesh position={[-21.8, 0.45, 19.5]} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.9, 24]} />
        <meshStandardMaterial color="#1F2838" roughness={0.7} />
      </mesh>
      <mesh position={[21.8, 0.45, 19.5]} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.9, 24]} />
        <meshStandardMaterial color="#1F2838" roughness={0.7} />
      </mesh>

      {/* Queue Lane Painted Stripes & Glowing Queue Guides */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.5, 0.085, 8.85]}>
        <planeGeometry args={[28, 0.16]} />
        <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.5, 0.085, 11.95]}>
        <planeGeometry args={[28, 0.16]} />
        <meshStandardMaterial color="#FFB800" />
      </mesh>

      {/* Queue Bollards (More glow poles appear when Queue Lot upgrades!) */}
      {[-6, -1, 4, 9, 14].map((bx, i) => (
        <group key={bx} position={[bx, 0.08, 8.2]}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 0.84, 8]} />
            <meshStandardMaterial color="#1B2230" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.16, 8]} />
            <meshStandardMaterial
              color={i < upgrades.queueLot + 2 ? '#00D4FF' : '#FFB800'}
              emissive={i < upgrades.queueLot + 2 ? '#00D4FF' : '#FFB800'}
              emissiveIntensity={upgrades.queueLot >= 2 ? 1.5 : 0.45}
            />
          </mesh>
        </group>
      ))}

      {/* Live Glowing Ruble Price Totem Pylon at Entrance */}
      <group position={[15.0, 0.08, 7.9]} rotation={[0, -0.32, 0]}>
        <mesh position={[0, 2.35, 0]} castShadow>
          <boxGeometry args={[1.65, 4.7, 0.36]} />
          <meshStandardMaterial color="#0F172A" roughness={0.35} metalness={0.5} />
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
        <mesh position={[0, 2.35, 0.2]}>
          <planeGeometry args={[1.5, 4.4]} />
          <meshStandardMaterial
            map={priceTotemTex}
            emissive="#FFFFFF"
            emissiveMap={priceTotemTex}
            emissiveIntensity={0.85}
          />
        </mesh>
      </group>

      {/* Entry & Exit Driveway Signs */}
      <group position={[21.2, 0.08, 8.4]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 2.4, 8]} />
          <meshStandardMaterial color="#1E2534" />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[1.4, 0.55, 0.16]} />
          <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={0.85} />
        </mesh>
      </group>
      <group position={[-19.8, 0.08, 8.4]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 2.4, 8]} />
          <meshStandardMaterial color="#1E2534" />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[1.4, 0.55, 0.16]} />
          <meshStandardMaterial color="#FF3B5C" emissive="#FF3B5C" emissiveIntensity={0.85} />
        </mesh>
      </group>

      {/* Main Office & Reception Wing (Left side of Wash Bays) */}
      <group position={[-13.6, 0.07, 18.5]}>
        {/* Main Body */}
        <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.2, 4.8, 7.6]} />
          <meshStandardMaterial color="#1A2438" roughness={0.62} />
        </mesh>
        {/* Warm Architectural Accent Cladding */}
        <mesh position={[-2.62, 2.4, 0]}>
          <boxGeometry args={[0.15, 4.4, 7.2]} />
          <meshStandardMaterial color="#FF3B5C" roughness={0.5} />
        </mesh>
        {/* Front Glass Storefront facing street */}
        <mesh position={[0, 1.85, -3.82]}>
          <planeGeometry args={[4.2, 2.7]} />
          <meshStandardMaterial
            color="#7DD3FC"
            emissive="#38BDF8"
            emissiveIntensity={0.45}
            roughness={0.15}
            metalness={0.35}
          />
        </mesh>
        {/* Angled Modern Fascia Roof */}
        <mesh position={[0, 5.05, 0]} castShadow>
          <boxGeometry args={[5.8, 0.55, 8.4]} />
          <meshStandardMaterial color="#0F1624" roughness={0.45} />
        </mesh>
        {/* Cyan Neon Fascia Trim */}
        <mesh position={[0, 4.85, -4.22]}>
          <boxGeometry args={[5.8, 0.16, 0.12]} />
          <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={2.1} />
        </mesh>

        {/* Side Water Filtration Tank & Compressor */}
        <mesh position={[-3.3, 1.5, 1.8]} castShadow>
          <cylinderGeometry args={[0.72, 0.72, 3.0, 12]} />
          <meshStandardMaterial color="#38BDF8" roughness={0.35} metalness={0.45} />
        </mesh>
        <mesh position={[-3.3, 0.9, -1.2]} castShadow>
          <boxGeometry args={[1.1, 1.8, 1.4]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.5} />
        </mesh>

        {/* Rooftop Solar Panels (physically appear with ecoSolar upgrade Lv 2..4!) */}
        {upgrades.ecoSolar >= 2 && (
          <group position={[0, 5.48, 0]}>
            {Array.from({ length: upgrades.ecoSolar - 1 }).map((_, si) => (
              <mesh
                key={si}
                position={[0, 0.18, -2.2 + si * 2.2]}
                rotation={[-0.25, 0, 0]}
                castShadow
              >
                <boxGeometry args={[4.2, 0.1, 1.6]} />
                <meshStandardMaterial
                  color="#0F294A"
                  emissive="#0EA5E9"
                  emissiveIntensity={0.22}
                  roughness={0.18}
                  metalness={0.75}
                />
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* Main Car Wash Open-Truss Skylight Canopy & Illuminated AUTOMOIKA Sign */}
      <group position={[1.5, 0.07, 18.5]}>
        {/* Structural Perimeter Steel Fascia Beams */}
        <mesh position={[0, 4.95, -3.95]} castShadow>
          <boxGeometry args={[24.6, 0.52, 0.45]} />
          <meshStandardMaterial color="#141C2E" roughness={0.48} />
        </mesh>
        <mesh position={[0, 4.95, 3.95]} castShadow>
          <boxGeometry args={[24.6, 0.52, 0.45]} />
          <meshStandardMaterial color="#141C2E" roughness={0.48} />
        </mesh>
        {/* Cross Steel Trusses between Bays */}
        {[-12.0, -6.0, 0, 6.0, 12.0].map((tx) => (
          <mesh key={tx} position={[tx, 4.95, 0]} castShadow>
            <boxGeometry args={[0.38, 0.48, 8.2]} />
            <meshStandardMaterial color="#141C2E" roughness={0.48} />
          </mesh>
        ))}
        {/* Translucent Skylight Glass Roof letting sun & camera see clearly into all wash bays! */}
        <mesh position={[0, 5.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[23.8, 7.5]} />
          <meshStandardMaterial
            color="#BAE6FD"
            transparent
            opacity={0.18}
            roughness={0.12}
            metalness={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Single Balanced Studio Floodlight (keeps bays vivid while saving GPU fragment cost on mobile!) */}
        <pointLight position={[0, 4.4, 0]} color="#E6F9FF" intensity={30} distance={34} decay={1.5} />
        {/* Front Bold Cyan Graphic Edge */}
        <mesh position={[0, 4.78, -4.2]}>
          <boxGeometry args={[24.8, 0.22, 0.14]} />
          <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={2.1} />
        </mesh>
        {/* Coral Graphic Stripe */}
        <mesh position={[0, 5.05, -4.2]}>
          <boxGeometry args={[24.8, 0.14, 0.14]} />
          <meshStandardMaterial color="#FF3B5C" emissive="#FF3B5C" emissiveIntensity={1.6} />
        </mesh>

        {/* Iconic Rooftop AUTOMOIKA Signboard facing Street & Overview Camera */}
        <group position={[-2.5, 6.75, -3.5]}>
          {/* Support struts */}
          {[-4.2, 0, 4.2].map((sx) => (
            <mesh key={sx} position={[sx, -1.1, 0]}>
              <boxGeometry args={[0.24, 1.8, 0.24]} />
              <meshStandardMaterial color="#0E131F" />
            </mesh>
          ))}
          <mesh castShadow>
            <boxGeometry args={[11.4, 2.65, 0.42]} />
            <meshStandardMaterial color="#0D121F" roughness={0.4} />
          </mesh>
          {/* Front & Back illuminated graphic faces */}
          <mesh position={[0, 0, -0.23]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[11.1, 2.42]} />
            <meshStandardMaterial
              map={mainSignTex}
              emissive="#FFFFFF"
              emissiveMap={mainSignTex}
              emissiveIntensity={0.65}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0, 0.23]}>
            <planeGeometry args={[11.1, 2.42]} />
            <meshStandardMaterial
              map={mainSignTex}
              emissive="#FFFFFF"
              emissiveMap={mainSignTex}
              emissiveIntensity={0.65}
              roughness={0.3}
            />
          </mesh>
        </group>

        {/* Rooftop Advertising Neon Billboard (Lights up brightly when Billboard/Radio Ads are active!) */}
        <group position={[7.6, 6.65, -2.9]} rotation={[0, -0.22, 0]}>
          <mesh position={[-2.1, -1.0, 0]}>
            <boxGeometry args={[0.22, 1.7, 0.22]} />
            <meshStandardMaterial color="#111622" />
          </mesh>
          <mesh position={[2.1, -1.0, 0]}>
            <boxGeometry args={[0.22, 1.7, 0.22]} />
            <meshStandardMaterial color="#111622" />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[6.4, 2.1, 0.36]} />
            <meshStandardMaterial color="#141624" />
          </mesh>
          <mesh position={[0, 0, -0.2]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[6.1, 1.88]} />
            <meshStandardMaterial
              map={billboardTex}
              emissive="#FFFFFF"
              emissiveMap={billboardTex}
              emissiveIntensity={billboardActive ? 1.15 : 0.08}
              color={billboardActive ? '#FFFFFF' : '#4A5268'}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <planeGeometry args={[6.1, 1.88]} />
            <meshStandardMaterial
              map={billboardTex}
              emissive="#FFFFFF"
              emissiveMap={billboardTex}
              emissiveIntensity={billboardActive ? 1.15 : 0.08}
              color={billboardActive ? '#FFFFFF' : '#4A5268'}
              roughness={0.35}
            />
          </mesh>
        </group>
      </group>

      {/* 4 Individual Wash Bays (Unlocked vs Expansion Construction Plots) */}
      {PLAYER_LAYOUT.bayPositions.map((pos, idx) => {
        const unlocked = idx < upgrades.bays;
        return (
          <group key={idx} position={[pos.x, 0.08, pos.z]}>
            {/* Bay Floor Tile */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
              <planeGeometry args={[5.4, 7.6]} />
              <meshStandardMaterial
                map={bayFloorTex}
                color={unlocked ? '#FFFFFF' : '#576075'}
                roughness={unlocked ? 0.24 : 0.9}
                metalness={unlocked ? 0.2 : 0}
              />
            </mesh>

            {/* Support Pillars separating bays */}
            {[-2.85, 2.85].map((px) => (
              <group key={px}>
                <mesh position={[px, 2.4, -3.65]} castShadow>
                  <boxGeometry args={[0.34, 4.8, 0.34]} />
                  <meshStandardMaterial color="#1D273B" roughness={0.5} />
                </mesh>
                <mesh position={[px, 2.4, 3.65]} castShadow>
                  <boxGeometry args={[0.34, 4.8, 0.34]} />
                  <meshStandardMaterial color="#1D273B" roughness={0.5} />
                </mesh>
                {/* Translucent Splash Partition Glass */}
                {unlocked && (
                  <mesh position={[px, 1.55, 0]}>
                    <boxGeometry args={[0.08, 2.6, 6.4]} />
                    <meshStandardMaterial
                      color="#93C5FD"
                      transparent
                      opacity={0.22}
                      roughness={0.12}
                    />
                  </mesh>
                )}
              </group>
            ))}

            {unlocked ? (
              <>
                {/* Live Bay Status LED Bar above Front Entrance */}
                <mesh position={[0, 4.42, -3.72]}>
                  <boxGeometry args={[4.4, 0.2, 0.16]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      ledRefs.current[idx] = el;
                    }}
                    color="#22C55E"
                    emissive="#22C55E"
                    emissiveIntensity={1.4}
                  />
                </mesh>

                {/* Overhead Studio LED Ceiling Light Tubes */}
                {[-1.55, 1.55].map((lx) => (
                  <mesh key={lx} position={[lx, 4.55, 0]}>
                    <boxGeometry args={[0.14, 0.08, 6.2]} />
                    <meshStandardMaterial color="#FFFFFF" emissive="#E0F7FF" emissiveIntensity={2.2} />
                  </mesh>
                ))}

                {/* Overhead Animated Sliding Wash Gantry Arch */}
                <group
                  ref={(el) => {
                    gantryRefs.current[idx] = el;
                  }}
                  position={[0, 0, -0.35]}
                >
                  <mesh position={[-2.35, 1.8, 0]} castShadow>
                    <boxGeometry args={[0.26, 3.6, 0.42]} />
                    <meshStandardMaterial
                      color={upgrades.pressureWasher >= 3 ? '#00D4FF' : '#3B82F6'}
                      roughness={0.35}
                      metalness={0.5}
                    />
                  </mesh>
                  <mesh position={[2.35, 1.8, 0]} castShadow>
                    <boxGeometry args={[0.26, 3.6, 0.42]} />
                    <meshStandardMaterial
                      color={upgrades.pressureWasher >= 3 ? '#00D4FF' : '#3B82F6'}
                      roughness={0.35}
                      metalness={0.5}
                    />
                  </mesh>
                  <mesh position={[0, 3.55, 0]} castShadow>
                    <boxGeometry args={[5.0, 0.36, 0.56]} />
                    <meshStandardMaterial color="#182236" roughness={0.4} metalness={0.55} />
                  </mesh>

                  {/* Foam System Manifold Bar (Lv 2+) */}
                  {upgrades.foamSystem >= 2 && (
                    <mesh position={[0, 3.25, -0.35]}>
                      <cylinderGeometry args={[0.1, 0.1, 4.2, 8]} />
                      <meshStandardMaterial
                        color="#FF3B5C"
                        emissive="#FF3B5C"
                        emissiveIntensity={0.45}
                      />
                    </mesh>
                  )}

                  {/* Turbo Air Dryer Ducts (Lv 2+) */}
                  {upgrades.dryerWax >= 2 && (
                    <group position={[0, 3.3, 1.55]}>
                      {[-1.2, 0, 1.2].map((dx) => (
                        <mesh key={dx} position={[dx, 0, 0]} castShadow>
                          <boxGeometry args={[0.85, 0.52, 0.72]} />
                          <meshStandardMaterial color="#FFB800" roughness={0.35} metalness={0.4} />
                        </mesh>
                      ))}
                    </group>
                  )}
                </group>

                {/* Pressure Washer Equipment Cabinet on Side */}
                <mesh position={[-2.35, 0.65, -2.5]} castShadow>
                  <boxGeometry args={[0.62, 1.3, 0.75]} />
                  <meshStandardMaterial color="#F59E0B" roughness={0.4} />
                </mesh>
              </>
            ) : (
              /* Locked Expansion Bay Construction Barriers — tap in 3D to open Upgrades! */
              <group
                onClick={(e) => {
                  e.stopPropagation();
                  useGameStore.getState().setActivePanel('upgrades');
                }}
              >
                <mesh position={[0, 0.52, -3.2]} castShadow>
                  <boxGeometry args={[4.4, 0.85, 0.24]} />
                  <meshStandardMaterial color="#FFB800" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.52, 3.2]} castShadow>
                  <boxGeometry args={[4.4, 0.85, 0.24]} />
                  <meshStandardMaterial color="#FFB800" roughness={0.6} />
                </mesh>
                {/* Traffic Cones */}
                {[-1.5, 0, 1.5].map((cx) => (
                  <mesh key={cx} position={[cx, 0.36, -1.6]} castShadow>
                    <coneGeometry args={[0.24, 0.72, 8]} />
                    <meshStandardMaterial color="#FF5722" roughness={0.5} />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        );
      })}

      {/* Customer Waiting Zone & VIP Lounge (Rear-Right & Rear-Left Plaza — upgrades with vipLounge!) */}
      <group position={[12.5, 0.08, 27.6]}>
        {/* Wooden Deck Platform */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[9.2, 0.16, 4.6]} />
          <meshStandardMaterial color="#5E4534" roughness={0.85} />
        </mesh>

        {/* Benches */}
        {[-2.4, 1.2].map((bx) => (
          <group key={bx} position={[bx, 0.16, 0.8]}>
            <mesh position={[0, 0.36, 0]} castShadow>
              <boxGeometry args={[2.1, 0.14, 0.68]} />
              <meshStandardMaterial color="#C88A4B" roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.68, 0.28]} castShadow>
              <boxGeometry args={[2.1, 0.45, 0.12]} />
              <meshStandardMaterial color="#B5793E" roughness={0.75} />
            </mesh>
          </group>
        ))}

        {/* Stylized Shade Umbrella (Lv 1) or Full Glass Lounge Canopy (Lv 2+) */}
        {upgrades.vipLounge === 1 ? (
          <group position={[-2.4, 0.16, -0.4]}>
            <mesh position={[0, 1.35, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 2.7, 8]} />
              <meshStandardMaterial color="#2A3242" />
            </mesh>
            <mesh position={[0, 2.65, 0]} castShadow>
              <coneGeometry args={[1.8, 0.65, 8]} />
              <meshStandardMaterial color="#FF3B5C" roughness={0.65} />
            </mesh>
          </group>
        ) : (
          <group>
            {/* Modern Pergola / VIP Lounge Pavilion */}
            {[-4.2, 4.2].map((px) => (
              <group key={px}>
                <mesh position={[px, 1.55, -2.0]} castShadow>
                  <boxGeometry args={[0.2, 3.1, 0.2]} />
                  <meshStandardMaterial color="#192130" />
                </mesh>
                <mesh position={[px, 1.55, 2.0]} castShadow>
                  <boxGeometry args={[0.2, 3.1, 0.2]} />
                  <meshStandardMaterial color="#192130" />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 3.15, 0]} castShadow>
              <boxGeometry args={[9.0, 0.24, 4.4]} />
              <meshStandardMaterial color="#162033" roughness={0.45} />
            </mesh>
            {/* Warm Lounge Glow Strip */}
            <mesh position={[0, 3.0, -2.18]}>
              <boxGeometry args={[8.6, 0.12, 0.1]} />
              <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={1.6} />
            </mesh>

            {/* Coffee Kiosk Counter (Lv 2+) */}
            <group position={[3.2, 0.16, -0.5]}>
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[1.6, 1.1, 2.2]} />
                <meshStandardMaterial color="#1F2937" roughness={0.5} />
              </mesh>
              <mesh position={[0, 1.35, -0.2]} castShadow>
                <boxGeometry args={[0.65, 0.55, 0.7]} />
                <meshStandardMaterial color="#FF3B5C" roughness={0.35} />
              </mesh>
            </group>

            {/* VIP Glass Back Wall & Decorative Planters (Lv 3+) */}
            {upgrades.vipLounge >= 3 && (
              <mesh position={[0, 1.6, 2.05]}>
                <boxGeometry args={[8.2, 2.8, 0.1]} />
                <meshStandardMaterial
                  color="#38BDF8"
                  transparent
                  opacity={0.28}
                  roughness={0.12}
                />
              </mesh>
            )}
          </group>
        )}

        {/* Waiting Lounge Customer Figures (adds extra life!) */}
        {Array.from({ length: Math.min(3, upgrades.vipLounge) }).map((_, ci) => (
          <group key={ci} position={[-2.9 + ci * 1.9, 0.16, 0.5]}>
            <mesh position={[0, 0.65, 0]} castShadow>
              <capsuleGeometry args={[0.2, 0.55, 4, 8]} />
              <meshStandardMaterial
                color={ci === 0 ? '#F97316' : ci === 1 ? '#38BDF8' : '#EAB308'}
                roughness={0.7}
              />
            </mesh>
            <mesh position={[0, 1.24, 0]} castShadow>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#E6B89C" roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Customer Parking Spots on Rear-Left */}
      <group position={[-5.5, 0.09, 28.4]}>
        {[-3.2, 0, 3.2].map((px) => (
          <mesh key={px} rotation={[-Math.PI / 2, 0, 0]} position={[px, 0, 0]}>
            <planeGeometry args={[0.14, 4.4]} />
            <meshStandardMaterial color="#DCE4F0" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
