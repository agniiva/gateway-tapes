"use client";

import { ClerkProvider } from "@clerk/react";
import AnalyticsProvider from "./AnalyticsProvider";

export default function ClerkClientProvider({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/library"
      signUpFallbackRedirectUrl="/library"
    >
      <AnalyticsProvider>{children}</AnalyticsProvider>
    </ClerkProvider>
  );
}
