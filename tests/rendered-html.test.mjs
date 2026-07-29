import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships direct Gateway Tapes email access and protected library", async () => {
  const [home, authForm, library, player, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/components/ClerkAuthForm.tsx", root), "utf8"),
    readFile(new URL("app/library/page.tsx", root), "utf8"),
    readFile(new URL("app/components/GatewayPlayer.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(home, /redirect\("\/library"\)/);
  assert.match(home, /Gateway Tapes/);
  assert.match(home, /Add to Home Screen/);
  assert.match(authForm, /forceRedirectUrl="\/library"/);
  assert.match(library, /<GatewayPlayer \/>/);
  assert.match(player, /Gateway Tapes audio player/);
  assert.match(player, /GATEWAY TAPES/);
  assert.match(player, /preload="auto"/);
  assert.match(player, /onWaiting/);
  assert.match(player, /Rewind 10 seconds/);
  assert.match(player, /Fast-forward 10 seconds/);
  assert.match(layout, /Gateway Tapes — Listening Archive/);
  assert.doesNotMatch(`${home}\n${authForm}\n${library}\n${player}\n${layout}`, /Gateway Tape(?!s)/i);
});

test("ships installable PWA assets and Clerk-protected media", async () => {
  const [manifest, serviceWorker, accessStore, clerkAuth, mediaRoute, audioRoute, manualRoute, migration] = await Promise.all([
    readFile(new URL("app/manifest.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("db/access.ts", root), "utf8"),
    readFile(new URL("app/clerk-auth.ts", root), "utf8"),
    readFile(new URL("app/api/media/route.ts", root), "utf8"),
    readFile(new URL("app/api/audio/[trackId]/route.ts", root), "utf8"),
    readFile(new URL("app/api/manual/[waveId]/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0001_medical_impossible_man.sql", root), "utf8"),
    access(new URL("public/icons/gateway-tapes-192.png", root)),
    access(new URL("public/icons/gateway-tapes-512.png", root)),
    access(new URL("public/icons/apple-touch-icon.png", root)),
  ]);

  assert.match(manifest, /name: "Gateway Tapes"/);
  assert.match(manifest, /start_url: "\/library"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(serviceWorker, /startsWith\("\/api\/"\)/);
  assert.match(clerkAuth, /authenticateRequest/);
  assert.match(clerkAuth, /authorizedParties/);
  assert.match(clerkAuth, /CLERK_SECRET_KEY/);
  assert.match(clerkAuth, /cloudflare:workers/);
  assert.match(`${mediaRoute}\n${audioRoute}\n${manualRoute}`, /clerkAuthFromRequest/);
  assert.match(audioRoute, /getBoundMediaBucket/);
  assert.doesNotMatch(accessStore, /cf-access-/);
  assert.match(migration, /CREATE TABLE `gateway_users`/);
});
