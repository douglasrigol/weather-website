import { useEffect, useState } from 'react';
import { getCurrentMany } from '../api/openMeteo';
import type { City, CityNow } from '../types';

/** Tempo agora de uma lista de cidades. Recarrega a cada 15 minutos. */
export function useCitiesNow(cities: City[]) {
  const [data, setData] = useState<CityNow[]>([]);
  const [failed, setFailed] = useState(false);
  const key = cities.map((c) => `${c.latitude},${c.longitude}`).join('|');

  useEffect(() => {
    if (cities.length === 0) {
      setData([]);
      return;
    }
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      getCurrentMany(cities, controller.signal)
        .then((result) => {
          setData(result);
          setFailed(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        });
    };
    load();
    const id = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
    // a chave cobre as coordenadas da lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, failed };
}
