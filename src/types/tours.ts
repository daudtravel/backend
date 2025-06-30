// types/tour.types.ts

export interface TourLocalization {
  locale: string;
  title: string;
  description: string;
  start_location: string;
  end_location?: string;
  included?: string[];
  excluded?: string[];
  itinerary?: string;
  highlights?: string[];
  [key: string]: any; // for additional localization fields
}

export interface GroupPrices {
  total_price: number | null;
  reservation_price: number | null;
  discounted_price: number | null;
}

export interface SeasonPrices {
  total_price: number | null;
  discounted_price: number | null;
  reservation_price: number | null;
}

export interface IndividualPrices {
  season: SeasonPrices;
  off_season: SeasonPrices;
}

export interface Tour {
  id: string;
  localizations: TourLocalization[];
  day: number;
  night: number;
  group_prices: GroupPrices | null;
  individual_prices: IndividualPrices | null;
  type: boolean; // true for individual, false for group
  image: string;
  gallery: string[];
  public: boolean;
  date: string | null; // for group tours
  amount_persons: number | null; // for individual tours
  daily: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTourData {
  localizations: TourLocalization[];
  day: number;
  night: number;
  group_prices?: GroupPrices;
  individual_prices?: IndividualPrices;
  type: boolean;
  image: string; // base64 string
  gallery?: string[]; // array of base64 strings
  date?: string;
  amount_persons?: number;
  daily: boolean;
}

export interface UpdateTourData {
  localizations?: TourLocalization[];
  day?: number;
  night?: number;
  daily?: boolean;
  group_prices?: GroupPrices;
  individual_prices?: IndividualPrices;
  amount_persons?: number;
  public?: boolean;
  type?: boolean;
  date?: string;
  image?: string | null; // base64 string or null
  gallery?: string[] | null; // array of base64 strings or null
  deleteImages?: string[] | null; // array of image URLs to delete
}

export interface TourQueryParams {
  page?: number;
  limit?: number;
  locale?: string;
}

export interface PublicTourQueryParams extends TourQueryParams {
  isGroup?: string; // "true" or "false"
  start_location?: string;
}

export interface TourPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ToursResponse {
  tours: Tour[];
  pagination: TourPagination;
}

export interface ProcessedImages {
  mainImageUrl: string;
  galleryUrls: string[];
}

export interface UpdateTourResponse {
  updatedTour: Tour;
  daily: boolean;
  finalGroupPrices: GroupPrices | null;
  finalIndividualPrices: IndividualPrices | null;
  finalAmountPersons: number | null;
}
