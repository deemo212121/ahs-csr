/**
 * Cloudflare Workers-compatible, READ-ONLY Firestore REST client.
 * Only ever used to look up companies/{slug} for /login/[companyId]
 * validation and registration company assignment — never writes anything.
 *
 * The standard firebase-admin / firebase/firestore SDKs don't run on the
 * Workers runtime (same reason Firebase Auth verification here is
 * hand-rolled in ./admin.ts) — this signs its own service-account JWT,
 * exchanges it for a Google OAuth2 access token, and calls Firestore's
 * plain REST API with fetch.
 */

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function normalizePrivateKey(raw: string): string {
  // .env files can't hold real newlines in a single-line value — the key is
  // stored with literal "\n" escape sequences and unescaped here.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

let cachedSigningKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedSigningKey) return cachedSigningKey;

  const privateKeyPem = process.env.FIRESTORE_PRIVATE_KEY;
  if (!privateKeyPem) throw new Error('Missing FIRESTORE_PRIVATE_KEY.');

  const keyData = pemToArrayBuffer(normalizePrivateKey(privateKeyPem));
  cachedSigningKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return cachedSigningKey;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now) return cachedAccessToken.token;

  const clientEmail = process.env.FIRESTORE_CLIENT_EMAIL;
  if (!clientEmail) throw new Error('Missing FIRESTORE_CLIENT_EMAIL.');

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    // Firestore's documented OAuth scope — the default Firebase Admin SDK
    // service account already has the IAM role needed for this.
    scope: 'https://www.googleapis.com/auth/datastore',
    iat,
    exp,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to get Google access token: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so a cached token is never presented right at expiry.
  cachedAccessToken = { token: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

type FirestoreFieldValue = Record<string, unknown>;

function unwrapFirestoreValue(value: FirestoreFieldValue | undefined): unknown {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue as string);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  return undefined;
}

export type FirestoreCompany = {
  companyName: string;
  erCompanyId: string;
  isActive: boolean;
};

// Read-only lookup of companies/{slug}. Returns null if the document
// doesn't exist, or if it exists but has no erCompanyId (not usable for
// tenant assignment without that link field).
export async function getCompanyBySlug(slug: string): Promise<FirestoreCompany | null> {
  const projectId = process.env.FIRESTORE_PROJECT_ID;
  if (!projectId) throw new Error('Missing FIRESTORE_PROJECT_ID.');

  const accessToken = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/companies/${encodeURIComponent(slug)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Firestore lookup failed: ${response.status} ${text}`);
  }

  const doc = (await response.json()) as { fields?: Record<string, FirestoreFieldValue> };
  const fields = doc.fields ?? {};

  const companyName = unwrapFirestoreValue(fields.companyName) as string | undefined;
  const erCompanyId = unwrapFirestoreValue(fields.erCompanyId) as string | undefined;
  const isActive = unwrapFirestoreValue(fields.isActive) as boolean | undefined;

  if (!erCompanyId) return null;

  return {
    companyName: companyName || slug,
    erCompanyId,
    isActive: isActive !== false,
  };
}
