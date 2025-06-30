import { BOG_AUTH_URL, getMockBOGToken, MOCK_MODE } from "./payments";

let accessTokenCache: { token: string; expiresAt: number } | null = null;

export const getBOGAccessToken = async (): Promise<string> => {
  // 🧪 STEP 1: Use mock token in test mode
  if (MOCK_MODE) {
    return getMockBOGToken();
  }

  // 🔍 STEP 2: Check if we have a valid token in the cache
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    console.log("🔑 Using cached BOG access token");
    return accessTokenCache.token;
  }

  console.log("🔑 Requesting new BOG access token");

  // 🔑 STEP 3: Get client ID and secret from environment variables
  const clientId = process.env.BOG_CLIENT_ID;
  const clientSecret = process.env.BOG_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "BOG_CLIENT_ID and BOG_CLIENT_SECRET environment variables are required"
    );
  }

  console.log("🔧 Using BOG Auth URL:", BOG_AUTH_URL);
  console.log("🔧 Using Client ID:", clientId.substring(0, 4) + "****"); // Log partial ID for debugging

  // 📡 STEP 4: Request a new token from BOG
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await fetch(BOG_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authString}`,
        Accept: "application/json", // Explicitly request JSON
        "User-Agent": "DaudTravel-Backend/1.0", // Add user agent
      },
      body: "grant_type=client_credentials",
    });

    console.log("🔧 BOG Auth Response Status:", response.status);
    console.log(
      "🔧 BOG Auth Response Headers:",
      Object.fromEntries(response.headers.entries())
    );

    // Get response text first to see what we're actually receiving
    const responseText = await response.text();
    console.log(
      "🔧 BOG Auth Response Body (first 500 chars):",
      responseText.substring(0, 500)
    );

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

    // Try to parse as JSON
    let authData;
    try {
      authData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "❌ Failed to parse BOG auth response as JSON:",
        parseError
      );
      console.error("❌ Response was:", responseText);
      throw new Error(
        `BOG returned invalid JSON: ${responseText.substring(0, 200)}`
      );
    }

    if (!authData.access_token) {
      console.error("❌ No access_token in BOG response:", authData);
      throw new Error("BOG authentication response missing access_token");
    }

    // 💾 STEP 5: Store the token in the cache
    accessTokenCache = {
      token: authData.access_token,
      expiresAt: Date.now() + (authData.expires_in || 3600) * 1000 - 60000, // Default 1 hour, refresh 1 minute early
    };

    console.log("✅ New BOG access token obtained and cached");
    console.log("🔧 Token expires in:", authData.expires_in || 3600, "seconds");

    return authData.access_token;
  } catch (error) {
    console.error("❌ Network error during BOG authentication:", error);
    throw error;
  }
};
