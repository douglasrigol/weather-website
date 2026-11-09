import { useId } from 'react';
import { smoothPath } from '../lib/curve';
import {
  beaufort,
  cityClock,
  convertTemp,
  formatClock,
  formatHour,
  formatVisibility,
  minutesOfDay,
  uvLabel,
  visibilityLabel,
  windDirection,
} from '../lib/format';
import { describeWeather } from '../lib/weather';
import { useElementWidth } from '../hooks/useElementWidth';
import { useNow } from '../hooks/useNow';
import type { Forecast, HourPoint, Unit } from '../types';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  forecast: Forecast;
  hours: HourPoint[];
  unit: Unit;
}

export function Highlights({ forecast, hours, unit }: Props) {
  return (
    <section className="highlights" aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="section-title reveal">
        Destaques de hoje
      </h2>
      <div className="highlights__grid">
        <WindTile forecast={forecast} hours={hours} />
        <UvTile forecast={forecast} />
        <SunTile forecast={forecast} />
        <AirTile forecast={forecast} />
        <HourlyTile hours={hours} unit={unit} />
      </div>
    </section>
  );
}

function WindTile({ forecast, hours }: { forecast: Forecast; hours: HourPoint[] }) {
  const { current } = forecast;
  const scale = beaufort(current.windSpeed);
  const speeds = hours.map((h) => h.windSpeed);
  const max = Math.max(...speeds, 1);

  return (
    <article className="tile glass reveal">
      <h3 className="tile__title">Vento</h3>
      <div className="wind">
        <div>
          <p className="tile__value">
            {Math.round(current.windSpeed)}
            <span className="tile__unit">km/h</span>
          </p>
          <p className="tile__note">
            {scale.name}, força {scale.force} na escala Beaufort. Rajadas de {Math.round(current.windGusts)} km/h.
          </p>
        </div>
        <svg className="wind__compass" viewBox="0 0 80 80" role="img" aria-label={`Vento vindo do ${windDirection(current.windDirection)}`}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          {Array.from({ length: 24 }, (_, i) => (
            <line
              key={i}
              x1="40"
              y1="8"
              x2="40"
              y2={i % 6 === 0 ? 13 : 10.5}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.2"
              transform={`rotate(${i * 15} 40 40)`}
            />
          ))}
          {[
            ['N', 40, 22],
            ['L', 59, 43],
            ['S', 40, 63],
            ['O', 21, 43],
          ].map(([t, x, y]) => (
            <text key={t} x={x} y={y} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.7)">
              {t}
            </text>
          ))}
          {/* a seta aponta para onde o vento vai */}
          <g transform={`rotate(${current.windDirection + 180} 40 40)`}>
            <line x1="40" y1="52" x2="40" y2="26" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M40 22l-5 7h10z" fill="#fff" />
          </g>
        </svg>
      </div>
      <div className="bars" aria-hidden="true">
        {speeds.map((s, i) => (
          <span key={hours[i].time} style={{ height: `${Math.max(8, (s / max) * 100)}%` }} />
        ))}
      </div>
      <p className="tile__caption">Próximas 24 horas</p>
    </article>
  );
}

function UvTile({ forecast }: { forecast: Forecast }) {
  const uv = forecast.current.uv;
  const max = forecast.daily[0].uvMax;
  const id = useId().replace(/:/g, '');
  // semicírculo de 0 a 11+
  const angle = Math.PI * (1 - Math.min(uv, 11) / 11);
  const cx = 70;
  const cy = 70;
  const r = 54;
  const dot = [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];

  return (
    <article className="tile glass reveal">
      <h3 className="tile__title">Índice UV</h3>
      <svg className="uv" viewBox="0 0 140 84" role="img" aria-label={`Índice UV ${Math.round(uv)}, ${uvLabel(uv)}`}>
        <defs>
          <linearGradient id={`uv-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#7BE495" />
            <stop offset="0.3" stopColor="#F5E663" />
            <stop offset="0.55" stopColor="#FFAE3D" />
            <stop offset="0.8" stopColor="#FF5E5E" />
            <stop offset="1" stopColor="#B57BFF" />
          </linearGradient>
        </defs>
        <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" strokeLinecap="round" />
        <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke={`url(#uv-${id})`} strokeWidth="12" strokeLinecap="round" opacity="0.9" />
        <circle cx={dot[0]} cy={dot[1]} r="8" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
        <text x={cx} y={cy - 6} textAnchor="middle" className="uv__value">
          {uv.toFixed(1).replace('.', ',')}
        </text>
      </svg>
      <p className="tile__note">
        Agora {uvLabel(uv)}. Máximo de {Math.round(max)} ({uvLabel(max)}) hoje.
      </p>
    </article>
  );
}

function SunTile({ forecast }: { forecast: Forecast }) {
  const now = useNow(60000);
  const today = forecast.daily[0];
  const rise = minutesOfDay(today.sunrise);
  const set = minutesOfDay(today.sunset);
  const clock = cityClock(forecast.utcOffsetSeconds, now);
  const current = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
  const progress = Math.min(1, Math.max(0, (current - rise) / (set - rise)));
  const isUp = current >= rise && current <= set;
  const length = set - rise;
  const id = useId().replace(/:/g, '');

  const w = 200;
  const h = 90;
  const angle = Math.PI * (1 - progress);
  const sx = 100 + 82 * Math.cos(angle);
  const sy = 82 - 70 * Math.sin(angle);

  return (
    <article className="tile glass reveal">
      <h3 className="tile__title">Nascer e pôr do sol</h3>
      <svg className="sun" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Sol nasce às ${formatClock(today.sunrise)} e se põe às ${formatClock(today.sunset)}`}>
        <defs>
          <clipPath id={`done-${id}`}>
            <rect x="0" y="0" width={sx} height={h} />
          </clipPath>
        </defs>
        <line x1="6" y1="82" x2="194" y2="82" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <path d="M18,82 A82,70 0 0 1 182,82" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="3 5" />
        <path d="M18,82 A82,70 0 0 1 182,82" fill="none" stroke="#FFD27A" strokeWidth="2.5" clipPath={`url(#done-${id})`} />
        {isUp && (
          <>
            <circle cx={sx} cy={sy} r="12" fill="#FFD27A" opacity="0.3" />
            <circle cx={sx} cy={sy} r="6.5" fill="#FFE7A8" />
          </>
        )}
      </svg>
      <div className="sun__times">
        <p>
          <span className="tile__caption">Nascer</span>
          {formatClock(today.sunrise)}
        </p>
        <p>
          <span className="tile__caption">Pôr</span>
          {formatClock(today.sunset)}
        </p>
      </div>
      <p className="tile__note">
        {Math.floor(length / 60)}h {length % 60}min de luz do dia.{' '}
        {current < rise ? `O sol nasce às ${formatClock(today.sunrise)}.` : current > set ? 'O sol já se pôs.' : ''}
      </p>
    </article>
  );
}

function AirTile({ forecast }: { forecast: Forecast }) {
  const c = forecast.current;
  const rows = [
    { label: 'Umidade', value: `${Math.round(c.humidity)}%`, bar: c.humidity },
    { label: 'Nuvens', value: `${Math.round(c.cloudCover)}%`, bar: c.cloudCover },
  ];
  return (
    <article className="tile glass reveal">
      <h3 className="tile__title">Ar</h3>
      <ul className="air">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="air__label">{row.label}</span>
            <span className="air__value">{row.value}</span>
            <span className="air__bar" aria-hidden="true">
              <span style={{ width: `${row.bar}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <dl className="air__facts">
        <div>
          <dt>Visibilidade</dt>
          <dd>
            {formatVisibility(c.visibility)} <span>{visibilityLabel(c.visibility)}</span>
          </dd>
        </div>
        <div>
          <dt>Pressão</dt>
          <dd>
            {Math.round(c.pressure)} <span>hPa</span>
          </dd>
        </div>
      </dl>
    </article>
  );
}

function HourlyTile({ hours, unit }: { hours: HourPoint[]; unit: Unit }) {
  const [ref, boxWidth] = useElementWidth<HTMLDivElement>();
  // no celular o gráfico ganha rolagem lateral em vez de espremer as horas
  const width = boxWidth > 0 ? Math.max(boxWidth, 640) : 0;
  const id = useId().replace(/:/g, '');
  const H = 176;
  const top = 30;
  const bottom = 80;
  const temps = hours.map((h) => h.temperature);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = hi - lo || 1;
  const PAD = 22;
  const step = width > 0 ? (width - PAD * 2) / Math.max(1, hours.length) : 0;
  const pts: Array<[number, number]> = hours.map((h, i) => [
    PAD + step * i + step / 2,
    top + (1 - (h.temperature - lo) / span) * (H - top - bottom),
  ]);
  const line = width > 0 ? smoothPath(pts) : '';
  const area = line ? `${line} L${pts[pts.length - 1][0]},${H - bottom} L${pts[0][0]},${H - bottom} Z` : '';

  return (
    <article className="tile tile--wide glass reveal">
      <h3 className="tile__title">Próximas 24 horas</h3>
      <div className="hourly" ref={ref} tabIndex={boxWidth < 640 ? 0 : undefined}>
        <div className="hourly__canvas" style={{ width: width || undefined }}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Temperatura e chance de chuva nas próximas 24 horas">
            <defs>
              <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {hours.map((h, i) => (
              <rect
                key={`rain-${h.time}`}
                x={pts[i][0] - step * 0.3}
                y={H - 22 - (h.rainChance / 100) * 22}
                width={step * 0.6}
                height={(h.rainChance / 100) * 22}
                rx="2"
                fill="#6EC1FF"
                opacity="0.75"
              />
            ))}
            <path d={area} fill={`url(#area-${id})`} />
            <path d={line} fill="none" stroke="#fff" strokeWidth="2" />
            {hours.map((h, i) =>
              i % 3 === 0 ? (
                <g key={h.time}>
                  <circle cx={pts[i][0]} cy={pts[i][1]} r="3.5" fill="#fff" />
                  <text x={pts[i][0]} y={pts[i][1] - 10} textAnchor="middle" className="hourly__temp">
                    {convertTemp(h.temperature, unit)}°
                  </text>
                  <text x={pts[i][0]} y={H - 2} textAnchor="middle" className="hourly__time">
                    {i === 0 ? 'Agora' : formatHour(h.time)}
                  </text>
                </g>
              ) : null,
            )}
          </svg>
        )}
        {width > 0 &&
          hours.map((h, i) =>
            i % 3 === 0 ? (
              <span key={`icon-${h.time}`} className="hourly__icon" style={{ left: pts[i][0], top: H - 72 }} aria-hidden="true">
                <WeatherIcon kind={describeWeather(h.code).kind} isDay={h.isDay} size={20} />
              </span>
            ) : null,
          )}
        </div>
      </div>
      <p className="tile__caption">
        <span className="legend legend--rain" /> Chance de chuva
      </p>
    </article>
  );
}
