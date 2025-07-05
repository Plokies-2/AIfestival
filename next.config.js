/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable for development to prevent double SSE connections
  serverExternalPackages: ['tensorflow'],
  webpack: (config, { isServer }) => {
    // Handle node modules that need to be external
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
