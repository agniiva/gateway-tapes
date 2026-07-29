import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gateway Tapes",
    short_name: "Gateway Tapes",
    description: "A focused mobile listening archive for six Gateway Experience waves.",
    start_url: "/library",
    scope: "/",
    display: "standalone",
    background_color: "#dedee8",
    theme_color: "#6541a5",
    orientation: "portrait",
    icons: [
      { src: "/icons/gateway-tapes-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/gateway-tapes-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/gateway-tapes-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
