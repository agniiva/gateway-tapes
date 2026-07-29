"use client";

import posthog from "posthog-js";

export type GatewayAnalyticsEvent =
  | "archive_loaded"
  | "library_opened"
  | "manual_opened"
  | "playback_buffering"
  | "playback_completed"
  | "playback_error"
  | "playback_paused"
  | "playback_seeked"
  | "playback_skipped"
  | "playback_started"
  | "session_selected"
  | "session_shared"
  | "favorite_toggled"
  | "autoplay_toggled"
  | "wave_selected";

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

let initialized = false;

export function initAnalytics() {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (initialized || typeof window === "undefined" || !projectToken) return Boolean(projectToken);

  posthog.init(projectToken, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: "localStorage",
    person_profiles: "identified_only",
  });
  initialized = true;
  return true;
}

export function analyticsEnabled() {
  return initialized;
}

export function captureAnalytics(event: GatewayAnalyticsEvent, properties?: AnalyticsProperties) {
  if (!initialized && !initAnalytics()) return;
  posthog.capture(event, properties);
}

export { posthog };
