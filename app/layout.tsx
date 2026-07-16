import type { Metadata } from "next";
import localFont from "next/font/local";
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
      <body className="min-h-full bg-bg text-text">{children}</body>
    </html>
  );
}
