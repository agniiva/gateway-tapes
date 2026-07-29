import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { clerkRuntimeConfiguration } from "./clerk-auth";
import ClerkClientProvider from "./components/ClerkClientProvider";
import PwaRegistration from "./components/PwaRegistration";

export const viewport: Viewport = {
  themeColor: "#6541a5",
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "Gateway Tapes — Listening Archive",
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
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icons/gateway-tapes-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/gateway-tapes-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Gateway Tapes",
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { publishableKey } = clerkRuntimeConfiguration();
  const content = <>{children}<PwaRegistration /></>;

  return (
    <html lang="en">
      <body>
        {publishableKey
          ? <ClerkClientProvider publishableKey={publishableKey}>{content}</ClerkClientProvider>
          : content}
      </body>
    </html>
  );
}
