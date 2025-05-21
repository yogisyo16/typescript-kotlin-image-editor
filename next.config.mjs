/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub Node.js modules in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, // Ignore fs module
        path: false, // Ignore path module (if used)
        util: false, // Ignore util module (if used)
      };
    }
    return config;
  },
};

export default nextConfig;