'use client';

import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from 'capacitor-native-biometric';

// Biometrics here only ever gate the login screen itself — not an app-wide
// re-lock. Enabling it stores the account's email/password in the OS's own
// secure credential store (Android Keystore / iOS Keychain) via the plugin,
// never on our servers; a fingerprint/face check unlocks that stored
// credential and logs in with it exactly like typing it would.
const CREDENTIAL_SERVER = 'ushs-portal-login';

function isNative() {
  return Capacitor.isNativePlatform();
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function hasBiometricLoginEnabled(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await NativeBiometric.getCredentials({ server: CREDENTIAL_SERVER });
    return true;
  } catch {
    return false;
  }
}

export async function enableBiometricLogin(email: string, password: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await NativeBiometric.verifyIdentity({
      title: 'Enable Fingerprint Login',
      reason: 'Confirm it’s you to enable fingerprint/face login',
    });
    await NativeBiometric.setCredentials({ username: email, password, server: CREDENTIAL_SERVER });
    return true;
  } catch {
    return false;
  }
}

export async function disableBiometricLogin(): Promise<void> {
  if (!isNative()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: CREDENTIAL_SERVER });
  } catch {
    // Nothing was stored — fine.
  }
}

export async function loginWithBiometric(): Promise<{ email: string; password: string } | null> {
  if (!isNative()) return null;
  try {
    await NativeBiometric.verifyIdentity({
      title: 'Log in',
      reason: 'Confirm it’s you to log in',
    });
    const creds = await NativeBiometric.getCredentials({ server: CREDENTIAL_SERVER });
    return { email: creds.username, password: creds.password };
  } catch {
    return null;
  }
}

export { isNative as isNativePlatform };
