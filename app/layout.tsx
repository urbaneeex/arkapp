import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SonnerToaster } from "@/components/ui/sonner-toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Arkapp",
    template: "%s - Arkapp",
  },
  description: "Gestiona citas, clientes y servicios de cualquier tipo de negocio",
  icons: {
    icon: "/logo%20arkapp%20final.svg",
    shortcut: "/logo%20arkapp%20final.svg",
    apple: "/logo%20arkapp%20final.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('arkapp-theme');t=t==='light'||t==='dark'?t:'dark';document.documentElement.classList.remove('dark','light');document.documentElement.classList.add(t);})();`,
          }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} font-sans antialiased bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}
      >
        <ThemeProvider>
          <SessionGuard>
            {children}
            <SonnerToaster />
            <SpeedInsights />
            <Analytics />
          </SessionGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
