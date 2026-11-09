import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { gsap } from '../lib/gsap';
import { convertTemp } from '../lib/format';
import { describeWeather, temperatureColor } from '../lib/weather';
import type { CityNow, Unit } from '../types';
import { latLonToVec } from './geo';

const EARTH_URL = '/models/earth.glb';

interface Props {
  cities: CityNow[];
  selectedId: number | null;
  onSelect: (item: CityNow) => void;
  unit: Unit;
  reducedMotion: boolean;
  autoRotate: boolean;
}

const CAMERA_DISTANCE = 3.5;

/**
 * Planeta 3D (earth.glb). O modelo vem com raio 100, então é reduzido para raio 1,
 * o mesmo usado pelos marcadores. A orientação da textura já bate com latLonToVec.
 */
function Earth() {
  const { scene } = useGLTF(EARTH_URL);
  const earth = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.side = THREE.FrontSide;
      material.roughness = 0.9;
      material.metalness = 0;
      if (material.map) material.map.anisotropy = 8;
    });
    return clone;
  }, [scene]);
  return <primitive object={earth} scale={0.01} />;
}

useGLTF.preload(EARTH_URL);

/** Brilho da atmosfera em volta do globo (efeito Fresnel). */
function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: { color: { value: new THREE.Color('#4aa8ff') } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 color;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
            gl_FragColor = vec4(color, 1.0) * intensity * 0.95;
          }`,
      }),
    [],
  );
  return (
    <mesh scale={1.18} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

function Marker({
  item,
  selected,
  onSelect,
}: {
  item: CityNow;
  selected: boolean;
  onSelect: (item: CityNow) => void;
}) {
  const position = useMemo(
    () => new THREE.Vector3(...latLonToVec(item.city.latitude, item.city.longitude, 1.012)),
    [item.city.latitude, item.city.longitude],
  );
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { kind } = describeWeather(item.code);
  const wet = kind === 'rain' || kind === 'storm' || kind === 'drizzle' || kind === 'snow';
  const color = temperatureColor(item.temperature);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
    return q;
  }, [position]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = (clock.elapsedTime * 0.7) % 1;
      ringRef.current.scale.setScalar(1 + t * 2.2);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8;
    }
  });

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item);
        }}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
        <circleGeometry args={[selected || hovered ? 0.028 : 0.019, 24]} />
        <meshBasicMaterial color={selected ? '#ffffff' : color} />
      </mesh>
      {wet && (
        <mesh ref={ringRef}>
          <ringGeometry args={[0.024, 0.03, 32]} />
          <meshBasicMaterial color={kind === 'storm' ? '#FFD24A' : '#6EC1FF'} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** Posiciona os rótulos HTML sobre os marcadores e esconde os que estão atrás do globo. */
function LabelProjector({
  cities,
  labels,
}: {
  cities: CityNow[];
  labels: RefObject<Map<number, HTMLButtonElement>>;
}) {
  const { camera, size } = useThree();
  const points = useMemo(
    () => cities.map((c) => ({ id: c.city.id, v: new THREE.Vector3(...latLonToVec(c.city.latitude, c.city.longitude, 1.012)) })),
    [cities],
  );
  const projected = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    camDir.copy(camera.position).normalize();
    for (const { id, v } of points) {
      const el = labels.current?.get(id);
      if (!el) continue;
      const facing = v.clone().normalize().dot(camDir);
      projected.copy(v).project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      const visible = facing > 0.3;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -140%)`;
      el.style.opacity = visible ? String(Math.min(1, (facing - 0.3) * 4)) : '0';
      el.style.pointerEvents = visible ? 'auto' : 'none';
      el.style.zIndex = String(Math.round(facing * 100) + (el.dataset.selected === 'true' ? 200 : 0));
    }
  });
  return null;
}

/** Gira a câmera até a cidade escolhida. */
function CameraRig({
  target,
  controlsRef,
  reducedMotion,
}: {
  target: CityNow | undefined;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  useEffect(() => {
    if (!target) return;
    const end = new THREE.Vector3(...latLonToVec(target.city.latitude, target.city.longitude, CAMERA_DISTANCE));
    if (reducedMotion) {
      camera.position.copy(end);
      controlsRef.current?.update();
      return;
    }
    const start = camera.position.clone();
    const state = { t: 0 };
    const startDir = start.clone().normalize();
    const endDir = end.clone().normalize();
    const startLen = start.length();
    const tween = gsap.to(state, {
      t: 1,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => {
        // interpola na superfície da esfera para não atravessar o globo
        const q = new THREE.Quaternion().setFromUnitVectors(startDir, endDir);
        const step = new THREE.Quaternion().slerp(q, state.t);
        const dir = startDir.clone().applyQuaternion(step);
        camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(startLen, CAMERA_DISTANCE, state.t)));
        camera.lookAt(0, 0, 0);
        controlsRef.current?.update();
      },
    });
    return () => {
      tween.kill();
    };
  }, [target?.city.id, camera, controlsRef, reducedMotion]);
  return null;
}

export default function GlobeCanvas({ cities, selectedId, onSelect, unit, reducedMotion, autoRotate }: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const labels = useRef(new Map<number, HTMLButtonElement>());
  const [interacting, setInteracting] = useState(false);
  const selected = cities.find((c) => c.city.id === selectedId);
  const { active, progress } = useProgress();

  return (
    <div className="globe">
      {active && <p className="globe__progress">Carregando o planeta… {Math.round(progress)}%</p>}
      <Canvas
        camera={{ position: [0, 0.6, CAMERA_DISTANCE], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <hemisphereLight args={['#dbe9ff', '#0b1730', 0.9]} />
        <directionalLight position={[4, 2, 5]} intensity={2.2} />
        <Suspense fallback={null}>
          <Earth />
        </Suspense>
        <Atmosphere />
        {cities.map((item) => (
          <Marker key={item.city.id} item={item} selected={item.city.id === selectedId} onSelect={onSelect} />
        ))}
        <LabelProjector cities={cities} labels={labels} />
        <CameraRig target={selected} controlsRef={controlsRef} reducedMotion={reducedMotion} />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={2}
          maxDistance={5}
          rotateSpeed={0.5}
          zoomSpeed={0.6}
          autoRotate={autoRotate && !interacting && !reducedMotion}
          autoRotateSpeed={0.35}
          onStart={() => setInteracting(true)}
        />
      </Canvas>

      <div className="globe__labels">
        {cities.map((item) => {
          const isSelected = item.city.id === selectedId;
          return (
            <button
              key={item.city.id}
              ref={(el) => {
                if (el) labels.current.set(item.city.id, el);
                else labels.current.delete(item.city.id);
              }}
              type="button"
              className="globe-label"
              data-selected={isSelected}
              style={{ opacity: 0 }}
              onClick={() => onSelect(item)}
              aria-label={`${item.city.name}: ${convertTemp(item.temperature, unit)} graus`}
            >
              {isSelected && <span className="globe-label__name">{item.city.name}</span>}
              {convertTemp(item.temperature, unit)}°
            </button>
          );
        })}
      </div>
    </div>
  );
}
