/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'nodemailer'],
  },
  webpack: (config, { webpack }) => {
    // pdfjs-dist optionally requires 'canvas' for Node.js rendering.
    // We use browser native canvas, so suppress this optional dependency
    // to prevent build failures on both server and client bundles.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^canvas$/,
        contextRegExp: /pdfjs-dist/,
      })
    );
    return config;
  },
}
module.exports = nextConfig
