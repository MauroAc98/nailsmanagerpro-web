import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  setLoading: (value: boolean) => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
}));
