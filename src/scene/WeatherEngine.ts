import type { SceneParams } from './sceneParams';
// só tipos: o Three.js continua fora do pacote principal
import type { CloudSprite, Sky3D, SkyCloud } from './Sky3D';

type RGB = [number, number, number];

interface Cloud {
  x: number; // 0..1 da largura (pode sair da tela)
  y: number; // 0..1 da altura
  scale: number;
  speed: number;
  sprite: number;
  order: number; // 0..1, define em que cobertura a nuvem aparece
  depth: number;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  bucket: number; // faixa de opacidade (para desenhar em lote)
}

interface Flake {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

interface Bolt {
  points: Array<[number, number]>;
  branches: Array<Array<[number, number]>>;
  life: number;
}

/** Valores numéricos que fazem transição suave quando o tempo muda. */
interface Animated {
  clouds: number;
  cloudDark: number;
  rain: number;
  snow: number;
  fog: number;
  sun: number;
  stars: number;
  wind: number;
  storm: number;
  daylight: number;
}

const MAX_DROPS = 600;
const MAX_FLAKES = 240;
const CLOUD_COUNT = 16;
const RAIN_ALPHAS = [0.2, 0.32, 0.45];
const STAR_LEVELS = 4;
/** O sol e a lua 3D mudam devagar: redesenhar a ~15 quadros por segundo basta. */
const ASTRO_INTERVAL = 1 / 15;
/** Mesmo cálculo de Sky3D.canvasSize (raio + margem para a borda). */
const astroCanvasSize = (r: number) => Math.ceil(r * 2 * 1.08);

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: RGB, b: RGB, k: number): RGB => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

const css = ([r, g, b]: RGB, alpha = 1) => `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;

/** Gerador pseudoaleatório com semente, para colinas e nuvens estáveis. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * Motor do cenário. Desenha em duas camadas 2D:
 * - fundo: céu, estrelas e o brilho do sol e da lua;
 * - frente: nuvens, raios, neblina, colinas, chuva e neve.
 * Entre as duas fica o canvas pequeno do sol ou da lua em 3D (Sky3D), quando disponível.
 */
export class WeatherEngine {
  private back: CanvasRenderingContext2D;
  private front: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private raf = 0;
  private last = 0;
  private time = 0;
  private running = false;
  private paused = false;

  private params: SceneParams;
  private anim: Animated;
  private colors: { top: RGB; bottom: RGB; hills: [RGB, RGB, RGB] };
  private target: { top: RGB; bottom: RGB; hills: [RGB, RGB, RGB] };

  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private clouds: Cloud[] = [];
  private fallbackSprites: CloudSprite[] = [];
  private drops: Drop[] = [];
  private flakes: Flake[] = [];
  private stars: Star[] = [];
  private bolt: Bolt | null = null;
  private flash = 0;
  private nextStrike = 2;
  private hillSeeds = [11, 23, 37];
  private hillCache: { key: string; layers: HTMLCanvasElement[]; margin: number } | null = null;
  private raySprite: HTMLCanvasElement;

  private sky: Sky3D | null = null;
  private astroClock = 0;
  private astroKind: 'sun' | 'moon' | null = null;
  private astroStyle = '';

  constructor(
    private backCanvas: HTMLCanvasElement,
    private frontCanvas: HTMLCanvasElement,
    initial: SceneParams,
    private reducedMotion = false,
  ) {
    const back = backCanvas.getContext('2d', { alpha: false });
    const front = frontCanvas.getContext('2d');
    if (!back || !front) throw new Error('Canvas 2D indisponível');
    this.back = back;
    this.front = front;
    this.params = initial;
    this.anim = this.animatedFrom(initial);
    this.colors = this.colorsFrom(initial);
    this.target = this.colorsFrom(initial);

    this.fallbackSprites = this.buildFallbackSprites();
    this.raySprite = this.buildRaySprite();

    const rand = seeded(7);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      this.clouds.push({
        x: rand() * 1.4 - 0.2,
        y: 0.04 + rand() * 0.42,
        scale: 0.6 + rand() * 0.9,
        speed: 0.004 + rand() * 0.01,
        sprite: i,
        order: i / CLOUD_COUNT,
        depth: 0.3 + rand() * 0.7,
      });
    }
    this.clouds.sort((a, b) => a.depth - b.depth);

    for (let i = 0; i < MAX_DROPS; i++) this.drops.push(this.newDrop(true));
    for (let i = 0; i < MAX_FLAKES; i++) this.flakes.push(this.newFlake(true));
    const srand = seeded(99);
    for (let i = 0; i < 220; i++) {
      this.stars.push({
        x: srand(),
        y: srand() * 0.7,
        r: srand() * 1.3 + 0.3,
        phase: srand() * Math.PI * 2,
        speed: 0.6 + srand() * 1.8,
      });
    }

    this.resize();
  }

  private animatedFrom(p: SceneParams): Animated {
    return {
      clouds: p.clouds,
      cloudDark: p.cloudDark,
      rain: p.rain,
      snow: p.snow,
      fog: p.fog,
      sun: p.sun ? 1 : 0,
      stars: p.stars,
      wind: p.wind,
      storm: p.storm ? 1 : 0,
      daylight: p.isDay ? 1 : 0,
    };
  }

  private colorsFrom(p: SceneParams) {
    return {
      top: hexToRgb(p.palette.skyTop),
      bottom: hexToRgb(p.palette.skyBottom),
      hills: p.palette.hills.map(hexToRgb) as [RGB, RGB, RGB],
    };
  }

  // ---------- API ----------

  setParams(p: SceneParams) {
    this.params = p;
    this.target = this.colorsFrom(p);
    if (this.reducedMotion || this.paused) {
      this.anim = this.animatedFrom(p);
      this.colors = this.colorsFrom(p);
      this.render(0);
    }
  }

  /** Liga o sol, a lua e as nuvens dos modelos 3D. Até lá, o 2D desenha tudo. */
  attachSky(sky: Sky3D) {
    this.sky = sky;
    this.astroKind = null;
    if (!this.running) this.render(0);
  }

  setPointer(nx: number, ny: number) {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
  }

  /** Pausa a animação (por exemplo, na aba do globo) mantendo o último quadro. */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.stop();
      this.render(0);
    } else {
      this.start();
    }
  }

  resize() {
    const rect = this.frontCanvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    // o céu é um degradê suave: resolução 1x basta
    this.backCanvas.width = Math.round(this.width);
    this.backCanvas.height = Math.round(this.height);
    // chuva e colinas pedem um pouco mais de nitidez
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.frontCanvas.width = Math.round(this.width * dpr);
    this.frontCanvas.height = Math.round(this.height * dpr);
    this.front.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hillCache = null;
    this.astroKind = null;
    if (!this.running) this.render(0);
  }

  start() {
    if (this.reducedMotion || this.paused) {
      this.render(0);
      return;
    }
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.render(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  // ---------- Construção ----------

  /** Nuvens 2D simples, usadas só até os modelos 3D carregarem (ou se o WebGL falhar). */
  private buildFallbackSprites(): CloudSprite[] {
    const sprites: CloudSprite[] = [];
    const w = 512;
    const h = 303;
    for (let s = 0; s < 4; s++) {
      const rand = seeded(100 + s * 17);
      const count = 11 + Math.floor(rand() * 6);
      const puffs = Array.from({ length: count }, () => ({
        x: w * (0.25 + rand() * 0.5),
        y: h * (0.5 + (rand() - 0.5) * 0.3),
        r: 50 + rand() * 60,
      }));
      const make = (stops: [string, string, string]) => {
        const c = makeCanvas(w, h);
        const g = c.getContext('2d')!;
        for (const p of puffs) {
          const grad = g.createRadialGradient(p.x, p.y - p.r * 0.2, p.r * 0.1, p.x, p.y, p.r);
          grad.addColorStop(0, stops[0]);
          grad.addColorStop(0.6, stops[1]);
          grad.addColorStop(1, stops[2]);
          g.fillStyle = grad;
          g.beginPath();
          g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          g.fill();
        }
        return c;
      };
      sprites.push({
        light: make(['rgba(255,255,255,0.95)', 'rgba(236,242,248,0.7)', 'rgba(220,230,240,0)']),
        dark: make(['rgba(96,104,118,0.95)', 'rgba(62,70,84,0.75)', 'rgba(40,46,58,0)']),
        night: make(['rgba(80,90,110,0.9)', 'rgba(55,64,80,0.7)', 'rgba(40,46,58,0)']),
      });
    }
    return sprites;
  }

  /** Leque de raios de sol pré-desenhado; no quadro só é girado e esticado. */
  private buildRaySprite() {
    const size = 512;
    const c = makeCanvas(size, size);
    const g = c.getContext('2d')!;
    g.translate(size / 2, size / 2);
    const len = size / 2;
    for (let i = 0; i < 9; i++) {
      g.rotate((Math.PI * 2) / 9);
      const grad = g.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, 'rgba(255,240,200,0.1)');
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(len, -len * 0.05);
      g.lineTo(len, len * 0.05);
      g.closePath();
      g.fill();
    }
    return c;
  }

  private newDrop(anywhere: boolean): Drop {
    return {
      x: Math.random() * 1.3 - 0.15,
      y: anywhere ? Math.random() : -Math.random() * 0.2,
      len: 14 + Math.random() * 16,
      speed: 0.9 + Math.random() * 0.5,
      bucket: Math.floor(Math.random() * RAIN_ALPHAS.length),
    };
  }

  private newFlake(anywhere: boolean): Flake {
    return {
      x: Math.random() * 1.2 - 0.1,
      y: anywhere ? Math.random() : -0.05,
      r: 1 + Math.random() * 2.4,
      speed: 0.04 + Math.random() * 0.07,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private makeBolt(): Bolt {
    const w = this.width;
    const h = this.height;
    let x = w * (0.2 + Math.random() * 0.6);
    let y = h * 0.12;
    const end = h * (0.62 + Math.random() * 0.12);
    const points: Array<[number, number]> = [[x, y]];
    const branches: Array<Array<[number, number]>> = [];
    while (y < end) {
      y += 14 + Math.random() * 26;
      x += (Math.random() - 0.5) * 42;
      points.push([x, y]);
      if (Math.random() < 0.18) {
        const branch: Array<[number, number]> = [[x, y]];
        let bx = x;
        let by = y;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let i = 0; i < 4; i++) {
          bx += dir * (10 + Math.random() * 22);
          by += 12 + Math.random() * 18;
          branch.push([bx, by]);
        }
        branches.push(branch);
      }
    }
    return { points, branches, life: 1 };
  }

  // ---------- Quadro ----------

  private render(dt: number) {
    const w = this.width;
    const h = this.height;
    const p = this.params;
    this.time += dt;

    // transições suaves
    const k = this.reducedMotion || this.paused ? 1 : 1 - Math.pow(0.02, dt);
    const a = this.anim;
    a.clouds += (p.clouds - a.clouds) * k;
    a.cloudDark += (p.cloudDark - a.cloudDark) * k;
    a.rain += (p.rain - a.rain) * k;
    a.snow += (p.snow - a.snow) * k;
    a.fog += (p.fog - a.fog) * k;
    a.sun += ((p.sun ? 1 : 0) - a.sun) * k;
    a.stars += (p.stars - a.stars) * k;
    a.wind += (p.wind - a.wind) * k;
    a.storm += ((p.storm ? 1 : 0) - a.storm) * k;
    a.daylight += ((p.isDay ? 1 : 0) - a.daylight) * k;
    this.colors.top = mix(this.colors.top, this.target.top, k);
    this.colors.bottom = mix(this.colors.bottom, this.target.bottom, k);
    this.colors.hills = this.colors.hills.map((c, i) => mix(c, this.target.hills[i], k)) as [RGB, RGB, RGB];

    this.pointer.x += (this.pointer.tx - this.pointer.x) * Math.min(1, dt * 3);
    this.pointer.y += (this.pointer.ty - this.pointer.y) * Math.min(1, dt * 3);

    const astroX = w * (w > 900 ? 0.6 : 0.78) - this.pointer.x * 12;
    const astroY = h * 0.24 - this.pointer.y * 8;
    const sunAlpha = a.sun * (1 - a.clouds * 0.6);
    const moonAlpha = p.isDay ? 0 : a.stars * (1 - a.clouds * 0.7);

    // ===== camada de fundo =====
    const back = this.back;
    const sky = back.createLinearGradient(0, 0, 0, h * 0.8);
    sky.addColorStop(0, css(this.colors.top));
    sky.addColorStop(1, css(this.colors.bottom));
    back.fillStyle = sky;
    back.fillRect(0, 0, w, h);
    if (a.stars > 0.01) this.drawStars(a.stars * (1 - a.clouds * 0.8));
    if (sunAlpha > 0.01) this.drawSunGlow(astroX, astroY, sunAlpha, !this.sky);
    if (moonAlpha > 0.01) this.drawMoonGlow(astroX, astroY, moonAlpha, !this.sky);

    // ===== sol ou lua em 3D (canvas pequeno entre as camadas) =====
    if (this.sky) this.updateAstro(dt, astroX, astroY, sunAlpha, moonAlpha);

    // ===== camada da frente =====
    const front = this.front;
    front.clearRect(0, 0, w, h);

    this.stepClouds(dt, a.wind);
    this.drawClouds(this.cloudLayout(a.clouds), a.cloudDark, a.daylight);

    if (a.storm > 0.5 && !this.reducedMotion && !this.paused) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.bolt = this.makeBolt();
        this.flash = 1;
        this.nextStrike = 2.5 + Math.random() * 5;
      }
    }
    if (this.bolt) this.drawBolt(dt);
    if (a.fog > 0.01) this.drawFog(a.fog, 0.5);
    this.drawHills();
    if (a.fog > 0.01) this.drawFog(a.fog, 0.8);
    if (a.rain > 0.01) this.drawRain(dt, a.rain, a.wind);
    if (a.snow > 0.01) this.drawSnow(dt, a.snow, a.wind);

    if (this.flash > 0) {
      front.fillStyle = `rgba(220,230,255,${this.flash * 0.35})`;
      front.fillRect(0, 0, w, h);
      this.flash = Math.max(0, this.flash - dt * 4);
    }
  }

  private updateAstro(dt: number, x: number, y: number, sunAlpha: number, moonAlpha: number) {
    const sky = this.sky!;
    const kind = sunAlpha > 0.01 ? 'sun' : moonAlpha > 0.01 ? 'moon' : null;
    const alpha = kind === 'sun' ? Math.min(1, sunAlpha * 1.5) : moonAlpha;
    const r = Math.min(this.width, this.height) * (kind === 'sun' ? 0.075 : 0.055);
    const size = astroCanvasSize(r);

    this.astroClock += dt;
    if (kind && (kind !== this.astroKind || dt === 0 || this.astroClock >= ASTRO_INTERVAL)) {
      sky.renderAstro(kind, r, this.astroClock);
      this.astroClock = 0;
      this.astroKind = kind;
    }

    // só a posição e a opacidade mudam por CSS (barato para o navegador)
    const style = kind
      ? `translate3d(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px, 0)|${alpha.toFixed(2)}|${size}`
      : 'hidden';
    if (style !== this.astroStyle) {
      this.astroStyle = style;
      const el = sky.canvas;
      if (!kind) {
        el.style.opacity = '0';
      } else {
        const [transform, opacity] = style.split('|');
        el.style.transform = transform;
        el.style.opacity = opacity;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
      }
    }
  }

  private drawStars(alpha: number) {
    const { back: ctx, width: w, height: h } = this;
    // agrupa as estrelas por faixa de brilho para desenhar tudo em poucas chamadas
    const paths = Array.from({ length: STAR_LEVELS }, () => new Path2D());
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(this.time * s.speed + s.phase);
      const level = Math.min(STAR_LEVELS - 1, Math.floor(tw * STAR_LEVELS));
      const x = s.x * w - this.pointer.x * 4;
      const y = s.y * h - this.pointer.y * 3;
      paths[level].moveTo(x + s.r, y);
      paths[level].arc(x, y, s.r, 0, Math.PI * 2);
    }
    paths.forEach((path, i) => {
      ctx.fillStyle = `rgba(255,255,255,${alpha * ((i + 1) / STAR_LEVELS) * 0.9})`;
      ctx.fill(path);
    });
  }

  private drawSunGlow(x: number, y: number, alpha: number, withCore: boolean) {
    const { back: ctx, width: w, height: h } = this;
    const r = Math.min(w, h) * 0.06;
    const len = Math.max(w, h) * 0.9;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(this.time * 0.02);
    ctx.drawImage(this.raySprite, -len, -len, len * 2, len * 2);
    ctx.restore();

    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    glow.addColorStop(0, `rgba(255,246,214,${0.75 * alpha})`);
    glow.addColorStop(0.15, `rgba(255,228,160,${0.45 * alpha})`);
    glow.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);

    if (!withCore) return;
    ctx.fillStyle = `rgba(255,252,238,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMoonGlow(x: number, y: number, alpha: number, withDisc: boolean) {
    const { back: ctx, width: w, height: h } = this;
    const r = Math.min(w, h) * 0.045;
    const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 6);
    glow.addColorStop(0, `rgba(200,215,255,${0.28 * alpha})`);
    glow.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    if (!withDisc) return;

    const disc = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    disc.addColorStop(0, `rgba(250,250,240,${alpha})`);
    disc.addColorStop(1, `rgba(210,215,225,${alpha})`);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private stepClouds(dt: number, wind: number) {
    const drift = 0.35 + wind * 0.65;
    for (const c of this.clouds) {
      c.x += c.speed * dt * (drift >= 0 ? 1 : -1) * (0.4 + Math.abs(drift));
      if (c.x > 1.3) c.x = -0.45;
      if (c.x < -0.45) c.x = 1.3;
    }
  }

  /** Posição e tamanho de cada nuvem em px, com as nuvens entrando aos poucos conforme a cobertura. */
  private cloudLayout(cover: number): SkyCloud[] {
    const { width: w, height: h } = this;
    // céu encoberto: nuvens maiores para fechar o céu
    const size = (w / 1400 + 0.5) * (1 + Math.max(0, cover - 0.6) * 0.9);
    return this.clouds.map((c, i) => {
      const visible = Math.min(1, Math.max(0, (cover - c.order) * 4 + (cover > 0.9 ? 1 : 0)));
      return {
        x: c.x * w - this.pointer.x * 30 * c.depth,
        y: c.y * h * (cover > 0.8 ? 0.75 : 1) - this.pointer.y * 14 * c.depth,
        w: 520 * c.scale * size * 0.3,
        h: 220 * c.scale * size * 0.42,
        alpha: visible * (0.55 + c.depth * 0.45),
        seed: i,
        depth: c.depth,
      };
    });
  }

  private drawClouds(clouds: SkyCloud[], dark: number, daylight: number) {
    const ctx = this.front;
    const sprites = this.sky?.cloudSprites ?? this.fallbackSprites;
    // mistura de tons: claro de dia, carregado na tempestade, apagado à noite
    const tones: Array<['light' | 'dark' | 'night', number]> = [
      ['light', daylight * (1 - dark)],
      ['dark', daylight * dark],
      ['night', 1 - daylight],
    ];
    clouds.forEach((c, i) => {
      if (c.alpha <= 0.01) return;
      const sprite = sprites[this.clouds[i].sprite % sprites.length];
      for (const [tone, weight] of tones) {
        if (weight <= 0.01) continue;
        ctx.globalAlpha = c.alpha * weight;
        ctx.drawImage(sprite[tone], c.x - c.w, c.y - c.h, c.w * 2, c.h * 2);
      }
    });
    ctx.globalAlpha = 1;
  }

  private drawBolt(dt: number) {
    const ctx = this.front;
    const bolt = this.bolt!;
    const stroke = (pts: Array<[number, number]>, width: number) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineWidth = width;
      ctx.stroke();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(180,200,255,0.9)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = `rgba(225,235,255,${bolt.life})`;
    stroke(bolt.points, 2.4);
    for (const b of bolt.branches) stroke(b, 1.2);
    ctx.restore();
    bolt.life -= dt * 3.2;
    if (bolt.life <= 0) this.bolt = null;
  }

  /** As colinas só são redesenhadas quando as cores mudam; no resto do tempo, só deslizam. */
  private drawHills() {
    const { front: ctx, width: w, height: h } = this;
    const layers = [
      { base: 0.7, amp: 0.05, freq: 1.6, depth: 10 },
      { base: 0.78, amp: 0.045, freq: 2.3, depth: 22 },
      { base: 0.87, amp: 0.035, freq: 3.1, depth: 40 },
    ];
    const key = [...this.colors.hills.flat(), ...this.colors.bottom].map((v) => Math.round(v)).join(',');
    if (!this.hillCache || this.hillCache.key !== key) {
      const margin = 60;
      const canvases = layers.map((layer, i) => {
        const color = this.colors.hills[i];
        const top = h * (layer.base - layer.amp * 1.4);
        const c = makeCanvas(w + margin * 2, h - top + margin);
        const g = c.getContext('2d')!;
        g.beginPath();
        g.moveTo(0, c.height);
        for (let x = 0; x <= c.width; x += 12) {
          const t = (x - margin) / w;
          const y =
            h * layer.base -
            top +
            Math.sin(t * Math.PI * layer.freq + this.hillSeeds[i]) * h * layer.amp +
            Math.sin(t * Math.PI * layer.freq * 2.7 + this.hillSeeds[i] * 2) * h * layer.amp * 0.35;
          g.lineTo(x, y);
        }
        g.lineTo(c.width, c.height);
        g.closePath();
        const grad = g.createLinearGradient(0, 0, 0, c.height);
        grad.addColorStop(0, css(mix(color, this.colors.bottom, 0.25)));
        grad.addColorStop(1, css(mix(color, [0, 0, 0], 0.35)));
        g.fillStyle = grad;
        g.fill();
        return c;
      });
      this.hillCache = { key, layers: canvases, margin };
    }
    const { layers: canvases, margin } = this.hillCache;
    layers.forEach((layer, i) => {
      const top = h * (layer.base - layer.amp * 1.4);
      ctx.drawImage(
        canvases[i],
        -margin + this.pointer.x * layer.depth,
        top - this.pointer.y * layer.depth * 0.3,
      );
    });
  }

  private drawFog(amount: number, band: number) {
    const { front: ctx, width: w, height: h } = this;
    for (let i = 0; i < 3; i++) {
      const y = h * (band - 0.08 + i * 0.06);
      const shift = Math.sin(this.time * 0.08 + i * 2) * w * 0.08;
      const grad = ctx.createLinearGradient(0, y - h * 0.12, 0, y + h * 0.12);
      grad.addColorStop(0, 'rgba(230,234,238,0)');
      grad.addColorStop(0.5, `rgba(230,234,238,${0.32 * amount})`);
      grad.addColorStop(1, 'rgba(230,234,238,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-w * 0.1 + shift, y - h * 0.12, w * 1.2, h * 0.24);
    }
  }

  private drawRain(dt: number, amount: number, wind: number) {
    const { front: ctx, width: w, height: h } = this;
    const count = Math.floor(MAX_DROPS * amount);
    const slant = wind * 0.45 + 0.08;
    // uma única chamada de desenho por faixa de opacidade
    const paths = RAIN_ALPHAS.map(() => new Path2D());
    for (let i = 0; i < count; i++) {
      const d = this.drops[i];
      d.y += d.speed * dt * 1.4;
      d.x += d.speed * dt * 1.4 * slant * (h / w);
      if (d.y > 1.05) Object.assign(d, this.newDrop(false));
      const x = d.x * w;
      const y = d.y * h;
      paths[d.bucket].moveTo(x, y);
      paths[d.bucket].lineTo(x - slant * d.len, y - d.len);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.1;
    paths.forEach((path, i) => {
      ctx.strokeStyle = `rgba(210,225,240,${RAIN_ALPHAS[i]})`;
      ctx.stroke(path);
    });
  }

  private drawSnow(dt: number, amount: number, wind: number) {
    const { front: ctx, width: w, height: h } = this;
    const count = Math.floor(MAX_FLAKES * amount);
    const path = new Path2D();
    for (let i = 0; i < count; i++) {
      const f = this.flakes[i];
      f.y += f.speed * dt;
      f.x += (Math.sin(this.time + f.phase) * 0.01 + wind * 0.03) * dt;
      if (f.y > 1.02) Object.assign(f, this.newFlake(false));
      const x = f.x * w;
      const y = f.y * h;
      path.moveTo(x + f.r, y);
      path.arc(x, y, f.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill(path);
  }
}
