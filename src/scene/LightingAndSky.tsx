import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gameSimulation } from '../engine/simulation';
import { useGameStore } from '../store/useGameStore';

export function resolveEffectiveTime(timeOfDay: number, mode: string): number {
  if (mode === 'morning') return 0.31; // 07:26 golden dawn
  if (mode === 'day') return 0.52; // 12:30 bright sunlit day
  if (mode === 'sunset') return 0.76; // 18:15 vibrant golden sunset
  if (mode === 'night') return 0.89; // 21:20 neon evening
  return timeOfDay;
}

export function getNightFactor(t: number): number {
  // Smoothly fades in streetlamps, headlights & evening glow after 18:30 (t > 0.77)
  if (t >= 0.77) {
    return THREE.MathUtils.smoothstep(t, 0.77, 0.89);
  }
  if (t < 0.31) {
    return 1 - THREE.MathUtils.smoothstep(t, 0.25, 0.31);
  }
  return 0;
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uTime;
  varying vec3 vWorldPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 dir = normalize(vWorldPos);
    float h = clamp(dir.y, 0.0, 1.0);

    vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
    col = mix(col, uTopColor, smoothstep(0.24, 0.86, h));

    if (h > 0.06) {
      vec2 cloudUv = dir.xz / (h + 0.24) * 1.85 + vec2(uTime * 0.014, uTime * 0.004);
      float n1 = noise(cloudUv);
      float n2 = noise(cloudUv * 2.05 + vec2(4.2, 1.7));
      float cloud = smoothstep(0.56, 0.82, n1 * 0.65 + n2 * 0.35);
      vec3 cloudCol = mix(vec3(1.0, 0.98, 0.95), uHorizonColor * 1.12, 0.38);
      float cloudAlpha = cloud * smoothstep(0.06, 0.24, h) * (1.0 - smoothstep(0.7, 0.95, h)) * (1.0 - uNight * 0.72);
      col = mix(col, cloudCol, cloudAlpha * 0.54);
    }

    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float halo = pow(sunDot, 8.0) * 0.42;
    float disc = smoothstep(0.996, 0.9985, sunDot);
    col += uSunColor * (halo + disc * 1.45);

    if (uNight > 0.22 && h > 0.1) {
      vec2 grid = floor(dir.xz / max(0.18, dir.y) * 28.0);
      float hash = hash21(grid);
      if (hash > 0.988) {
        float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + hash * 60.0);
        col += vec3(0.88, 0.95, 1.0) * uNight * twinkle * smoothstep(0.1, 0.42, h) * 0.95;
      }
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function LightingAndSky() {
  const quality = useGameStore((s) => s.settings.quality);
  const { scene, gl } = useThree();

  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  // Offline procedural PMREM Environment for showroom reflections on cars & wet floors
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.78;
    roomEnv.dispose();
    return () => {
      scene.environment = null;
      envRT.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#1B5EB8') },
        uMidColor: { value: new THREE.Color('#5BB8F5') },
        uHorizonColor: { value: new THREE.Color('#FFE0B8') },
        uSunDir: { value: new THREE.Vector3(0.55, 0.72, -0.35) },
        uSunColor: { value: new THREE.Color('#FFF7E0') },
        uNight: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    });
  }, []);

  useEffect(() => {
    return () => {
      skyMaterial.dispose();
    };
  }, [skyMaterial]);

  const palette = useMemo(
    () => ({
      morning: {
        top: new THREE.Color('#2364B5'),
        mid: new THREE.Color('#74BCEE'),
        horizon: new THREE.Color('#FFD9A8'),
        sun: new THREE.Color('#FFE9BF'),
        hemiSky: new THREE.Color('#B5E2FF'),
        hemiGround: new THREE.Color('#574B5E'),
        fog: new THREE.Color('#E3E8F0'),
      },
      day: {
        top: new THREE.Color('#155BC0'),
        mid: new THREE.Color('#4AB4F7'),
        horizon: new THREE.Color('#D4F0FF'),
        sun: new THREE.Color('#FFF9EB'),
        hemiSky: new THREE.Color('#C4EAFF'),
        hemiGround: new THREE.Color('#4A5470'),
        fog: new THREE.Color('#CBE8FC'),
      },
      sunset: {
        top: new THREE.Color('#252768'),
        mid: new THREE.Color('#EA507C'),
        horizon: new THREE.Color('#FFB164'),
        sun: new THREE.Color('#FFD27A'),
        hemiSky: new THREE.Color('#FFA57B'),
        hemiGround: new THREE.Color('#303E62'),
        fog: new THREE.Color('#D97E88'),
      },
      night: {
        top: new THREE.Color('#0C1633'),
        mid: new THREE.Color('#192F66'),
        horizon: new THREE.Color('#2D4680'),
        sun: new THREE.Color('#99E2FF'),
        hemiSky: new THREE.Color('#5685D1'),
        hemiGround: new THREE.Color('#212C48'),
        fog: new THREE.Color('#1E3056'),
      },
    }),
    []
  );

  const tmpTop = useMemo(() => new THREE.Color(), []);
  const tmpMid = useMemo(() => new THREE.Color(), []);
  const tmpHorizon = useMemo(() => new THREE.Color(), []);
  const tmpSun = useMemo(() => new THREE.Color(), []);
  const tmpHemiSky = useMemo(() => new THREE.Color(), []);
  const tmpHemiGnd = useMemo(() => new THREE.Color(), []);
  const tmpFog = useMemo(() => new THREE.Color(), []);

  useFrame((clockState) => {
    const timeMode = useGameStore.getState().settings.timeMode;
    // Read smooth 60 FPS liveTimeOfDay directly from simulation (zero React re-renders!)
    const t = resolveEffectiveTime(gameSimulation.liveTimeOfDay, timeMode);
    const night = getNightFactor(t);

    // Crisp shift progression: 07:00 Morning (0.29) -> 12:30 Day (0.52) -> 18:15 Sunset (0.76) -> 21:30 Neon Evening (0.90)
    let from = palette.morning;
    let to = palette.day;
    let alpha = 0;

    if (t < 0.45) {
      from = palette.morning;
      to = palette.day;
      alpha = THREE.MathUtils.smoothstep(t, 0.30, 0.45);
    } else if (t < 0.76) {
      from = palette.day;
      to = palette.sunset;
      alpha = THREE.MathUtils.smoothstep(t, 0.62, 0.76);
    } else {
      from = palette.sunset;
      to = palette.night;
      alpha = THREE.MathUtils.smoothstep(t, 0.76, 0.89);
    }

    tmpTop.copy(from.top).lerp(to.top, alpha);
    tmpMid.copy(from.mid).lerp(to.mid, alpha);
    tmpHorizon.copy(from.horizon).lerp(to.horizon, alpha);
    tmpSun.copy(from.sun).lerp(to.sun, alpha);
    tmpHemiSky.copy(from.hemiSky).lerp(to.hemiSky, alpha);
    tmpHemiGnd.copy(from.hemiGround).lerp(to.hemiGround, alpha);
    tmpFog.copy(from.fog).lerp(to.fog, alpha);

    // Smooth visible sun arc across the sky from East (07:00) through Noon (13:00) to West (21:00)
    const shiftProgress = THREE.MathUtils.clamp((t - 7 / 24) / (15 / 24), 0, 1);
    const arcAngle = shiftProgress * Math.PI;
    const sunX = Math.cos(arcAngle) * 0.85;
    const sunY = Math.max(0.45, Math.sin(arcAngle) * 0.82 + 0.25);
    const sunZ = -0.36;

    skyMaterial.uniforms.uTopColor.value.copy(tmpTop);
    skyMaterial.uniforms.uMidColor.value.copy(tmpMid);
    skyMaterial.uniforms.uHorizonColor.value.copy(tmpHorizon);
    skyMaterial.uniforms.uSunColor.value.copy(tmpSun);
    skyMaterial.uniforms.uSunDir.value.set(sunX, sunY, sunZ).normalize();
    skyMaterial.uniforms.uNight.value = night;
    skyMaterial.uniforms.uTime.value = clockState.clock.elapsedTime;

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(tmpFog);
    }
    scene.background = tmpFog;
    scene.environmentIntensity = THREE.MathUtils.lerp(1.05, 0.58, night);

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX * 42, Math.max(30, sunY * 54), sunZ * 36);
      dirLightRef.current.color.copy(tmpSun);
      dirLightRef.current.intensity = THREE.MathUtils.lerp(2.95, 1.45, night);
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(tmpHemiSky);
      hemiLightRef.current.groundColor.copy(tmpHemiGnd);
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(1.7, 1.2, night);
    }

    if (rimLightRef.current) {
      rimLightRef.current.intensity = THREE.MathUtils.lerp(0.95, 1.5, night);
    }
  });

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const shadowMapSize =
    quality === 'ultra'
      ? isMobile
        ? 2048
        : 4096
      : quality === 'high'
        ? 2048
        : quality === 'medium'
          ? 1024
          : 512;

  return (
    <>
      <fog attach="fog" args={['#CBE8FC', 118, 245]} />

      {/* Stylized Shader Sky Dome with Drifting Clouds & Evening Stars */}
      <mesh material={skyMaterial} scale={[185, 185, 185]}>
        <sphereGeometry args={[1, 32, 22]} />
      </mesh>

      {/* Main Key Sunlight with Focused High-Density Shadow Frustum */}
      <directionalLight
        ref={dirLightRef}
        position={[26, 44, -18]}
        intensity={2.8}
        castShadow={quality !== 'low'}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={5}
        shadow-camera-far={135}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-radius={1}
      />

      {/* Rich Atmospheric Bounce Hemisphere */}
      <hemisphereLight ref={hemiLightRef} args={['#C4EAFF', '#4A5470', 1.6]} />

      {/* Cool Cyan Graphic Rim Light */}
      <directionalLight
        ref={rimLightRef}
        position={[-28, 22, 34]}
        color="#38BDF8"
        intensity={0.95}
      />
    </>
  );
}
