function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

export async function createApnsJwt(
  teamId: string,
  keyId: string,
  privateKeyPem: string
): Promise<string> {
  const header = base64UrlEncodeString(
    JSON.stringify({ alg: "ES256", kid: keyId })
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncodeString(
    JSON.stringify({ iss: teamId, iat: now })
  );

  const signingInput = `${header}.${payload}`;

  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSig = base64UrlEncode(new Uint8Array(signature));

  return `${signingInput}.${encodedSig}`;
}

export function buildLiveActivityEndRequest(options: {
  deviceToken: string;
  jwt: string;
  isSandbox: boolean;
  timestamp: number;
  dismissalDate: number;
  contentState: Record<string, unknown>;
}): { url: string; init: RequestInit } {
  const host = options.isSandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  return {
    url: `https://${host}/3/device/${options.deviceToken}`,
    init: {
      method: "POST",
      headers: {
        authorization: `bearer ${options.jwt}`,
        "apns-push-type": "liveactivity",
        "apns-priority": "10",
        "apns-topic": "com.sofibaby.app.push-type.liveactivity",
        "content-type": "application/json",
      },
      body: JSON.stringify({ aps: {
        timestamp: options.timestamp, event: "end",
        "dismissal-date": options.dismissalDate,
        "content-state": options.contentState,
      }}),
      signal: AbortSignal.timeout(10000),
    },
  };
}
