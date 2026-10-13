import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data: T | undefined; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | undefined; error: Error };

/** Run an async loader when deps change; ignores stale responses. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: undefined, error: null });
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    // Resetting to "loading" when the inputs change is the purpose of this hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ status: 'loading', data: s.data, error: null }));
    loader().then(
      (data) => id === seq.current && setState({ status: 'success', data, error: null }),
      (error: unknown) =>
        id === seq.current && setState((s) => ({ status: 'error', data: s.data, error: error instanceof Error ? error : new Error(String(error)) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
