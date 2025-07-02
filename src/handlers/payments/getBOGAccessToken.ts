import { BOG_AUTH_URL, getMockBOGToken, MOCK_MODE } from "./payments";

let accessTokenCache: { token: string; expiresAt: number } | null = null;

export const getBOGAccessToken = async (): Promise<string> => {
  if (MOCK_MODE) {
    return getMockBOGToken();
  }

  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  const clientId = process.env.BOG_CLIENT_ID;
  const clientSecret = process.env.BOG_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "BOG_CLIENT_ID and BOG_CLIENT_SECRET environment variables are required"
    );
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await fetch(BOG_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authString}`,
        Accept: "application/json",
        "User-Agent": "DaudTravel-Backend/1.0",
      },
      body: "grant_type=client_credentials",
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("❌ BOG Authentication failed:", {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      throw new Error(
        `BOG Authentication error: ${response.status} ${response.statusText} - ${responseText}`
      );
    }

    let authData;
    try {
      authData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Response was:", responseText);
      throw new Error(
        `BOG returned invalid JSON: ${responseText.substring(0, 200)}`
      );
    }

    if (!authData.access_token) {
      console.error("❌ No access_token in BOG response:", authData);
      throw new Error("BOG authentication response missing access_token");
    }

    accessTokenCache = {
      token: authData.access_token,
      expiresAt: Date.now() + (authData.expires_in || 3600) * 1000 - 60000,
    };

    return authData.access_token;
  } catch (error) {
    console.error("❌ Network error during BOG authentication:", error);
    throw error;
  }
};
