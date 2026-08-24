import type { NextConfig } from "next";
import path from "path";

/**
 * LexisPredict — Next 15.5.x (lock atual)
 * engines.node 24.x no package.json (Vercel)
 */
const nextConfig: NextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["metal-fx"],
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
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  webpack: (config, { dev }) => {
    config.cache = {
      type: "filesystem",
      compression: "gzip",
      buildDependencies: {
        config: [path.join(__dirname, "next.config.ts")],
      },
    };
    if (!dev) {
      config.infrastructureLogging = { level: "error" };
    }
    return config;
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://vercel.live https://cdn.jsdelivr.net",
            "worker-src 'self' blob: https://cdn.jsdelivr.net",
            "child-src 'self' blob:",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https:",
            "font-src 'self' https://fonts.gstatic.com data:",
            "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.x.ai https://api.groq.com https://api.anthropic.com https://openrouter.ai https://*.vercel.app https://vercel.live https://cdn.jsdelivr.net https://tessdata.projectnaptha.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
          ].join("; "),
        },
      ],
    },
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
    ],
  },
};

export default nextConfig;
