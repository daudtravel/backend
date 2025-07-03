export const BOG_AUTH_URL =
  "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token";
export const BOG_API_URL = "https://api.bog.ge/payments/v1/ecommerce";

export const getCallbackUrl = () => {
  return `${process.env.BASE_URL}/api/payments/bog/callback`;
};
