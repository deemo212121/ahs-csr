import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function serviceAccountFromEnv() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return JSON.parse(json);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

let cachedAdminApp: App | null = null;
let cachedAdminAuth: Auth | null = null;

export function getFirebaseAdminApp() {
  if (cachedAdminApp) return cachedAdminApp;

  const existingApp = getApps()[0];
  if (existingApp) {
    cachedAdminApp = existingApp;
    return cachedAdminApp;
  }

  const serviceAccount = serviceAccountFromEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();

  if (!serviceAccount && !projectId) {
    throw new Error(
      'Missing Firebase project configuration. Add FIREBASE_PROJECT_ID, or add a complete Firebase service account, to .env.local.',
    );
  }

  // ID-token verification only needs the Firebase project ID and Google's public
  // signing certificates. A service-account credential remains available for any
  // future Firebase Admin operations that require privileged API access.
  cachedAdminApp = serviceAccount
    ? initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.projectId })
    : initializeApp({ projectId });
  return cachedAdminApp;
}

export function getFirebaseAdminAuth() {
  cachedAdminAuth ??= getAuth(getFirebaseAdminApp());
  return cachedAdminAuth;
}
