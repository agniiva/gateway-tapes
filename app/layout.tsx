import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "Swiss Audio Player",
    description: "A strict Swiss International Style music player with functional playback controls.",
    openGraph: {
      title: "Swiss Audio Player",
      description: "Grid-first. Left-aligned. Pure minimalism.",
      images: [{ url: new URL("/og.png", base).toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Swiss Audio Player",
      description: "Grid-first. Left-aligned. Pure minimalism.",
      images: [new URL("/og.png", base).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
