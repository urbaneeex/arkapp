import type { NextConfig } from "next";

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
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com",
      // Scripts: propio + inline eval que usa Next.js en dev
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Estilos: propio + inline (Tailwind JIT)
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: propio + data URIs + Supabase Storage
      "img-src 'self' data: blob: https://*.supabase.co",
      // Fuentes: solo propio (Clash Display y Space Grotesk self-hosted / next/font)
      "font-src 'self' data:",
      // Iframes prohibidos (Google Maps, etc. pueden añadirse aquí)
      "frame-src 'none'",
      // Worker scripts para PWA service worker
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Menos JS transferido: importar solo módulos usados de paquetes con muchos subpaths
  // (lucide: docenas de iconos; date-fns: muchas funciones; RBC: tipos/exports).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
    ],
  },
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

export default nextConfig;
