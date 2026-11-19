import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useGameStore } from '../store/useGameStore';

export function resolveEffectiveTime(timeOfDay: number, mode: string): number {
  if (mode === 'morning') return 0.28;
  if (mode === 'day') return 0.46;
  if (mode === 'sunset') return 0.71;
  if (mode === 'night') return 0.92;
  return timeOfDay;
}

export function getNightFactor(t: number): number {
  // Returns 0 in bright day, 1 at deep night
  const sunWave = Math.sin((t - 0.22) * Math.PI * 2);
  return THREE.MathUtils.clamp((-sunWave + 0.12) * 1.15, 0, 1);
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

    // Rich 3-stop vibrant graphic sky gradient
    vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
    col = mix(col, uTopColor, smoothstep(0.24, 0.86, h));

    // Stylized soft drifting clouds during day & sunset
    if (h > 0.06) {
      vec2 cloudUv = dir.xz / (h + 0.24) * 1.85 + vec2(uTime * 0.015, uTime * 0.005);
      float n1 = noise(cloudUv);
      float n2 = noise(cloudUv * 2.1 + vec2(4.2, 1.7));
      float cloud = smoothstep(0.56, 0.82, n1 * 0.65 + n2 * 0.35);
      vec3 cloudCol = mix(vec3(1.0, 0.98, 0.95), uHorizonColor * 1.15, 0.35);
      float cloudAlpha = cloud * smoothstep(0.06, 0.24, h) * (1.0 - smoothstep(0.7, 0.95, h)) * (1.0 - uNight * 0.72);
      col = mix(col, cloudCol, cloudAlpha * 0.55);
    }

    // Crisp sun / moon disc + vibrant halo
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float halo = pow(sunDot, 8.0) * 0.42;
    float disc = smoothstep(0.996, 0.9985, sunDot);
    col += uSunColor * (halo + disc * 1.45);

    // Twinkling stars at twilight/night
    if (uNight > 0.22 && h > 0.1) {
      vec2 grid = floor(dir.xz / max(0.18, dir.y) * 30.0);
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

  // Build crisp procedural PMREM Environment map (offline, zero network!) for glossy car clearcoat & wet reflections!
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.72;
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
        uTopColor: { value: new THREE.Color('#1A5BB8') },
        uMidColor: { value: new THREE.Color('#53B3F2') },
        uHorizonColor: { value: new THREE.Color('#D4F0FF') },
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
        top: new THREE.Color('#1E62B0'),
        mid: new THREE.Color('#6BB7EB'),
        horizon: new THREE.Color('#FFE0B2'),
        sun: new THREE.Color('#FFF0CC'),
        hemiSky: new THREE.Color('#A8E0FF'),
        hemiGround: new THREE.Color('#4B4558'),
        fog: new THREE.Color('#DCE7F0'),
      },
      day: {
        top: new THREE.Color('#155BC0'),
        mid: new THREE.Color('#48B2F5'),
        horizon: new THREE.Color('#D4F0FF'),
        sun: new THREE.Color('#FFF9EB'),
        hemiSky: new THREE.Color('#BCE8FF'),
        hemiGround: new THREE.Color('#46506B'),
        fog: new THREE.Color('#C8E6FA'),
      },
      sunset: {
        top: new THREE.Color('#22245E'),
        mid: new THREE.Color('#E84B78'),
        horizon: new THREE.Color('#FFB067'),
        sun: new THREE.Color('#FFD98A'),
        hemiSky: new THREE.Color('#FFA27B'),
        hemiGround: new THREE.Color('#2C3B5E'),
        fog: new THREE.Color('#D47A88'),
      },
      night: {
        top: new THREE.Color('#0B142E'),
        mid: new THREE.Color('#182B5C'),
        horizon: new THREE.Color('#2A4175'),
        sun: new THREE.Color('#99E2FF'),
        hemiSky: new THREE.Color('#4B77C2'),
        hemiGround: new THREE.Color('#1D263E'),
        fog: new THREE.Color('#1C2B4D'),
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
    const state = useGameStore.getState();
    const t = resolveEffectiveTime(state.timeOfDay, state.settings.timeMode);
    const night = getNightFactor(t);

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

    // Keep sun well elevated so shadows stay soft and never slice darkly across the road!
    const sunAngle = (t - 0.22) * Math.PI * 2;
    const sunY = Math.max(0.42, Math.sin(sunAngle) * 0.78 + 0.25);
    const sunX = Math.cos(sunAngle) * 0.72;
    const sunZ = -0.38;

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
    scene.environmentIntensity = THREE.MathUtils.lerp(0.82, 0.42, night);

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX * 42, Math.max(30, sunY * 56), sunZ * 36);
      dirLightRef.current.color.copy(tmpSun);
      dirLightRef.current.intensity = THREE.MathUtils.lerp(2.65, 1.25, night);
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(tmpHemiSky);
      hemiLightRef.current.groundColor.copy(tmpHemiGnd);
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(1.55, 1.05, night);
    }

    if (rimLightRef.current) {
      rimLightRef.current.intensity = THREE.MathUtils.lerp(0.85, 1.35, night);
    }
  });

  const shadowMapSize = quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512;

  return (
    <>
      <fog attach="fog" args={['#C8E6FA', 75, 185]} />

      {/* Stylized Shader Sky Dome with Drifting Clouds */}
      <mesh material={skyMaterial} scale={[165, 165, 165]}>
        <sphereGeometry args={[1, 28, 20]} />
      </mesh>

      {/* Main Key Sunlight with Expanded Shadow Frustum (no hard shadow edge on the street!) */}
      <directionalLight
        ref={dirLightRef}
        position={[26, 44, -18]}
        intensity={2.4}
        castShadow={quality !== 'low'}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={5}
        shadow-camera-far={145}
        shadow-camera-left={-56}
        shadow-camera-right={56}
        shadow-camera-top={56}
        shadow-camera-bottom={-56}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-radius={3}
      />

      {/* Rich Atmospheric Bounce Hemisphere */}
      <hemisphereLight ref={hemiLightRef} args={['#BCE8FF', '#46506B', 1.4]} />

      {/* Cool Cyan Graphic Rim Light */}
      <directionalLight
        ref={rimLightRef}
        position={[-28, 22, 34]}
        color="#38BDF8"
        intensity={0.9}
      />
    </>
  );
}
