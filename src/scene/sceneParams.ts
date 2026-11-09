import { describeWeather, skyThemeFor } from '../lib/weather';
import type { SkyTheme } from '../types';

export interface ScenePalette {
  skyTop: string;
  skyBottom: string;
  hills: [string, string, string];
}

export interface SceneParams {
  palette: ScenePalette;
  isDay: boolean;
  /** 0 a 1: quanto do céu está coberto */
  clouds: number;
  /** 0 a 1: nuvens claras → nuvens carregadas */
  cloudDark: number;
  rain: number;
  snow: number;
  fog: number;
  storm: boolean;
  sun: boolean;
  stars: number;
  /** -1 (vento para a esquerda) a 1 (para a direita) */
  wind: number;
}

export const PALETTES: Record<SkyTheme, ScenePalette> = {
  'clear-day': { skyTop: '#1d6cc2', skyBottom: '#93cbf0', hills: ['#4b8a5c', '#356f47', '#245335'] },
  'cloudy-day': { skyTop: '#4a6178', skyBottom: '#9daebd', hills: ['#5b7565', '#465f51', '#33493d'] },
  'rain-day': { skyTop: '#3f5366', skyBottom: '#8d9fae', hills: ['#475d50', '#364a3f', '#273730'] },
  'snow-day': { skyTop: '#566f8a', skyBottom: '#a9bacb', hills: ['#d3dde7', '#bccad8', '#a5b6c8'] },
  'fog-day': { skyTop: '#66737e', skyBottom: '#a5afb6', hills: ['#97a3a3', '#848f90', '#717c7d'] },
  storm: { skyTop: '#161d27', skyBottom: '#47525f', hills: ['#2c3833', '#212b27', '#171f1c'] },
  'clear-night': { skyTop: '#040a1d', skyBottom: '#1e2c5a', hills: ['#18243d', '#111b30', '#0a1223'] },
  'cloudy-night': { skyTop: '#0e141d', skyBottom: '#2c3848', hills: ['#1f2832', '#171f28', '#10171e'] },
};

/** Traduz o tempo real em parâmetros do cenário. */
export function sceneParamsFor(
  code: number,
  isDay: boolean,
  windSpeed: number,
  windDirection: number,
): SceneParams {
  const { kind } = describeWeather(code);
  const theme = skyThemeFor(kind, isDay);

  // direção meteorológica = de onde o vento vem; vento do leste empurra para a esquerda
  const windX = -Math.sin((windDirection * Math.PI) / 180) * Math.min(1, windSpeed / 45);

  const base: SceneParams = {
    palette: PALETTES[theme],
    isDay,
    clouds: 0.1,
    cloudDark: 0,
    rain: 0,
    snow: 0,
    fog: 0,
    storm: false,
    sun: isDay,
    stars: isDay ? 0 : 1,
    wind: windX,
  };

  const heavy = [65, 67, 75, 82, 86].includes(code);
  const light = [51, 56, 61, 71, 80, 85].includes(code);
  const intensity = heavy ? 1 : light ? 0.45 : 0.7;

  switch (kind) {
    case 'clear':
      return { ...base, clouds: code === 1 ? 0.18 : 0.06 };
    case 'partly':
      return { ...base, clouds: 0.45, stars: isDay ? 0 : 0.6 };
    case 'cloudy':
      return { ...base, clouds: 0.95, cloudDark: 0.35, sun: false, stars: 0 };
    case 'fog':
      return { ...base, clouds: 0.5, cloudDark: 0.15, fog: 0.9, sun: false, stars: 0 };
    case 'drizzle':
      return { ...base, clouds: 0.9, cloudDark: 0.45, rain: 0.25, sun: false, stars: 0 };
    case 'rain':
      return { ...base, clouds: 1, cloudDark: 0.4 + intensity * 0.35, rain: intensity, sun: false, stars: 0 };
    case 'snow':
      return { ...base, clouds: 0.85, cloudDark: 0.15, snow: intensity, sun: false, stars: 0 };
    case 'storm':
      return { ...base, clouds: 1, cloudDark: 0.95, rain: 1, storm: true, sun: false, stars: 0 };
  }
}
