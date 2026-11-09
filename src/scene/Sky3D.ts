import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Uma nuvem a desenhar, em pixels da tela (meia-largura e meia-altura). */
export interface SkyCloud {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  seed: number;
  depth: number;
}

/** Imagens da nuvem 3D já renderizadas, em três tons. */
export interface CloudSprite {
  light: HTMLCanvasElement;
  dark: HTMLCanvasElement;
  night: HTMLCanvasElement;
}

const MODELS = {
  sun: '/models/sun.glb',
  moon: '/models/moon.glb',
  cloud: '/models/cloud.glb',
};

/** Proporção largura/altura das nuvens. */
const CLOUD_ASPECT = 1.69;
const CLOUD_ANGLES = 4;
/** Margem do canvas do astro em relação ao raio (espaço para a borda). */
const ASTRO_PAD = 1.08;

/** Centraliza o modelo e o reduz para caber numa esfera de raio 1. */
function normalize(object: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2 || 1;
  object.position.sub(center);
  const inner = new THREE.Group();
  inner.add(object);
  inner.scale.setScalar(1 / radius);
  const outer = new THREE.Group();
  outer.add(inner);
  return outer;
}

/**
 * Material do sol: emite luz própria, com o centro claro e a borda alaranjada
 * e mais escura (como o sol real). Cada face do modelo ganha um brilho
 * levemente diferente, e a animação de morph faz essa granulação ferver.
 */
function createSunMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      #include <common>
      #include <morphtarget_pars_vertex>
      varying vec3 vRadial;
      varying vec3 vFacet;
      void main() {
        #include <beginnormal_vertex>
        #include <morphinstance_vertex>
        #include <morphnormal_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        // direção radial da esfera em espaço de visão (base do escurecimento da borda)
        vRadial = normalize(normalMatrix * normalize(transformed));
        vFacet = objectNormal;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vRadial;
      varying vec3 vFacet;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main() {
        // câmera ortográfica: a direção de visão é sempre o eixo Z
        float facing = clamp(normalize(vRadial).z, 0.0, 1.0);
        vec3 edge = vec3(0.88, 0.27, 0.03);
        vec3 mid = vec3(1.0, 0.56, 0.1);
        vec3 core = vec3(1.0, 0.86, 0.45);
        vec3 color = mix(edge, mid, smoothstep(0.0, 0.45, facing));
        color = mix(color, core, smoothstep(0.5, 1.0, facing));
        float grain = hash(floor(vFacet * 40.0));
        color *= 0.94 + 0.09 * grain;
        // cores já escritas em sRGB: sem conversão, para não desbotar
        gl_FragColor = vec4(color, 1.0);
      }`,
  });
}

/**
 * Parte 3D do céu.
 * - Sol e lua: modelos GLB renderizados ao vivo num canvas pequeno, só do tamanho do astro.
 * - Nuvens: o modelo volumétrico é renderizado uma única vez, em alguns ângulos e tons,
 *   e vira imagem. Assim o visual é o do modelo, mas o custo por quadro é o de uma imagem.
 */
export class Sky3D {
  readonly canvas: HTMLCanvasElement;
  readonly cloudSprites: CloudSprite[];
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-ASTRO_PAD, ASTRO_PAD, ASTRO_PAD, -ASTRO_PAD, 0.1, 10);
  private mixer: THREE.AnimationMixer | null;
  private sun: THREE.Group;
  private moon: THREE.Group;
  private size = 0;
  private time = 0;

  private constructor(
    sun: THREE.Group,
    sunClip: THREE.AnimationClip | undefined,
    moon: THREE.Group,
    cloud: THREE.Object3D,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'scene__astro';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera.position.set(0, 0, 5);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-0.9, 0.6, 1);
    this.scene.add(key);

    this.sun = sun;
    sun.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.material = createSunMaterial();
    });
    this.mixer = sunClip ? new THREE.AnimationMixer(sun) : null;
    this.mixer?.clipAction(sunClip!).play();
    this.scene.add(sun);

    this.moon = moon;
    moon.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.roughness = 0.95;
      material.metalness = 0;
      material.side = THREE.FrontSide;
    });
    this.scene.add(moon);

    this.cloudSprites = this.bakeClouds(cloud);
  }

  static async create(): Promise<Sky3D> {
    const loader = new GLTFLoader();
    const [sun, moon, cloud] = await Promise.all([
      loader.loadAsync(MODELS.sun),
      loader.loadAsync(MODELS.moon),
      loader.loadAsync(MODELS.cloud),
    ]);
    return new Sky3D(normalize(sun.scene), sun.animations[0], normalize(moon.scene), cloud.scene);
  }

  /** Renderiza a nuvem 3D em alguns ângulos e três tons e guarda como imagens. */
  private bakeClouds(source: THREE.Object3D): CloudSprite[] {
    const width = 512;
    const height = Math.round(width / CLOUD_ASPECT);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-CLOUD_ASPECT, CLOUD_ASPECT, 1, -1, 0.1, 10);
    camera.position.set(0, 0, 5);

    const materials: THREE.MeshStandardMaterial[] = [];
    const clone = source.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = (mesh.material as THREE.MeshStandardMaterial).clone();
      material.depthWrite = false;
      material.color.set(0x000000);
      material.opacity *= 1.5;
      mesh.material = material;
      materials.push(material);
    });
    const cloud = normalize(clone);
    cloud.scale.set(CLOUD_ASPECT * 0.95, 0.95, CLOUD_ASPECT * 0.95);
    scene.add(cloud);

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);

    const tones = {
      light: new THREE.Color(1, 1, 1),
      dark: new THREE.Color(0.36, 0.39, 0.45),
      night: new THREE.Color(0.3, 0.34, 0.43),
    };
    const sprites: CloudSprite[] = [];
    for (let i = 0; i < CLOUD_ANGLES; i++) {
      cloud.rotation.set(0.25 + (i % 3) * 0.1, i * 1.35, 0);
      const bake = (tone: THREE.Color) => {
        for (const m of materials) m.emissive.copy(tone);
        this.renderer.render(scene, camera);
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        // copia logo depois de renderizar, enquanto o buffer ainda está preenchido
        out.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
        return out;
      };
      sprites.push({ light: bake(tones.light), dark: bake(tones.dark), night: bake(tones.night) });
    }

    materials.forEach((m) => m.dispose());
    this.renderer.setSize(1, 1, false);
    return sprites;
  }

  /** Lado do canvas do astro em px de tela para um raio `r`. */
  static canvasSize(r: number) {
    return Math.ceil(r * 2 * ASTRO_PAD);
  }

  /** Desenha o sol ou a lua no canvas pequeno. */
  renderAstro(kind: 'sun' | 'moon', radius: number, dt: number) {
    const size = Sky3D.canvasSize(radius);
    if (size !== this.size) {
      this.size = size;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(size, size, false);
    }
    this.time += dt;
    this.sun.visible = kind === 'sun';
    this.moon.visible = kind === 'moon';
    if (kind === 'sun') {
      this.mixer?.update(dt);
      this.sun.rotation.y = this.time * 0.05;
    } else {
      this.moon.rotation.y = 1.2 + this.time * 0.01;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
