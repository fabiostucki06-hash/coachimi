import { create } from 'zustand';

interface CoinAnchor {
  x: number;
  y: number;
}

interface CoinAnchorState {
  /** Center point of the Goldbarren badge in window coordinates, last measured by GoldBarBadge. Null when the badge isn't mounted on the current screen. */
  anchor: CoinAnchor | null;
  setAnchor: (anchor: CoinAnchor) => void;
}

export const useCoinAnchorStore = create<CoinAnchorState>((set) => ({
  anchor: null,
  setAnchor: (anchor) => set({ anchor }),
}));
