import { BOG_AUTH_URL, getMockBOGToken, MOCK_MODE } from "../payments"

interface BOGAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}


export const getBOGAccessToken = async (): Promise<string> => {
  if (MOCK_MODE) {
    return getMockBOGToken()
  }

  const clientId = process.env.BOG_CLIENT_ID!
  const clientSecret = process.env.BOG_CLIENT_SECRET!

  if (!clientId || !clientSecret) {
    throw new Error("BOG_CLIENT_ID and BOG_CLIENT_SECRET must be set in environment variables")
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch(BOG_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  })

  if (!response.ok) {
    throw new Error(`BOG Auth failed: ${response.statusText}`)
  }

  const data: BOGAuthResponse = await response.json()
  return data.access_token
}









