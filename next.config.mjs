/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;