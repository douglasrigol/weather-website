import { useId, type ReactNode } from 'react';
import type { WeatherKind } from '../types';

interface Props {
  kind: WeatherKind;
  isDay?: boolean;
  size?: number;
  className?: string;
}

const CLOUD = 'M6.5 19h11a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.6 10.1 4.5 4.5 0 0 0 6.5 19z';

/** Ícone colorido do tempo, desenhado em SVG (sem imagens externas). */
export function WeatherIcon({ kind, isDay = true, size = 24, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const ids = {
    sun: `sun-${uid}`,
    moon: `moon-${uid}`,
    cloud: `cloud-${uid}`,
    dark: `dark-${uid}`,
  };

  const sun = (r = 4.2) => (
    <g>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1={12 - r - 1.6}
          x2="12"
          y2={12 - r - 3.4}
          transform={`rotate(${deg} 12 12)`}
          stroke="#FFC94A"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
      <circle cx="12" cy="12" r={r} fill={`url(#${ids.sun})`} />
    </g>
  );
  const moon = <path d="M19.5 14.6A7.5 7.5 0 1 1 9.4 4.5a6 6 0 0 0 10.1 10.1z" fill={`url(#${ids.moon})`} />;
  const astro = (r?: number) => (isDay ? sun(r) : moon);
  const cloud = (dark = false, transform?: string) => (
    <path d={CLOUD} transform={transform} fill={`url(#${dark ? ids.dark : ids.cloud})`} />
  );
  const raised = 'translate(0 -3.5)';
  const drop = (x: number, y: number, len = 3) => (
    <line key={`${x}-${y}`} x1={x} y1={y} x2={x - len * 0.3} y2={y + len} stroke="#6EC1FF" strokeWidth="1.6" strokeLinecap="round" />
  );

  let content: ReactNode;
  switch (kind) {
    case 'clear':
      content = astro();
      break;
    case 'partly':
      content = (
        <>
          <g transform="translate(-3 -3.5) translate(12 12) scale(0.78) translate(-12 -12)">{astro(3.8)}</g>
          {cloud(false, 'translate(1.5 0.5) translate(12 15) scale(0.85) translate(-12 -15)')}
        </>
      );
      break;
    case 'cloudy':
      content = (
        <>
          {cloud(true, 'translate(3 -3) scale(0.8)')}
          {cloud(false, 'translate(-1 1)')}
        </>
      );
      break;
    case 'fog':
      content = (
        <>
          {cloud(false, raised)}
          <line x1="4" y1="18.5" x2="20" y2="18.5" stroke="#E3EAF2" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="6.5" y1="21.5" x2="17.5" y2="21.5" stroke="#E3EAF2" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </>
      );
      break;
    case 'drizzle':
      content = (
        <>
          {cloud(false, raised)}
          {drop(8, 18.5, 2)}
          {drop(12.5, 19, 2)}
          {drop(17, 18.5, 2)}
        </>
      );
      break;
    case 'rain':
      content = (
        <>
          {cloud(true, raised)}
          {drop(8, 18, 3.6)}
          {drop(12.5, 18.5, 3.6)}
          {drop(17, 18, 3.6)}
        </>
      );
      break;
    case 'snow':
      content = (
        <>
          {cloud(false, raised)}
          {[8, 12.5, 17].map((x, i) => (
            <circle key={x} cx={x} cy={i === 1 ? 21 : 19.2} r="1.15" fill="#FFFFFF" />
          ))}
        </>
      );
      break;
    case 'storm':
      content = (
        <>
          {cloud(true, raised)}
          <path d="M12.8 14.5 9.6 19.2h2.9l-1.6 4.1 4.4-5.6h-3l1.6-3.2z" fill="#FFD24A" />
        </>
      );
      break;
  }

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id={ids.sun} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FFF1A8" />
          <stop offset="1" stopColor="#FFAE1F" />
        </radialGradient>
        <linearGradient id={ids.moon} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4F6FF" />
          <stop offset="1" stopColor="#AEBBE6" />
        </linearGradient>
        <linearGradient id={ids.cloud} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#CFDAE6" />
        </linearGradient>
        <linearGradient id={ids.dark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C2CCD8" />
          <stop offset="1" stopColor="#7D8A9B" />
        </linearGradient>
      </defs>
      {content}
    </svg>
  );
}
