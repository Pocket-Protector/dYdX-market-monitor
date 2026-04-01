export interface MmActivity {
  lastFillAt: string | null;
  lastMakerFillAt: string | null;
  lastFillInRangeAt: string | null;
  lastMakerFillInRangeAt: string | null;
  makerVolumeInRange: number;
  makerTickerCountInRange: number;
  loading: boolean;
}
