import { useRef } from 'react';
import { convertTemp, formatTemp } from '../lib/format';
import { gsap, useGSAP } from '../lib/gsap';
import { describeWeather, temperatureTypeAxes } from '../lib/weather';
import type { City, CurrentConditions, Unit } from '../types';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  city: City;
  current: CurrentConditions;
  unit: Unit;
  reducedMotion: boolean;
}

export function NowCard({ city, current, unit, reducedMotion }: Props) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const { kind, label } = describeWeather(current.code);
  const value = convertTemp(current.temperature, unit);
  const { weight, width } = temperatureTypeAxes(current.temperature);
  const region = [city.admin1, city.country].filter(Boolean).join(', ');

  // o número conta até a temperatura atual
  useGSAP(
    () => {
      if (!numberRef.current) return;
      if (reducedMotion) {
        numberRef.current.textContent = String(value);
        return;
      }
      const counter = { n: Number(numberRef.current.textContent) || 0 };
      gsap.to(counter, {
        n: value,
        duration: 1.2,
        ease: 'power3.out',
        onUpdate: () => {
          if (numberRef.current) numberRef.current.textContent = String(Math.round(counter.n));
        },
      });
    },
    { dependencies: [value, reducedMotion] },
  );

  return (
    <article className="now glass reveal" aria-label={`Tempo agora em ${city.name}`}>
      <header className="now__place">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 1 1 13 0c0 4.9-6.5 11-6.5 11z" fill="currentColor" />
          <circle cx="12" cy="10" r="2.4" fill="rgba(0,0,0,0.35)" />
        </svg>
        <div>
          <p className="now__city">{city.name}</p>
          {region && <p className="now__region">{region}</p>}
        </div>
      </header>

      <div className="now__main">
        <p
          className="now__temp"
          style={{ fontVariationSettings: `"wght" ${weight}, "wdth" ${width}, "opsz" 96` }}
          aria-label={`${value} graus`}
        >
          <span ref={numberRef} aria-hidden="true">
            {value}
          </span>
          <span className="now__unit" aria-hidden="true">
            °{unit.toUpperCase()}
          </span>
        </p>
        <WeatherIcon kind={kind} isDay={current.isDay} size={72} className="now__icon" />
      </div>
      <p className="now__label">
        {label}. Sensação de {formatTemp(current.apparent, unit)}.
      </p>

      <dl className="now__stats">
        <div>
          <dt>Vento</dt>
          <dd>{Math.round(current.windSpeed)} km/h</dd>
        </div>
        <div>
          <dt>Umidade</dt>
          <dd>{Math.round(current.humidity)}%</dd>
        </div>
        <div>
          <dt>Chuva</dt>
          <dd>{current.precipitation.toFixed(1).replace('.', ',')} mm</dd>
        </div>
      </dl>
    </article>
  );
}
