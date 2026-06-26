/**
 * Cloudflare Workers-compatible Firebase ID token verifier.
 * Replaces firebase-admin (which requires Node.js APIs not available in workerd).
 * Uses the Web Crypto API and Google's public JWKS endpoint directly.
 */

const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface JWK {
  kid: string;
  n: string;
  e: string;
  kty: string;
  alg: string;
  use: string;
}

interface JWKS {
  keys: JWK[];
}

// Simple in-memory cache for public keys (keyed by kid)
let cachedKeys: Map<string, CryptoKey> | null = null;
let keyCacheExpiry = 0;

async function getPublicKeys(): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  if (cachedKeys && now < keyCacheExpiry) return cachedKeys;

  const res = await fetch(GOOGLE_JWKS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch Firebase public keys: ${res.status}`);

  // Honour Cache-Control max-age so we don't hammer Google's endpoint
  const cacheControl = res.headers.get('cache-control') ?? '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3_600_000;

  const jwks: JWKS = await res.json();
  const keyMap = new Map<string, CryptoKey>();

  for (const jwk of jwks.keys) {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    keyMap.set(jwk.kid, key);
  }

  cachedKeys = keyMap;
  keyCacheExpiry = now + maxAge;
  return keyMap;
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export interface DecodedFirebaseToken {
  uid: string;
  email: string | undefined;
  email_verified: boolean;
  aud: string;
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

/**
 * Verifies a Firebase ID token using Google's public JWKS.
 * Compatible with Cloudflare Workers / Edge runtime.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedFirebaseToken> {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error(
      'Missing Firebase project configuration. Add FIREBASE_PROJECT_ID to your environment.',
    );
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format.');

  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64)),
  ) as DecodedFirebaseToken;

  // Validate claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Firebase ID token has expired.');
  if (payload.iat > now + 300) throw new Error('Firebase ID token issued in the future.');
  if (payload.aud !== projectId)
    throw new Error(`Firebase ID token audience mismatch. Expected: ${projectId}`);
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error('Firebase ID token issuer mismatch.');
  if (!payload.sub) throw new Error('Firebase ID token missing subject (uid).');

  // Verify signature
  const keys = await getPublicKeys();
  const key = keys.get(header.kid);
  if (!key) throw new Error(`No public key found for kid: ${header.kid}`);

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64).buffer as ArrayBuffer;

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingInput.buffer as ArrayBuffer);
  if (!valid) throw new Error('Firebase ID token signature verification failed.');

  return { ...payload, uid: payload.sub };
}

/**
 * Compatibility shim — returns an object with a verifyIdToken method
 * so existing call-sites (`getFirebaseAdminAuth().verifyIdToken(token)`) still work.
 */
export function getFirebaseAdminAuth() {
  return {
    verifyIdToken: verifyFirebaseIdToken,
  };
}
