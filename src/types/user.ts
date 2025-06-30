export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  password?: string;
  is_verified: boolean;
  admin?: boolean;
}

export interface CreateUserData {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  code: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface PendingVerificationResult {
  exists: boolean;
  timeRemaining?: number;
}

export interface AuthResult {
  user: Omit<User, "password">;
  token: string;
}
