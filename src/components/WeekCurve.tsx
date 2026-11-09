import { useId, useRef, type KeyboardEvent } from 'react';
import { smoothPath } from '../lib/curve';
import { convertTemp, formatDayLabel } from '../lib/format';
import { gsap, useGSAP } from '../lib/gsap';
import { describeWeather } from '../lib/weather';
import { useElementWidth } from '../hooks/useElementWidth';
import type { DayPoint, Unit } from '../types';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  days: DayPoint[];
  selected: number;
  onSelect: (index: number) => void;
  unit: Unit;
  reducedMotion: boolean;
}

const HEIGHT = 120;
const PAD_X = 36;

export function WeekCurve({ days, selected, onSelect, unit, reducedMotion }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const pathRef = useRef<SVGPathElement>(null);
  const gradientId = useId().replace(/:/g, '');

  const maxes = days.map((d) => d.max);
  const lo = Math.min(...maxes);
  const hi = Math.max(...maxes);
  const span = hi - lo || 1;
  const step = width > 0 ? (width - PAD_X * 2) / (days.length - 1) : 0;
  const points: Array<[number, number]> = days.map((d, i) => [
    PAD_X + i * step,
    22 + (1 - (d.max - lo) / span) * (HEIGHT - 44),
  ]);
  const path = width > 0 ? smoothPath(points) : '';
  const [sx, sy] = points[selected] ?? [0, 0];

  // a curva se desenha quando os dados mudam
  useGSAP(
    () => {
      if (reducedMotion || !pathRef.current || !path) return;
      gsap.from(pathRef.current, { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut' });
    },
    { dependencies: [days, width > 0, reducedMotion] },
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = selected;
    if (event.key === 'ArrowRight') next = Math.min(days.length - 1, selected + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, selected - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = days.length - 1;
    else return;
    event.preventDefault();
    onSelect(next);
    const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('.week__day');
    tabs[next]?.focus();
  }

  return (
    <div className="week" ref={wrapRef}>
      <div className="week__temps">
        {days.map((d, i) => {
          const { kind } = describeWeather(d.code);
          return (
            <span
              key={d.date}
              className="week__temp"
              data-active={i === selected}
              style={{ left: points[i]?.[0] ?? 0 }}
            >
              {convertTemp(d.max, unit)}°
              <WeatherIcon kind={kind} size={22} />
            </span>
          );
        })}
      </div>

      <svg className="week__chart" width={width} height={HEIGHT} aria-hidden="true">
        <defs>
          <linearGradient id={`beam-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${gradientId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {path && (
          <>
            <path d={path} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" strokeLinecap="round" filter={`url(#glow-${gradientId})`} />
            <path ref={pathRef} d={path} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" />
            <rect className="week__beam" x={sx - 1} y={0} width={2} height={HEIGHT} fill={`url(#beam-${gradientId})`} />
            <circle cx={sx} cy={sy} r="14" fill="#fff" opacity="0.35" filter={`url(#glow-${gradientId})`} />
            <circle cx={sx} cy={sy} r="5.5" fill="#fff" />
          </>
        )}
      </svg>

      <div
        className="week__days"
        role="tablist"
        aria-label="Escolha o dia da previsão"
        onKeyDown={onKeyDown}
      >
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={i === selected}
            tabIndex={i === selected ? 0 : -1}
            className="week__day"
            style={{ left: points[i]?.[0] ?? 0 }}
            onClick={() => onSelect(i)}
          >
            {formatDayLabel(d.date, i)}
          </button>
        ))}
      </div>
    </div>
  );
}
