import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';

export function resolveEffectiveTime(timeOfDay: number, mode: string): number {
  if (mode === 'morning') return 0.27;
  if (mode === 'day') return 0.48;
  if (mode === 'sunset') return 0.71;
  if (mode === 'night') return 0.93;
  return timeOfDay;
}

export function getNightFactor(t: number): number {
  // Returns 0 in bright day, 1 at deep night
  const sunWave = Math.sin((t - 0.22) * Math.PI * 2);
  return THREE.MathUtils.clamp((-sunWave + 0.15) * 1.15, 0, 1);
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
  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float h = clamp(dir.y, 0.0, 1.0);

    // Rich 3-stop Spider-Verse graphic novel sky gradient
    vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.26, h));
    col = mix(col, uTopColor, smoothstep(0.24, 0.85, h));

    // Stylized stepped halftone band near horizon
    float band = floor(h * 14.0) / 14.0;
    col = mix(col, mix(uHorizonColor, uMidColor, band), 0.14);

    // Crisp sun / moon disc + vibrant halo
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float halo = pow(sunDot, 10.0) * 0.45;
    float disc = smoothstep(0.9965, 0.9985, sunDot);
    col += uSunColor * (halo + disc * 1.4);

    // Crisp stars at twilight/night
    if (uNight > 0.25 && h > 0.12) {
      vec2 grid = floor(dir.xz / max(0.18, dir.y) * 28.0);
      float hash = fract(sin(dot(grid, vec2(127.1, 311.7))) * 43758.5453);
      if (hash > 0.992) {
        col += vec3(0.9, 0.96, 1.0) * uNight * smoothstep(0.12, 0.45, h) * 0.85;
      }
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function LightingAndSky() {
  const quality = useGameStore((s) => s.settings.quality);
  const { scene } = useThree();

  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#193366') },
        uMidColor: { value: new THREE.Color('#FF6F59') },
        uHorizonColor: { value: new THREE.Color('#FFC875') },
        uSunDir: { value: new THREE.Vector3(0.6, 0.45, -0.4) },
        uSunColor: { value: new THREE.Color('#FFE09E') },
        uNight: { value: 0 },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    });
  }, []);

  const palette = useMemo(
    () => ({
      morning: {
        top: new THREE.Color('#235596'),
        mid: new THREE.Color('#6FA8DC'),
        horizon: new THREE.Color('#FFD29D'),
        sun: new THREE.Color('#FFE5B4'),
        hemiSky: new THREE.Color('#8ED6FF'),
        hemiGround: new THREE.Color('#47333A'),
        fog: new THREE.Color('#D5C4C0'),
      },
      day: {
        top: new THREE.Color('#1B56A8'),
        mid: new THREE.Color('#4DA8E8'),
        horizon: new THREE.Color('#C4E8FF'),
        sun: new THREE.Color('#FFF6E3'),
        hemiSky: new THREE.Color('#A8E2FF'),
        hemiGround: new THREE.Color('#3A3F54'),
        fog: new THREE.Color('#BBDDF2'),
      },
      sunset: {
        top: new THREE.Color('#1D1B4B'),
        mid: new THREE.Color('#D93B6A'),
        horizon: new THREE.Color('#FF9F5A'),
        sun: new THREE.Color('#FFD07A'),
        hemiSky: new THREE.Color('#FF8A65'),
        hemiGround: new THREE.Color('#1E2F4D'),
        fog: new THREE.Color('#C46374'),
      },
      night: {
        top: new THREE.Color('#070B1A'),
        mid: new THREE.Color('#111B3A'),
        horizon: new THREE.Color('#1F2D54'),
        sun: new THREE.Color('#80D8FF'),
        hemiSky: new THREE.Color('#30508C'),
        hemiGround: new THREE.Color('#121524'),
        fog: new THREE.Color('#121C36'),
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

  useFrame(() => {
    const state = useGameStore.getState();
    const t = resolveEffectiveTime(state.timeOfDay, state.settings.timeMode);
    const night = getNightFactor(t);

    // Blend smoothly across 4 stylized Spider-Verse keyframe color scripts
    let from = palette.night;
    let to = palette.morning;
    let alpha = 0;

    if (t < 0.28) {
      from = palette.night;
      to = palette.morning;
      alpha = THREE.MathUtils.smoothstep(t, 0.14, 0.28);
    } else if (t < 0.56) {
      from = palette.morning;
      to = palette.day;
      alpha = THREE.MathUtils.smoothstep(t, 0.28, 0.45);
    } else if (t < 0.76) {
      from = palette.day;
      to = palette.sunset;
      alpha = THREE.MathUtils.smoothstep(t, 0.56, 0.72);
    } else {
      from = palette.sunset;
      to = palette.night;
      alpha = THREE.MathUtils.smoothstep(t, 0.76, 0.9);
    }

    tmpTop.copy(from.top).lerp(to.top, alpha);
    tmpMid.copy(from.mid).lerp(to.mid, alpha);
    tmpHorizon.copy(from.horizon).lerp(to.horizon, alpha);
    tmpSun.copy(from.sun).lerp(to.sun, alpha);
    tmpHemiSky.copy(from.hemiSky).lerp(to.hemiSky, alpha);
    tmpHemiGnd.copy(from.hemiGround).lerp(to.hemiGround, alpha);
    tmpFog.copy(from.fog).lerp(to.fog, alpha);

    // Sun orbit arc
    const sunAngle = (t - 0.22) * Math.PI * 2;
    const sunY = Math.max(0.18, Math.sin(sunAngle) * 0.85 + 0.12);
    const sunX = Math.cos(sunAngle) * 0.9;
    const sunZ = -0.42;

    skyMaterial.uniforms.uTopColor.value.copy(tmpTop);
    skyMaterial.uniforms.uMidColor.value.copy(tmpMid);
    skyMaterial.uniforms.uHorizonColor.value.copy(tmpHorizon);
    skyMaterial.uniforms.uSunColor.value.copy(tmpSun);
    skyMaterial.uniforms.uSunDir.value.set(sunX, sunY, sunZ).normalize();
    skyMaterial.uniforms.uNight.value = night;

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(tmpFog);
    }
    scene.background = tmpFog;

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX * 48, Math.max(22, sunY * 54), sunZ * 42);
      dirLightRef.current.color.copy(tmpSun);
      dirLightRef.current.intensity = THREE.MathUtils.lerp(2.75, 0.95, night);
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(tmpHemiSky);
      hemiLightRef.current.groundColor.copy(tmpHemiGnd);
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(1.65, 0.88, night);
    }

    if (rimLightRef.current) {
      // Vibrant Spider-Verse cyan/magenta rim accent
      rimLightRef.current.intensity = THREE.MathUtils.lerp(1.05, 1.25, night);
    }
  });

  const shadowMapSize = quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512;

  return (
    <>
      <fog attach="fog" args={['#C46374', 65, 165]} />

      {/* Stylized Shader Sky Dome */}
      <mesh material={skyMaterial} scale={[160, 160, 160]}>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>

      {/* Main Key Sunlight with Crisp Volumetric-Feel Shadow Map */}
      <directionalLight
        ref={dirLightRef}
        position={[32, 36, -20]}
        intensity={2.1}
        castShadow={quality !== 'low'}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={5}
        shadow-camera-far={125}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-bias={-0.0005}
      />

      {/* Spider-Verse Teal-vs-Coral Bounce Hemisphere */}
      <hemisphereLight ref={hemiLightRef} args={['#FF8A65', '#1E2F4D', 1.05]} />

      {/* Cool Cyan Graphic Rim Light */}
      <directionalLight
        ref={rimLightRef}
        position={[-28, 18, 34]}
        color="#38BDF8"
        intensity={0.7}
      />
    </>
  );
}
