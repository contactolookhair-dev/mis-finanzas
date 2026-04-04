/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "pdf-parse"],
    outputFileTracingIncludes: {
      "/api/auth/[...nextauth]": [
        "./node_modules/.prisma/**",
        "./node_modules/@prisma/**",
        "./src/server/db/auth-prisma-client/**"
      ],
      // Extra keys for Next/Vercel entry resolution across versions.
      "src/app/api/auth/[...nextauth]/route": [
        "./src/server/db/auth-prisma-client/**",
        "./node_modules/.prisma/**",
        "./node_modules/@prisma/**"
      ],
      "app/api/auth/[...nextauth]/route": [
        "./src/server/db/auth-prisma-client/**",
        "./node_modules/.prisma/**",
        "./node_modules/@prisma/**"
      ]
    }
  },

  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
      "@napi-rs/canvas": false
    };
    return config;
  }
};

export default nextConfig;
