export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetToursResponse {
  message: string;
  data: {
    tours: Tour[];
    pagination: PaginationInfo;
  };
}

export interface Tour {
  id: string;
  localizations: {
    locale: string;
    start_location?: string;
    next_location?: string[];
    description?: string;
  }[];
  duration?: string;
  start_time?: string;
  end_time?: string;
  total_price: number;
  reservation_price: number;
  public: boolean;
  image: string;
  gallery?: string[];
  created_at: Date;
  updated_at: Date;
}