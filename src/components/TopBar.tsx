import { cityClock, formatLongDate, greetingFor } from '../lib/format';
import { useNow } from '../hooks/useNow';
import type { City, Forecast } from '../types';
import { SearchBox } from './SearchBox';

interface Props {
  city: City;
  forecast?: Forecast;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelectCity: (city: City) => void;
}

export function TopBar({ city, forecast, isFavorite, onToggleFavorite, onSelectCity }: Props) {
  const now = useNow();
  const clock = forecast ? cityClock(forecast.utcOffsetSeconds, now) : null;
  const hour = clock ? Number(clock.slice(0, 2)) : new Date().getHours();
  const date = forecast ? formatLongDate(forecast.daily[0].date) : '';

  return (
    <header className="topbar reveal">
      <div className="topbar__hello">
        <p className="topbar__greeting">{greetingFor(hour)}</p>
        {clock && (
          <p className="topbar__date">
            {date}, {clock} em {city.name}
          </p>
        )}
      </div>

      <div className="topbar__actions">
        <SearchBox onSelect={onSelectCity} />
        <button
          type="button"
          className="icon-button glass"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remover ${city.name} das favoritas` : `Adicionar ${city.name} às favoritas`}
          title={isFavorite ? 'Remover das favoritas' : 'Adicionar às favoritas'}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.6l-5 2.7.9-5.6-4-4 5.6-.8z"
              fill={isFavorite ? '#FFD24A' : 'none'}
              stroke={isFavorite ? '#FFD24A' : 'currentColor'}
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
