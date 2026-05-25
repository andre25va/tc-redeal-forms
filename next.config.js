/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'nodemailer'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pdfjs-dist optionally requires 'canvas' for Node.js usage.
      // In the browser we use the native Canvas API, so tell webpack to ignore it.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
}
module.exports = nextConfig
