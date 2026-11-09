import { useMemo, useState } from 'react';
import { WeatherIcon } from '../components/WeatherIcon';
import { beaufort, convertTemp, windDirection } from '../lib/format';
import { describeWeather } from '../lib/weather';
import type { City, CityNow, Unit } from '../types';
import GlobeCanvas from './GlobeCanvas';

interface Props {
  cities: CityNow[];
  failed: boolean;
  currentCity: City;
  unit: Unit;
  reducedMotion: boolean;
  onOpenCity: (city: City) => void;
}

function toDms(value: number, positive: string, negative: string) {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minutes = Math.floor((abs - deg) * 60);
  return `${deg}°${String(minutes).padStart(2, '0')}′ ${value >= 0 ? positive : negative}`;
}

export default function GlobeView({ cities, failed, currentCity, unit, reducedMotion, onOpenCity }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [userPicked, setUserPicked] = useState(false);

  const fallbackId = cities.find((c) => c.city.id === currentCity.id)?.city.id ?? cities[0]?.city.id ?? null;
  const activeId = selectedId ?? fallbackId;
  const selected = cities.find((c) => c.city.id === activeId);

  const stats = useMemo(() => {
    if (cities.length === 0) return null;
    const sorted = [...cities].sort((a, b) => b.temperature - a.temperature);
    const wet = cities.filter((c) => {
      const kind = describeWeather(c.code).kind;
      return kind === 'rain' || kind === 'storm' || kind === 'drizzle' || kind === 'snow';
    });
    return { hottest: sorted[0], coldest: sorted[sorted.length - 1], wet };
  }, [cities]);

  const select = (item: CityNow) => {
    setSelectedId(item.city.id);
    setUserPicked(true);
  };

  const weather = selected ? describeWeather(selected.code) : null;
  const wind = selected ? beaufort(selected.windSpeed) : null;

  return (
    <div className="globe-view">
      <div className="globe-view__stage reveal">
        {cities.length > 0 ? (
          <GlobeCanvas
            cities={cities}
            selectedId={activeId}
            onSelect={select}
            unit={unit}
            reducedMotion={reducedMotion}
            autoRotate={!userPicked}
          />
        ) : (
          <p className="globe-view__loading">{failed ? 'Não deu para carregar o tempo no mundo agora.' : 'Carregando o tempo no mundo…'}</p>
        )}
        <p className="globe-view__hint">Arraste para girar. Toque numa temperatura para ver a cidade.</p>
        <p className="globe-view__credit">
          Modelo 3D{' '}
          <a href="https://sketchfab.com/3d-models/earth-41fc80d85dfd480281f21b74b2de2faa">“Earth”</a> de Akshat,{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
        </p>
      </div>

      <aside className="globe-panel glass reveal" aria-live="polite">
        {selected && weather && wind ? (
          <>
            <p className="globe-panel__coords">
              {toDms(selected.city.latitude, 'N', 'S')} {toDms(selected.city.longitude, 'L', 'O')}
            </p>
            <h1 className="globe-panel__city">{selected.city.name}</h1>
            <p className="globe-panel__country">{selected.city.country}</p>

            <div className="globe-panel__now">
              <span className="globe-panel__temp">{convertTemp(selected.temperature, unit)}°</span>
              <WeatherIcon kind={weather.kind} isDay={selected.isDay} size={64} />
            </div>
            <p className="globe-panel__label">{weather.label}</p>

            <dl className="globe-panel__facts">
              <div>
                <dt>Força do vento</dt>
                <dd>
                  {wind.force} <span>Beaufort</span>
                </dd>
              </div>
              <div>
                <dt>Velocidade</dt>
                <dd>
                  {Math.round(selected.windSpeed)} <span>km/h do {windDirection(selected.windDirection)}</span>
                </dd>
              </div>
              <div>
                <dt>Umidade</dt>
                <dd>
                  {Math.round(selected.humidity)} <span>%</span>
                </dd>
              </div>
            </dl>

            <button type="button" className="button" onClick={() => onOpenCity(selected.city)}>
              Abrir previsão completa
            </button>
          </>
        ) : (
          <p>Escolha uma cidade no globo.</p>
        )}

        {stats && (
          <ul className="globe-panel__stats">
            <li>
              <span className="dot dot--wet" />
              <strong>{stats.wet.length}</strong> com chuva, neve ou tempestade agora
            </li>
            <li>
              <span className="dot dot--hot" />
              Mais quente: <strong>{stats.hottest.city.name}</strong>, {convertTemp(stats.hottest.temperature, unit)}°
            </li>
            <li>
              <span className="dot dot--cold" />
              Mais fria: <strong>{stats.coldest.city.name}</strong>, {convertTemp(stats.coldest.temperature, unit)}°
            </li>
          </ul>
        )}
      </aside>
    </div>
  );
}
