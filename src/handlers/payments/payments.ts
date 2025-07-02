export const BOG_AUTH_URL =
  "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token";
export const BOG_API_URL = "https://api.bog.ge/payments/v1/ecommerce";

export const MOCK_MODE =
  process.env.NODE_ENV === "development" && !process.env.BOG_CLIENT_ID;

export const getCallbackUrl = (): string => {
  if (process.env.NODE_ENV === "production") {
    return `${process.env.BASE_URL}/api/payments/bog-callback`;
  }
  return process.env.BOG_CALLBACK_URL || "https://webhook.site/unique-id-here";
};

export const getMockBOGToken = (): string => {
  return "mock_token_for_development";
};
