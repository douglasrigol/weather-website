import type { SkyTheme, WeatherKind } from '../types';

interface WeatherInfo {
  label: string;
  kind: WeatherKind;
}

// Códigos WMO usados pela Open-Meteo
// https://open-meteo.com/en/docs#weathervariables
const CODES: Record<number, WeatherInfo> = {
  0: { label: 'Céu limpo', kind: 'clear' },
  1: { label: 'Predomínio de sol', kind: 'clear' },
  2: { label: 'Parcialmente nublado', kind: 'partly' },
  3: { label: 'Nublado', kind: 'cloudy' },
  45: { label: 'Neblina', kind: 'fog' },
  48: { label: 'Neblina com geada', kind: 'fog' },
  51: { label: 'Garoa fraca', kind: 'drizzle' },
  53: { label: 'Garoa', kind: 'drizzle' },
  55: { label: 'Garoa forte', kind: 'drizzle' },
  56: { label: 'Garoa congelante', kind: 'drizzle' },
  57: { label: 'Garoa congelante forte', kind: 'drizzle' },
  61: { label: 'Chuva fraca', kind: 'rain' },
  63: { label: 'Chuva', kind: 'rain' },
  65: { label: 'Chuva forte', kind: 'rain' },
  66: { label: 'Chuva congelante', kind: 'rain' },
  67: { label: 'Chuva congelante forte', kind: 'rain' },
  71: { label: 'Neve fraca', kind: 'snow' },
  73: { label: 'Neve', kind: 'snow' },
  75: { label: 'Neve forte', kind: 'snow' },
  77: { label: 'Grãos de neve', kind: 'snow' },
  80: { label: 'Pancadas de chuva', kind: 'rain' },
  81: { label: 'Pancadas de chuva fortes', kind: 'rain' },
  82: { label: 'Pancadas de chuva violentas', kind: 'rain' },
  85: { label: 'Pancadas de neve', kind: 'snow' },
  86: { label: 'Pancadas de neve fortes', kind: 'snow' },
  95: { label: 'Trovoadas', kind: 'storm' },
  96: { label: 'Trovoadas com granizo', kind: 'storm' },
  99: { label: 'Trovoadas com granizo forte', kind: 'storm' },
};

export function describeWeather(code: number): WeatherInfo {
  return CODES[code] ?? { label: 'Condição desconhecida', kind: 'cloudy' };
}

export function skyThemeFor(kind: WeatherKind, isDay: boolean): SkyTheme {
  if (kind === 'storm') return 'storm';
  if (!isDay) return kind === 'clear' ? 'clear-night' : 'cloudy-night';
  switch (kind) {
    case 'clear':
      return 'clear-day';
    case 'partly':
    case 'cloudy':
      return 'cloudy-day';
    case 'drizzle':
    case 'rain':
      return 'rain-day';
    case 'snow':
      return 'snow-day';
    case 'fog':
      return 'fog-day';
  }
}

/** Cor de uma temperatura (°C) numa escala fria → quente, usada nas barras da semana. */
export function temperatureColor(celsius: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [-5, [120, 160, 255]],
    [8, [110, 200, 235]],
    [18, [150, 215, 140]],
    [26, [250, 200, 70]],
    [34, [245, 120, 60]],
    [42, [220, 60, 70]],
  ];
  if (celsius <= stops[0][0]) return rgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (celsius <= t1) {
      const k = (celsius - t0) / (t1 - t0);
      return rgb([0, 1, 2].map((j) => c0[j] + (c1[j] - c0[j]) * k) as [number, number, number]);
    }
  }
  return rgb(stops[stops.length - 1][1]);
}

function rgb([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Peso e largura da fonte da temperatura principal: quanto mais quente,
 * mais pesado e largo o número fica.
 */
export function temperatureTypeAxes(celsius: number) {
  const k = Math.min(1, Math.max(0, (celsius + 5) / 45));
  return {
    weight: Math.round(250 + k * 550),
    width: Math.round(75 + k * 25),
  };
}
