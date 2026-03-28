/** @type {import('next').NextConfig} */
const nextConfig = {
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
