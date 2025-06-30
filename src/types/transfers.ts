export interface Localization {
  locale: string;
  title: string;
  description: string;
}

export interface Price {
  type: string;
  amount: number;
}

export interface CreateTransferData {
  localizations: Localization[];
  prices: Price[];
}

export interface UpdateTransferData {
  localizations: Localization[];
  prices: Price[];
}

export interface Transfer {
  id: string;
  localizations: Localization[];
  prices: Price[];
  created_at: Date;
}

export interface DeleteTransferResult {
  id: string;
}
