import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  // Evita que el navegador adivine el Content-Type (MIME sniffing)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prohíbe incrustar la app en iframes externos (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Fuerza HTTPS durante 1 año; incluye subdominios
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Impide filtrar el Referer al navegar a dominios externos
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permisos de APIs del navegador: solo cámara y geolocalización para la PWA
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  // CSP: fuentes permitidas para scripts, estilos e imágenes
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Supabase realtime y auth
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://*.ingest.sentry.io",
      // Scripts: propio + inline eval que usa Next.js en dev
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Estilos: propio + inline (Tailwind JIT)
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: propio + data URIs + Supabase Storage
      "img-src 'self' data: blob: https://*.supabase.co",
      // Fuentes propias únicamente
      "font-src 'self'",
      // Iframes prohibidos (Google Maps, etc. pueden añadirse aquí)
      "frame-src 'none'",
      // Worker scripts para PWA service worker
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplicar a todas las rutas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  disableLogger: true,
});
