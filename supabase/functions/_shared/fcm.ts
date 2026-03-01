function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id: string;
}

export async function getFcmAccessToken(
  serviceAccountJson: string
): Promise<{ accessToken: string; projectId: string }> {
  const sa: ServiceAccount = JSON.parse(serviceAccountJson);

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeString(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  );
  const payload = base64UrlEncodeString(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );

  const signingInput = `${header}.${payload}`;

  const pemContents = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenResponse = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`FCM token exchange failed: ${tokenResponse.status} ${body}`);
  }

  const { access_token } = await tokenResponse.json();
  return { accessToken: access_token, projectId: sa.project_id };
}

interface FcmSendParams {
  accessToken: string;
  projectId: string;
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendFcmNotification(
  params: FcmSendParams
): Promise<{ success: boolean; status: number; errorCode?: string }> {
  const { accessToken, projectId, deviceToken, title, body, data } = params;

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message: Record<string, unknown> = {
    token: deviceToken,
    notification: { title, body },
    android: {
      priority: "high",
      notification: { sound: "default", channel_id: "default" },
    },
  };

  if (data) {
    message.data = data;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    console.error(
      `FCM response: status=${response.status} body=${responseBody} token=${deviceToken.slice(0, 12)}...`
    );
    let errorCode: string | undefined;
    try {
      const parsed = JSON.parse(responseBody);
      errorCode = parsed?.error?.details?.[0]?.errorCode || parsed?.error?.status;
    } catch {
      // ignore parse error
    }
    return { success: false, status: response.status, errorCode };
  }

  return { success: true, status: response.status };
}

export function isFcmTokenInvalid(status: number, errorCode?: string): boolean {
  if (status === 404) return true;
  if (status === 400 && errorCode === "INVALID_ARGUMENT") return true;
  if (errorCode === "UNREGISTERED") return true;
  return false;
}
