"use client";

import { ClerkProvider } from "@clerk/react";

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
      {children}
    </ClerkProvider>
  );
}
