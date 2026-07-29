import { env } from "cloudflare:workers";

type AccessEnv = { DB: D1Database };

let schemaReady: Promise<unknown> | null = null;

function getAccessDb() {
  const bindings = env as unknown as Partial<AccessEnv>;
  if (!bindings.DB) throw new Error("Access storage is unavailable.");
  return bindings.DB;
}

export function ensureAccessSchema() {
  const DB = getAccessDb();
  schemaReady ??= DB.prepare(`
    CREATE TABLE IF NOT EXISTS gateway_users (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      marketing_consent INTEGER NOT NULL DEFAULT 0,
      consent_updated_at TEXT
    )
  `).run();
  return schemaReady;
}

export function authenticatedEmail(request: Request) {
  const accessEmail = request.headers.get("cf-access-authenticated-user-email");
  const accessAssertion = request.headers.get("cf-access-jwt-assertion");
  const workspaceEmail = request.headers.get("oai-authenticated-user-email");
  const email = accessEmail && accessAssertion ? accessEmail : workspaceEmail;
  const normalized = email?.trim().toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export async function registerGatewayUser(email: string, marketingConsent?: boolean) {
  await ensureAccessSchema();
  const DB = getAccessDb();

  if (typeof marketingConsent === "boolean") {
    await DB.prepare(`
      INSERT INTO gateway_users (email, marketing_consent, consent_updated_at)
      VALUES (?1, ?2, CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET
        last_seen_at = CURRENT_TIMESTAMP,
        marketing_consent = excluded.marketing_consent,
        consent_updated_at = CURRENT_TIMESTAMP
    `).bind(email, marketingConsent ? 1 : 0).run();
    return;
  }

  await DB.prepare(`
    INSERT INTO gateway_users (email)
    VALUES (?1)
    ON CONFLICT(email) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
  `).bind(email).run();
}
