import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Slate — Back office for tutors",
    short_name: "Slate",
    description: "The back office that runs the money side of independent tutoring.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f7",
    theme_color: "#5f728c",
    icons: [
      {
        src: "/brand/logo/favicon-256.png",
        sizes: "256x256",
        type: "image/png",
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
