/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure server-only PDF parsing libs are loaded from node_modules at runtime
    // (not bundled into Next server chunks, which can break pdfjs dependencies).
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  webpack(config) {
    // Defensive: some PDF libs pull optional native deps during bundling.
    // We do not use canvas in this app, so mark them as unavailable.
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
