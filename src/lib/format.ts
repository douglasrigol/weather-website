import type { HourPoint, Unit } from '../types';

export function convertTemp(celsius: number, unit: Unit): number {
  const value = unit === 'f' ? celsius * 1.8 + 32 : celsius;
  // evita exibir "-0°"
  return Math.round(value) || 0;
}

export function formatTemp(celsius: number, unit: Unit): string {
  return `${convertTemp(celsius, unit)}°`;
}

/** Converte "2026-11-09" em Date local, sem cair no dia anterior por causa do UTC. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDayLabel(date: string, index: number): string {
  if (index === 0) return 'Hoje';
  if (index === 1) return 'Amanhã';
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(parseLocalDate(date));
  const clean = label.replace('.', '');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** "2026-11-09T14:00" → "14h" */
export function formatHour(isoLocal: string): string {
  return `${Number(isoLocal.slice(11, 13))}h`;
}

/** "2026-11-09T05:42" → "05:42" */
export function formatClock(isoLocal: string): string {
  return isoLocal.slice(11, 16);
}

const DIRECTIONS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

export function windDirection(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return DIRECTIONS[index];
}

export function uvLabel(uv: number): string {
  if (uv < 3) return 'baixo';
  if (uv < 6) return 'moderado';
  if (uv < 8) return 'alto';
  if (uv < 11) return 'muito alto';
  return 'extremo';
}

/**
 * Pega as próximas `count` horas a partir da hora atual da cidade.
 * Os horários da API já vêm no fuso local, então a comparação de texto funciona.
 */
export function nextHours(hourly: HourPoint[], currentTime: string, count = 24): HourPoint[] {
  const currentHour = `${currentTime.slice(0, 13)}:00`;
  const start = hourly.findIndex((h) => h.time >= currentHour);
  if (start === -1) return [];
  return hourly.slice(start, start + count);
}

export function formatLongDate(date: string): string {
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    parseLocalDate(date),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Hora local da cidade agora, a partir do deslocamento UTC devolvido pela API. */
export function cityClock(utcOffsetSeconds: number, now = Date.now()): string {
  const local = new Date(now + utcOffsetSeconds * 1000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const BEAUFORT_LIMITS = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
const BEAUFORT_NAMES = [
  'Calmaria',
  'Aragem',
  'Brisa leve',
  'Brisa fraca',
  'Brisa moderada',
  'Brisa forte',
  'Vento fresco',
  'Vento forte',
  'Ventania',
  'Ventania forte',
  'Tempestade',
  'Tempestade violenta',
  'Furacão',
];

/** Escala Beaufort a partir da velocidade em km/h. */
export function beaufort(kmh: number): { force: number; name: string } {
  let force = BEAUFORT_LIMITS.findIndex((limit) => kmh < limit);
  if (force === -1) force = 12;
  return { force, name: BEAUFORT_NAMES[force] };
}

export function formatVisibility(meters: number): string {
  if (meters >= 10000) return `${Math.round(meters / 1000)} km`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function visibilityLabel(meters: number): string {
  if (meters < 1000) return 'muito baixa';
  if (meters < 4000) return 'baixa';
  if (meters < 10000) return 'moderada';
  return 'boa';
}

/** Minutos desde a meia-noite para "2026-11-09T05:42". */
export function minutesOfDay(isoLocal: string): number {
  return Number(isoLocal.slice(11, 13)) * 60 + Number(isoLocal.slice(14, 16));
}
