"use client";

import { useUser } from "@clerk/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { initAnalytics, posthog } from "../analytics";

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, user } = useUser();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!initAnalytics() || !pathname) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  useEffect(() => {
    if (!isLoaded || !initAnalytics()) return;

    if (user) {
      const email = user.primaryEmailAddress?.emailAddress;
      posthog.identify(user.id, {
        email,
        name: user.fullName ?? undefined,
      });
      identifiedUserId.current = user.id;
      return;
    }

    if (identifiedUserId.current) {
      posthog.reset();
      identifiedUserId.current = null;
    }
  }, [isLoaded, user]);

  return children;
}
