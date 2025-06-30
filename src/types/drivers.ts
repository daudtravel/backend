export interface Driver {
  id: string;
  firstname: string;
  lastname: string;
  image: string;
}

export interface CreateDriverData {
  firstname: string;
  lastname: string;
  image: string;
}

export interface GetAllDriversResult {
  drivers: Driver[];
  count: number;
}
