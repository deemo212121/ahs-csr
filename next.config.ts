import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // jwks-rsa is pulled in transitively but is not used at runtime on Cloudflare.
  // Marking it external prevents esbuild from trying to bundle its Node.js dependencies.
  serverExternalPackages: ['jwks-rsa'],
};

export default nextConfig;
