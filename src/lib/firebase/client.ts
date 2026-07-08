'use client';

import { initializeApp, getApps } from 'firebase/app';
import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';

const requiredValues = [
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
];

export const isFirebaseConfigured = requiredValues.every((value) => value && value.trim().length > 0);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

// getAuth()'s default persistence is auto-detected, and that detection can
// misfire in a Capacitor WebView (or restrictive/partitioned storage
// contexts) — falling back to in-memory, session-only persistence and
// forcing a fresh login every time the app/browser is closed and reopened.
// Being explicit about the persistence chain (IndexedDB, then localStorage)
// avoids relying on that auto-detection.
function createFirebaseAuth() {
  if (!firebaseApp) return null;
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    // Already initialized for this app (e.g. Next.js Fast Refresh
    // re-running this module) — reuse the existing instance.
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createFirebaseAuth();
