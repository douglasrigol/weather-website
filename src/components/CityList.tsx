import { convertTemp } from '../lib/format';
import { describeWeather } from '../lib/weather';
import type { City, CityNow, Unit } from '../types';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  favorites: City[];
  now: CityNow[];
  failed: boolean;
  unit: Unit;
  onSelect: (city: City) => void;
  onRemove: (city: City) => void;
}

export function CityList({ favorites, now, failed, unit, onSelect, onRemove }: Props) {
  return (
    <section className="cities reveal" aria-labelledby="cities-title">
      <h2 id="cities-title" className="section-title">
        Favoritas
      </h2>

      {favorites.length === 0 && (
        <p className="cities__empty glass">Toque na estrela no topo para guardar a cidade que está vendo.</p>
      )}
      {failed && favorites.length > 0 && now.length === 0 && (
        <p className="cities__empty glass">Não deu para carregar as favoritas agora.</p>
      )}

      <ul className="cities__list">
        {favorites.map((city) => {
          const info = now.find((n) => n.city.id === city.id);
          const weather = info ? describeWeather(info.code) : null;
          return (
            <li key={city.id} className="city glass">
              <button type="button" className="city__open" onClick={() => onSelect(city)}>
                <span className="city__country">{city.admin1 ?? city.country}</span>
                <span className="city__name">{city.name}</span>
                <span className="city__label">{weather?.label ?? 'Carregando…'}</span>
              </button>
              <span className="city__temp">
                {info ? `${convertTemp(info.temperature, unit)}°` : '–'}
                {weather && info && <WeatherIcon kind={weather.kind} isDay={info.isDay} size={30} />}
              </span>
              <button
                type="button"
                className="city__remove"
                onClick={() => onRemove(city)}
                aria-label={`Remover ${city.name} das favoritas`}
                title="Remover"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
