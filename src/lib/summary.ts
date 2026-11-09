import type { DayPoint, Unit } from '../types';
import { formatTemp, windDirection } from './format';
import { describeWeather } from './weather';

/** Frase curta que resume o dia, mostrada abaixo do título. */
export function daySummary(day: DayPoint, unit: Unit): string {
  const parts = [`Máxima de ${formatTemp(day.max, unit)} e mínima de ${formatTemp(day.min, unit)}.`];

  if (day.rainChance >= 20) {
    const amount = day.rainSum >= 1 ? `, com cerca de ${Math.round(day.rainSum)} mm` : '';
    const what = describeWeather(day.code).kind === 'snow' ? 'neve' : 'chuva';
    parts.push(`Chance de ${what} de ${day.rainChance}%${amount}.`);
  } else {
    parts.push('Pouca chance de chuva ou neve.');
  }

  parts.push(`Vento de até ${Math.round(day.windMax)} km/h vindo do ${windDirection(day.windDirection)}.`);
  return parts.join(' ');
}
