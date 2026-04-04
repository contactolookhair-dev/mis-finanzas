/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 🔥 IMPORTANTE: agregamos Prisma aquí
    serverComponentsExternalPackages: ["pdf-parse", "@prisma/client", "prisma"],
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
      "@napi-rs/canvas": false,
    };
    return config;
  },
};

export default nextConfig;