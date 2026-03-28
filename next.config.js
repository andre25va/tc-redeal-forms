/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'nodemailer'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdfjs-dist tries to resolve 'canvas' on the server — ignore it
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
}
module.exports = nextConfig
