import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the Gateway Tapes access welcome and protected library", async () => {
  const [home, welcome, library, player, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/components/AccessWelcome.tsx", root), "utf8"),
    readFile(new URL("app/library/page.tsx", root), "utf8"),
    readFile(new URL("app/components/GatewayPlayer.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(home, /<AccessWelcome \/>/);
  assert.match(welcome, /Gateway Tapes/);
  assert.match(welcome, /ENTER THE ARCHIVE/);
  assert.match(welcome, /Add to Home Screen/);
  assert.match(welcome, /marketingConsent/);
  assert.match(library, /<GatewayPlayer \/>/);
  assert.match(player, /Gateway Tapes audio player/);
  assert.match(player, /GATEWAY TAPES/);
  assert.match(layout, /Gateway Tapes — Listening Archive/);
  assert.doesNotMatch(`${home}\n${welcome}\n${library}\n${player}\n${layout}`, /Gateway Tape(?!s)/i);
});

test("ships installable PWA assets and the verified-email store", async () => {
  const [manifest, serviceWorker, accessStore, migration] = await Promise.all([
    readFile(new URL("app/manifest.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("db/access.ts", root), "utf8"),
    readFile(new URL("drizzle/0001_medical_impossible_man.sql", root), "utf8"),
    access(new URL("public/icons/gateway-tapes-192.png", root)),
    access(new URL("public/icons/gateway-tapes-512.png", root)),
    access(new URL("public/icons/apple-touch-icon.png", root)),
  ]);

  assert.match(manifest, /name: "Gateway Tapes"/);
  assert.match(manifest, /start_url: "\/library"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(serviceWorker, /startsWith\("\/api\/"\)/);
  assert.match(accessStore, /cf-access-authenticated-user-email/);
  assert.match(accessStore, /cf-access-jwt-assertion/);
  assert.match(migration, /CREATE TABLE `gateway_users`/);
});
