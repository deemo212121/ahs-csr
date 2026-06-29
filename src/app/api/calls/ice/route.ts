import { NextResponse } from 'next/server';
import type { IceServerConfig, IceServersResponse } from '@/lib/calls/types';

function parseIceServersJson(value?: string) {
  if (!value?.trim()) return null;
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error('METERED_TURN_ICE_SERVERS_JSON must be a JSON array.');
  return parsed as IceServerConfig[];
}

function buildStaticMeteredServers() {
  const username = process.env.METERED_TURN_USERNAME?.trim();
  const credential = process.env.METERED_TURN_CREDENTIAL?.trim() || process.env.METERED_TURN_PASSWORD?.trim();
  const host = process.env.METERED_TURN_HOST?.trim();

  if (!username || !credential || !host) return null;

  // Some providers (e.g. ExpressTurn) hand out a host string that already
  // includes the port (host:port), and only listen on that exact port —
  // unlike Metered's relay, which answers on 80/443 too. Use it as-is rather
  // than appending additional ports that may not exist on that server.
  if (host.includes(':')) {
    return [
      { urls: `stun:${host}` },
      { urls: `turn:${host}`, username, credential },
      { urls: `turn:${host}?transport=tcp`, username, credential },
    ] satisfies IceServerConfig[];
  }

  return [
    { urls: `stun:${host}` },
    { urls: `turn:${host}:80`, username, credential },
    { urls: `turn:${host}:443`, username, credential },
    { urls: `turns:${host}:443`, username, credential },
  ] satisfies IceServerConfig[];
}

async function fetchMeteredRestServers() {
  const baseUrl = process.env.METERED_TURN_REST_URL?.trim();
  const apiKey = process.env.METERED_TURN_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;

  const url = new URL(baseUrl);
  if (!url.searchParams.has('apiKey')) url.searchParams.set('apiKey', apiKey);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Metered TURN credential request failed with ${response.status}.`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Metered TURN API did not return an ICE server array.');
  return data as IceServerConfig[];
}

export async function GET() {
  try {
    const jsonServers = parseIceServersJson(process.env.METERED_TURN_ICE_SERVERS_JSON);
    if (jsonServers?.length) {
      return NextResponse.json({
        iceServers: jsonServers,
        provider: 'static',
        configured: true,
      } satisfies IceServersResponse);
    }

    const meteredRestServers = await fetchMeteredRestServers();
    if (meteredRestServers?.length) {
      return NextResponse.json({
        iceServers: meteredRestServers,
        provider: 'metered',
        configured: true,
      } satisfies IceServersResponse);
    }

    const staticServers = buildStaticMeteredServers();
    if (staticServers?.length) {
      return NextResponse.json({
        iceServers: staticServers,
        provider: 'static',
        configured: true,
      } satisfies IceServersResponse);
    }

    return NextResponse.json({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      provider: 'fallback',
      configured: false,
      message: 'Metered TURN is not configured yet. Add METERED_TURN_ICE_SERVERS_JSON or METERED_TURN_REST_URL + METERED_TURN_API_KEY to .env.local.',
    } satisfies IceServersResponse);
  } catch (error) {
    return NextResponse.json(
      {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        provider: 'fallback',
        configured: false,
        message: error instanceof Error ? error.message : 'Unable to load ICE servers.',
      } satisfies IceServersResponse,
      { status: 200 },
    );
  }
}
