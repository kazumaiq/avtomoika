import * as THREE from 'three';

const textureCache = new Map<string, THREE.Texture>();

function getOrCreate(key: string, builder: () => THREE.Texture): THREE.Texture {
  const existing = textureCache.get(key);
  if (existing) return existing;
  const tex = builder();
  textureCache.set(key, tex);
  return tex;
}

/**
 * Crisp 4-band comic gradient map for stylized Spider-Verse shading
 */
export function getToonGradientTexture(): THREE.DataTexture {
  return getOrCreate('toon-gradient', () => {
    const colors = new Uint8Array([
      70, 70, 70, 255,
      145, 145, 145, 255,
      210, 210, 210, 255,
      255, 255, 255, 255,
    ]);
    const tex = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }) as THREE.DataTexture;
}

/**
 * Urban asphalt road texture with halftone grain, double yellow center line, and white lane edges
 */
export function getRoadTexture(): THREE.CanvasTexture {
  return getOrCreate('road-asphalt', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#242936';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle painterly asphalt texture + comic Ben-Day halftone dots
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(8,10,16,0.14)';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 3, 3);
    }

    // Halftone bands along curb gutters
    ctx.fillStyle = 'rgba(11, 14, 24, 0.25)';
    for (let x = 0; x < 512; x += 12) {
      for (let y = 0; y < 56; y += 12) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, 512 - y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // White outer shoulder lines
    ctx.fillStyle = 'rgba(235, 242, 252, 0.72)';
    ctx.fillRect(0, 26, 512, 8);
    ctx.fillRect(0, 478, 512, 8);

    // Double yellow center line
    ctx.fillStyle = '#FFB800';
    ctx.fillRect(0, 244, 512, 8);
    ctx.fillRect(0, 260, 512, 8);

    // Subtle tire wear tracks
    ctx.fillStyle = 'rgba(14, 17, 25, 0.16)';
    ctx.fillRect(0, 105, 512, 28);
    ctx.fillRect(0, 175, 512, 28);
    ctx.fillRect(0, 310, 512, 28);
    ctx.fillRect(0, 380, 512, 28);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(8, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }) as THREE.CanvasTexture;
}

/**
 * Stylized concrete car wash lot with expansion joints & comic stipple
 */
export function getLotConcreteTexture(tint = '#384152'): THREE.CanvasTexture {
  return getOrCreate(`lot-concrete-${tint}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle concrete panels
    ctx.strokeStyle = 'rgba(15, 20, 30, 0.28)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Halftone grain
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(x, y, 2.5, 2.5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 5);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }) as THREE.CanvasTexture;
}

/**
 * Tiled wash bay floor with drainage grate & hazard safety border stripes
 */
export function getBayFloorTexture(accent = '#00D4FF'): THREE.CanvasTexture {
  return getOrCreate(`bay-floor-${accent}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2B3445';
    ctx.fillRect(0, 0, 512, 512);

    // Wet tile grid
    ctx.strokeStyle = 'rgba(160, 210, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Central steel drainage grate
    ctx.fillStyle = '#151922';
    ctx.fillRect(190, 96, 132, 320);
    ctx.fillStyle = '#4B5563';
    for (let y = 104; y < 410; y += 16) {
      ctx.fillRect(198, y, 116, 6);
    }

    // Safety yellow/black stripes along left & right edges
    ctx.save();
    for (const sideX of [0, 476]) {
      ctx.fillStyle = '#FFB800';
      ctx.fillRect(sideX, 0, 36, 512);
      ctx.fillStyle = '#151820';
      for (let y = -40; y < 560; y += 36) {
        ctx.beginPath();
        ctx.moveTo(sideX, y);
        ctx.lineTo(sideX + 36, y + 20);
        ctx.lineTo(sideX + 36, y + 36);
        ctx.lineTo(sideX, y + 16);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // Accent center lane arrows
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(58, 20, 8, 472);
    ctx.fillRect(446, 20, 8, 472);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }) as THREE.CanvasTexture;
}

/**
 * Stylized Spider-Verse graphic sign texture (AUTOMOIKA, TURBO SHINE, Billboards)
 */
export function getSignTexture(
  text: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  textHex = '#FFFFFF'
): THREE.CanvasTexture {
  const key = `sign-${text}-${subtitle}-${bgHex}-${accentHex}`;
  return getOrCreate(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Deep background
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 1024, 256);

    // Comic diagonal speed bars
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.22;
    for (let x = -100; x < 1100; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 256);
      ctx.lineTo(x + 34, 256);
      ctx.lineTo(x + 114, 0);
      ctx.lineTo(x + 80, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Halftone dot corner accent
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.35;
    for (let x = 24; x < 240; x += 16) {
      for (let y = 24; y < 232; y += 16) {
        const r = Math.max(1, 5 - x * 0.018);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Bold inner border
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 1000, 232);

    // Graphic comic shadow + title text
    ctx.font = '900 104px "Space Grotesk", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#090B12';
    ctx.fillText(text, 518, 114);
    ctx.fillStyle = accentHex;
    ctx.fillText(text, 514, 110);
    ctx.fillStyle = textHex;
    ctx.fillText(text, 510, 106);

    // Subtitle pill
    ctx.font = '700 32px "Inter", sans-serif';
    ctx.fillStyle = accentHex;
    ctx.fillText(subtitle, 512, 198);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }) as THREE.CanvasTexture;
}

/**
 * Stylized urban building facade texture with glowing warm/cyan comic windows
 */
export function getBuildingFacadeTexture(
  wallColor: string,
  windowGlow: string,
  seed = 1
): THREE.CanvasTexture {
  return getOrCreate(`facade-${wallColor}-${windowGlow}-${seed}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, 256, 512);

    // Subtle horizontal architectural bands + comic hatching
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < 512; y += 64) {
      ctx.fillRect(0, y, 256, 6);
    }

    // Window grid
    let s = seed * 97;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 4; col++) {
        const wx = 18 + col * 58;
        const wy = 24 + row * 66;
        const lit = rand() > 0.42;

        // Ink frame
        ctx.fillStyle = '#111520';
        ctx.fillRect(wx - 3, wy - 3, 42, 46);

        // Glass
        ctx.fillStyle = lit ? windowGlow : '#1D2536';
        ctx.fillRect(wx, wy, 36, 40);

        // Diagonal comic glass reflection
        ctx.fillStyle = lit ? 'rgba(255,255,255,0.32)' : 'rgba(130,190,255,0.14)';
        ctx.beginPath();
        ctx.moveTo(wx, wy + 18);
        ctx.lineTo(wx + 20, wy);
        ctx.lineTo(wx + 32, wy);
        ctx.lineTo(wx, wy + 30);
        ctx.closePath();
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }) as THREE.CanvasTexture;
}
