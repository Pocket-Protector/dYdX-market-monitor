// Raw fill as returned by the dYdX indexer /v4/fills endpoint
export interface IndexerFill {
  id: string;
  side: 'BUY' | 'SELL';
  liquidity: 'MAKER' | 'TAKER';
  type: string;
  market: string;
  price: string;
  size: string;
  fee: string;
  createdAt: string;
  subaccountNumber: number;
}

export interface FillTickerRow {
  ticker: string;
  makerVolume: number;
  takerVolume: number;
  totalVolume: number;
  makerFees: number;
  takerFees: number;
  netFees: number;
  makerFillCount: number;
  takerFillCount: number;
  totalFillCount: number;
}

export interface FillsTimePoint {
  ts: string;
  makerVolume: number;
  takerVolume: number;
  netFees: number;
  fillCount: number;
}

export interface FillsApiResponse {
  from: string;
  to: string;
  isCapped: boolean;
  summary: {
    totalVolume: number;
    makerVolume: number;
    takerVolume: number;
    netFees: number;
    makerFees: number;
    takerFees: number;
    fillCount: number;
  };
  byTicker: FillTickerRow[];
  timeSeries: FillsTimePoint[];
}
