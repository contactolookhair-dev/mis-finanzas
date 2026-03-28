/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  webpack(config) {
    if (!config.resolve) config.resolve = {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      canvas: false
    };
    return config;
  }
};

export default nextConfig;
