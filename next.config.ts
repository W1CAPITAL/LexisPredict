import type { NextConfig } from "next";
import path from "path";

/**
 * Next.js 16.3.1 — LexisPredict
 * - `eslint` removido do next.config (não existe mais em Next 16)
 * - Build de produção usa Webpack explicitamente (`next build --webpack`)
 *   porque há custom webpack; Turbopack no `next dev` continua ok
 * - `turbopack: {}` silencia conflito se alguém rodar build sem flag
 */
const nextConfig: NextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  typescript: {
    // typecheck no CI via `npm run typecheck`; build não deve falhar por dívida de tipos
    ignoreBuildErrors: true,
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
  // Next 16: Turbopack default no build — declarar bloco vazio + script --webpack
  turbopack: {},
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
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
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
