import * as Crypto from "expo-crypto";

export async function sourceFingerprint(content: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, content);
}
export async function importId(
  babyId: string,
  fingerprint: string
): Promise<string> {
  const hash = await sourceFingerprint(
    JSON.stringify([babyId, "huckleberry", fingerprint])
  );
  const variant = ((Number.parseInt(hash[16], 16) & 3) | 8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
