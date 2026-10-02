export interface BoardRow {
  token: string;
  symbol: string;
  name: string;
  description: string;
  logo: string | null;
  graduated: boolean;
  launchedAt: number | null;
  quoteSymbol: string | null;
  marketCapUsd: number | null;
  tracked: boolean;
  themes: string[];
  /** Lifetime creator fees in the quote asset. */
  feesTotal: number | null;
  feesTotalUsd: number | null;
  /** USD per hour, measured between snapshots over at most the last hour. */
  fees1hUsd: number | null;
  fees1hSpanMs: number | null;
  /** USD per day, measured between snapshots over at most the last 24 hours. */
  feesDayUsd: number | null;
  feesDaySpanMs: number | null;
  /** Lifetime fees divided by age. */
  lifetimeDailyUsd: number | null;
  isNew: boolean;
  hot: boolean;
  twitter: string | null;
  website: string | null;
  telegram: string | null;
}

export interface BoardData {
  rows: BoardRow[];
  refreshedAt: number | null;
  snapshots: number;
  refreshing: boolean;
  refreshMinutes: number;
  ethUsd: number | null;
  ephemeral: boolean;
}

export interface CoinDetail {
  row: BoardRow;
  history: { at: number; fees: number }[];
  refreshedAt: number | null;
  quotePriceUsd: number | null;
}
