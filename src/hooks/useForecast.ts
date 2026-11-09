import { useCallback, useEffect, useState } from 'react';
import { getForecast } from '../api/openMeteo';
import type { City, Forecast } from '../types';

type State =
  | { status: 'loading'; data?: Forecast }
  | { status: 'success'; data: Forecast }
  | { status: 'error'; error: string; data?: Forecast };

export function useForecast(city: City) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // mantém os dados anteriores na tela enquanto a nova cidade carrega
    setState((prev) => ({ status: 'loading', data: prev.data }));

    getForecast(city, controller.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error && err.message.startsWith('O serviço')
            ? err.message
            : 'Sem conexão com o serviço de previsão. Confira sua internet e tente de novo.';
        setState((prev) => ({ status: 'error', error: message, data: prev.data }));
      });

    return () => controller.abort();
  }, [city.latitude, city.longitude, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
