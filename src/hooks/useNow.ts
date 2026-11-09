import { useEffect, useState } from 'react';

/** Data atual que se atualiza a cada `interval` ms (para relógios). */
export function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}
