import crypto from "crypto";

export const BOG_AUTH_URL =
  "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token";
export const BOG_API_URL = "https://api.bog.ge/payments/v1/ecommerce";

export const getCallbackUrl = () => {
  return `${process.env.BASE_URL}/api/payments/bog/callback`;
};

export const getTransfersCallbackUrl = () => {
  return `${process.env.BASE_URL}/api/payments/bog/callback/transfer`;
};

export const BOG_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`;

export function verifyBOGSignature(body: string, signature: string): boolean {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(body, "utf8");
    return verifier.verify(BOG_PUBLIC_KEY, signature, "base64");
  } catch {
    return false;
  }
}
