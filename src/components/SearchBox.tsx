import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { reverseGeocode, searchCities } from '../api/openMeteo';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { City } from '../types';

interface Props {
  onSelect: (city: City) => void;
}

type SearchState = 'idle' | 'loading' | 'done' | 'error';

export function SearchBox({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<City[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setState('idle');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    searchCities(debounced, controller.signal)
      .then((cities) => {
        setResults(cities);
        setActive(cities.length ? 0 : -1);
        setState('done');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [debounced]);

  // fecha a lista ao clicar fora
  useEffect(() => {
    function handle(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, []);

  function choose(city: City) {
    onSelect(city);
    setQuery('');
    setResults([]);
    setOpen(false);
    setGeoError('');
    inputRef.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter' && open && results[active]) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  function locateUser() {
    if (!('geolocation' in navigator)) {
      setGeoError('Seu navegador não informa a localização. Busque a cidade pelo nome.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const city = await reverseGeocode(coords.latitude, coords.longitude);
        setLocating(false);
        choose(city);
      },
      () => {
        setLocating(false);
        setGeoError('Localização bloqueada. Libere o acesso no navegador ou busque a cidade pelo nome.');
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  const showList = open && query.trim().length >= 2;

  return (
    <div className="search" ref={rootRef}>
      <div className="search__field">
        <svg className="search__glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <line x1="16" y1="16" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          placeholder="Buscar cidade"
          aria-label="Buscar cidade"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="search__locate"
          onClick={locateUser}
          disabled={locating}
          aria-label="Usar minha localização"
          title="Usar minha localização"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={locating ? 'spin' : undefined}>
            <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {showList && (
        <ul className="search__list" id={listId} role="listbox">
          {state === 'loading' && results.length === 0 && <li className="search__note">Buscando…</li>}
          {state === 'error' && <li className="search__note">A busca falhou. Confira sua conexão e digite de novo.</li>}
          {state === 'done' && results.length === 0 && (
            <li className="search__note">Nenhuma cidade encontrada para “{query.trim()}”. Confira a grafia.</li>
          )}
          {results.map((city, i) => (
            <li
              key={city.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="search__option"
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(city)}
            >
              <span className="search__city">{city.name}</span>
              <span className="search__region">{[city.admin1, city.country].filter(Boolean).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}

      {geoError && (
        <p className="search__error" role="alert">
          {geoError}
        </p>
      )}
    </div>
  );
}
