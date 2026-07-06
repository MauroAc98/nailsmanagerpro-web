import { useLoadingStore } from '@/store/useLoadingStore';

export const withGlobalLoader = async <T>(fn: () => Promise<T>): Promise<T> => {
  useLoadingStore.getState().setLoading(true);
  try {
    return await fn();
  } finally {
    useLoadingStore.getState().setLoading(false);
  }
};
