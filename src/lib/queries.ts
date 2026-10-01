import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';

export const useGet = <T,>(url: string | null, opts: { enabled?: boolean; key?: QueryKey; refetchInterval?: number; staleTime?: number } = {}) =>
  useQuery<T>({ queryKey: opts.key ?? [url], queryFn: () => api.get<T>(url!), enabled: !!url && opts.enabled !== false, refetchInterval: opts.refetchInterval, staleTime: opts.staleTime });

/** Mutation helper that toasts errors and invalidates a set of query-key prefixes on success. */
export function useAct<V = void, R = any>(fn: (v: V) => Promise<R>, opts: { invalidate?: (string | number)[][]; success?: string | ((r: R) => string); onSuccess?: (r: R, v: V) => void; silentError?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation<R, Error, V>({
    mutationFn: fn,
    onSuccess: (r, v) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: k });
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      if (!opts.silentError) toast.error(e.message || 'Something went wrong');
    },
  });
}
