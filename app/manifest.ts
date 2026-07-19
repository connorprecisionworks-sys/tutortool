import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Slate — Back office for tutors",
    short_name: "Slate",
    description: "The back office that runs the money side of independent tutoring.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // Matches the app's own light background rather than the slate-blue
    // accent — Slate's chrome is monochrome (no colored header bar), so a
    // blue splash/toolbar would clash with every screen the launch
    // transitions into.
    background_color: "#f7f7f7",
    theme_color: "#f7f7f7",
    icons: [
      {
        src: "/brand/logo/favicon-256.png",
        sizes: "256x256",
        type: "image/png",
      },
      // Same SVG mark, once as a plain icon (purpose "any" — rendered as-is,
      // no safe-zone cropping) and once flagged "maskable" for launchers
      // that apply their own icon shape/mask — without a dedicated "any"
      // entry, a maskable-only SVG can get cropped even where masking
      // isn't wanted.
      {
        src: "/brand/logo/slate-icon-slate.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/brand/logo/slate-icon-slate.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
