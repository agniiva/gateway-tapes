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
    title: "Gateway Tapes — Private Audio Library",
    description: "A mobile-first, stateful listening library for the six waves of the Gateway Experience.",
    openGraph: {
      title: "Gateway Tapes",
      description: "Six waves. Thirty-six sessions. One focused listening system.",
    },
    twitter: {
      card: "summary",
      title: "Gateway Tapes",
      description: "Six waves. Thirty-six sessions. One focused listening system.",
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
