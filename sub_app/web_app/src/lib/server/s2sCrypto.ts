import crypto from "node:crypto";

export type S2SEncryptedPayload = {
  nonce: string;
  data: string;
};

function getS2SKey(): Buffer {
  const raw = process.env.S2S_KEY;
  if (!raw) {
    throw new Error("S2S_KEY is not set");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("S2S_KEY must be base64 and decode to 32 bytes");
  }

  return key;
}

// Server-side helper for encrypting callback payload before sending it to Go API.
export function encryptS2SCallbackPayload(payload: unknown): S2SEncryptedPayload {
  const key = getS2SKey();
  const nonce = crypto.randomBytes(12);

  const plain = Buffer.from(
    JSON.stringify({
      ts: Math.floor(Date.now() / 1000),
      payload,
    }),
    "utf8"
  );

  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]);

  return {
    nonce: nonce.toString("base64"),
    data: ciphertext.toString("base64"),
  };
}
