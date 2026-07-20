import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = localFont({
  src: "../public/brand/fonts/Inter-Variable.ttf",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const interTight = localFont({
  src: "../public/brand/fonts/InterTight-Variable.ttf",
  variable: "--font-inter-tight",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Slate",
  description: "The back office that runs the money side of independent tutoring.",
  // Renders the apple-mobile-web-app-* meta tags iOS Safari needs to open
  // an "Add to Home Screen" install as a standalone app shell (no browser
  // chrome/URL bar) instead of just a bookmarked tab — the web app manifest
  // (app/manifest.ts) alone isn't enough on iOS the way it is on Android.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Slate",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 'cover' extends content under the notch/home-indicator safe areas on
  // an installed standalone app (no Safari chrome to absorb them) — the
  // app itself is responsible for safe-area padding where it matters.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f7" },
    { media: "(prefers-color-scheme: dark)", color: "#161616" },
  ],
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    // Falls back to the pre-rebrand key so an existing user's saved theme
    // choice survives the 'tutortool-theme' -> 'slate-theme' rename instead
    // of silently reverting to the OS preference.
    var stored = localStorage.getItem('slate-theme') || localStorage.getItem('tutortool-theme');
    if (stored) localStorage.setItem('slate-theme', stored);
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-bg text-text">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
