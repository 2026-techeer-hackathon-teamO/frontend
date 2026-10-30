import { useCallback, useEffect, useRef, useState } from "react";

export const POLL_INTERVAL = 5000;

/**
 * fetcher를 즉시 실행한 뒤 interval마다 다시 실행한다.
 * deps가 바뀌면 이전 요청 결과는 버리고 새로 시작한다.
 */
export function usePolling<T>(fetcher: () => Promise<T>, deps: unknown[], interval = POLL_INTERVAL) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetcherRef
        .current()
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setError(null);
          setUpdatedAt(new Date());
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    setLoading(true);
    load();
    const timer = setInterval(load, interval);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, interval]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, updatedAt, refresh };
}
