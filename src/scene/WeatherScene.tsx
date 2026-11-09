import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { SceneParams } from './sceneParams';
import { WeatherEngine } from './WeatherEngine';

interface Props {
  params: SceneParams;
  /** pausa a animação (ex.: na aba do globo, que já tem o próprio 3D) */
  paused?: boolean;
}

/**
 * Fundo animado que mostra o tempo atual da cidade.
 * Camadas, de trás para a frente: céu (2D), sol/lua (3D), nuvens/colinas/chuva (2D), sombra (CSS).
 */
export function WeatherScene({ params, paused = false }: Props) {
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const astroRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<WeatherEngine | null>(null);
  const reduced = useReducedMotion();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const engine = new WeatherEngine(backRef.current!, frontRef.current!, paramsRef.current, reduced);
    engineRef.current = engine;
    if (pausedRef.current) engine.setPaused(true);
    else engine.start();

    // sol, lua e nuvens dos modelos 3D chegam depois da primeira pintura;
    // se o WebGL ou o download falhar, o cenário 2D continua no lugar
    let cancelled = false;
    let sky: { dispose: () => void; canvas: HTMLCanvasElement } | null = null;
    import('./Sky3D')
      .then(({ Sky3D }) => Sky3D.create())
      .then((created) => {
        if (cancelled) return created.dispose();
        sky = created;
        astroRef.current?.appendChild(created.canvas);
        engine.attachSky(created);
      })
      .catch((error) => console.warn('Cenário 3D indisponível, usando a versão 2D.', error));

    let resizeFrame = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => engine.resize());
    };
    const onPointer = (e: PointerEvent) => {
      engine.setPointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    };
    const onVisibility = () => {
      if (document.hidden) engine.stop();
      else if (!pausedRef.current) engine.start();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      engine.stop();
      sky?.canvas.remove();
      sky?.dispose();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <div className="scene" aria-hidden="true">
      <canvas ref={backRef} className="scene__layer" />
      <div ref={astroRef} className="scene__astro-layer" />
      <canvas ref={frontRef} className="scene__layer" />
      <div className="scene__shade" />
    </div>
  );
}
