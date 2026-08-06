import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: [
    "tesseract.js",
    "pdfjs-dist",
    "pdf-parse",
    "@opentelemetry/sdk-node",
    "@opentelemetry/api",
    "@opentelemetry/exporter-jaeger",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/instrumentation",
    "cheerio",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Cache webpack em disco — builds locais/CI mais estáveis
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: "filesystem",
        buildDependencies: {
          config: [path.join(__dirname, "next.config.ts")],
        },
      };
    } else {
      // Produção: cache filesystem reduz serialização de strings grandes
      config.cache = {
        type: "filesystem",
        compression: "gzip",
      };
    }
    return config;
  },
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
