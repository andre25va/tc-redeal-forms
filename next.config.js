/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'nodemailer'],
  },
  webpack: (config) => {
    // pdfjs-dist tries to resolve 'canvas' — ignore it in all builds
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
}
module.exports = nextConfig
