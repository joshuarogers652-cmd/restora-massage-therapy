import crypto from "node:crypto";
import { HttpError } from "../errors";

/**
 * Field-level encryption for health and clinical content (AES-256-GCM).
 * DATA_ENCRYPTION_KEY = base64 of 32 random bytes. Without it, the API refuses
 * to store or read sensitive records (fails closed).
 * Format: v1:<iv b64>:<auth tag b64>:<ciphertext b64>
 */
function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new HttpError(503, "ENCRYPTION_NOT_CONFIGURED", "Secure storage is not configured yet (DATA_ENCRYPTION_KEY).");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new HttpError(503, "ENCRYPTION_KEY_INVALID", "DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded.");
  return k;
}

export function encryptionConfigured() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

export function decryptJson<T = unknown>(payload: string): T {
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unsupported encrypted payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}

export function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function randomCode(groups = 4, size = 4) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(groups * size);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return Array.from({ length: groups }, (_, i) => chars.slice(i * size, (i + 1) * size).join("")).join("-");
}
