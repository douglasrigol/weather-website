import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CityList } from './components/CityList';
import { Hero } from './components/Hero';
import { Highlights } from './components/Highlights';
import { NowCard } from './components/NowCard';
import { Sidebar, type View } from './components/Sidebar';
import { Skeleton } from './components/Skeleton';
import { TopBar } from './components/TopBar';
import { useCitiesNow } from './hooks/useCitiesNow';
import { useForecast } from './hooks/useForecast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useReducedMotion } from './hooks/useReducedMotion';
import { nextHours } from './lib/format';
import { gsap, useGSAP } from './lib/gsap';
import { DEFAULT_FAVORITES, WORLD_CITIES } from './lib/worldCities';
import { PALETTES, sceneParamsFor, type SceneParams } from './scene/sceneParams';
import { WeatherScene } from './scene/WeatherScene';
import type { City, Unit } from './types';

// o globo (Three.js) só é baixado quando a pessoa abre essa aba
const GlobeView = lazy(() => import('./globe/GlobeView'));

const DEFAULT_CITY: City = {
  id: 3448439,
  name: 'São Paulo',
  latitude: -23.5475,
  longitude: -46.63611,
  admin1: 'São Paulo',
  country: 'Brasil',
};

const IDLE_SCENE: SceneParams = {
  palette: PALETTES['clear-day'],
  isDay: true,
  clouds: 0.3,
  cloudDark: 0,
  rain: 0,
  snow: 0,
  fog: 0,
  storm: false,
  sun: true,
  stars: 0,
  wind: 0.2,
};

export default function App() {
  const [city, setCity] = useLocalStorage<City>('nimbo:city', DEFAULT_CITY);
  const [unit, setUnit] = useLocalStorage<Unit>('nimbo:unit', 'c');
  const [favorites, setFavorites] = useLocalStorage<City[]>('nimbo:favorites', DEFAULT_FAVORITES);
  const [view, setView] = useState<View>('painel');
  const [selectedDay, setSelectedDay] = useState(0);
  const [globeOpened, setGlobeOpened] = useState(false);
  const reducedMotion = useReducedMotion();
  const appRef = useRef<HTMLDivElement>(null);

  const forecast = useForecast(city);
  const data = forecast.data;
  const favoritesNow = useCitiesNow(favorites);

  const worldList = useMemo(() => {
    if (!globeOpened) return [];
    const known = WORLD_CITIES.some((c) => Math.abs(c.latitude - city.latitude) < 0.3 && Math.abs(c.longitude - city.longitude) < 0.3);
    return known ? WORLD_CITIES : [...WORLD_CITIES, city];
  }, [globeOpened, city]);
  const world = useCitiesNow(worldList);

  const hours = useMemo(() => (data ? nextHours(data.hourly, data.current.time) : []), [data]);
  const isFavorite = favorites.some((f) => f.id === city.id);

  // o cenário mostra o dia escolhido na curva da semana
  const sceneParams = useMemo<SceneParams>(() => {
    if (!data) return IDLE_SCENE;
    if (selectedDay === 0) {
      const c = data.current;
      return sceneParamsFor(c.code, c.isDay, c.windSpeed, c.windDirection);
    }
    const d = data.daily[selectedDay];
    return sceneParamsFor(d.code, true, d.windMax, d.windDirection);
  }, [data, selectedDay]);

  useEffect(() => {
    document.title = data ? `${Math.round(data.current.temperature)}° em ${city.name} · Nimbo` : 'Nimbo · Previsão do tempo';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sceneParams.palette.skyTop);
  }, [data, city.name, sceneParams.palette.skyTop]);

  // entrada orquestrada: os painéis sobem em sequência uma vez por tela
  const hasData = Boolean(data);
  useGSAP(
    () => {
      if (reducedMotion || !hasData) return;
      gsap.from('.reveal', {
        y: 28,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.06,
        clearProps: 'transform,opacity',
      });
    },
    { scope: appRef, dependencies: [hasData, view, reducedMotion] },
  );

  function selectCity(next: City) {
    setCity(next);
    setSelectedDay(0);
    setView('painel');
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  function toggleFavorite() {
    setFavorites((list) => (list.some((f) => f.id === city.id) ? list.filter((f) => f.id !== city.id) : [...list, city]));
  }

  function changeView(next: View) {
    if (next === 'globo') setGlobeOpened(true);
    setView(next);
  }

  return (
    <div className="app" ref={appRef}>
      <WeatherScene params={sceneParams} paused={view === 'globo'} />

      <div className="shell">
        <Sidebar view={view} onViewChange={changeView} unit={unit} onUnitChange={setUnit} />

        <div className="main">
          <TopBar
            city={city}
            forecast={data}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onSelectCity={selectCity}
          />

          {forecast.status === 'error' && (
            <div className="notice glass" role="alert">
              <p>{forecast.error}</p>
              <button type="button" className="button" onClick={forecast.retry}>
                Tentar de novo
              </button>
            </div>
          )}

          {view === 'painel' && (
            <main className={forecast.status === 'loading' && data ? 'dashboard is-refreshing' : 'dashboard'} aria-busy={forecast.status === 'loading'}>
              {!data && forecast.status === 'loading' && <Skeleton />}
              {data && (
                <>
                  <Hero
                    forecast={data}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    unit={unit}
                    reducedMotion={reducedMotion}
                  />
                  <aside className="side">
                    <NowCard city={city} current={data.current} unit={unit} reducedMotion={reducedMotion} />
                    <CityList
                      favorites={favorites}
                      now={favoritesNow.data}
                      failed={favoritesNow.failed}
                      unit={unit}
                      onSelect={selectCity}
                      onRemove={(c) => setFavorites((list) => list.filter((f) => f.id !== c.id))}
                    />
                  </aside>
                  <Highlights forecast={data} hours={hours} unit={unit} />
                </>
              )}
            </main>
          )}

          {view === 'globo' && (
            <main>
              <Suspense fallback={<p className="globe-view__loading">Carregando o globo…</p>}>
                <GlobeView
                  cities={world.data}
                  failed={world.failed}
                  currentCity={city}
                  unit={unit}
                  reducedMotion={reducedMotion}
                  onOpenCity={selectCity}
                />
              </Suspense>
            </main>
          )}

          <footer className="footer">
            <p>
              Previsão da <a href="https://open-meteo.com/">Open-Meteo</a>. Projeto de portfólio de{' '}
              <a href="https://www.linkedin.com/in/douglas-rigol">Douglas Rigol</a>.
            </p>
            <p>
              Modelos 3D (CC BY 4.0):{' '}
              <a href="https://sketchfab.com/3d-models/the-sun-8f31ed4194e34f91bdacbd85dfc5fb39">Sol</a> de tamminen,{' '}
              <a href="https://sketchfab.com/3d-models/moon-4db2273f6dd943b8ad7fa5e3b1b2431a">Lua</a> e{' '}
              <a href="https://sketchfab.com/3d-models/earth-41fc80d85dfd480281f21b74b2de2faa">Terra</a> de Akshat,{' '}
              <a href="https://sketchfab.com/3d-models/fluffy-cloud-2c887a28840f47cfae6b5dee0d11b842">Nuvem</a> de Loïc Norgeot.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
