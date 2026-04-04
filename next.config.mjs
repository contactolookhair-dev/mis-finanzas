/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 🔥 IMPORTANTE: agregamos Prisma aquí
    serverComponentsExternalPackages: ["pdf-parse", "@prisma/client", "prisma"],
    // Ensure Prisma engines are shipped with serverless functions (incl. NextAuth).
    outputFileTracingIncludes: {
      "/api/auth/[...nextauth]": [
        "./node_modules/.prisma/**",
        "./node_modules/@prisma/**",
        "./src/server/db/auth-prisma-client/**"
      ]
    }
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
