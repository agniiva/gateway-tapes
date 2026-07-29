import { createClerkClient } from "@clerk/backend";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";

type GatewayAuth = { userId: string | null };
type ClerkWorkerEnv = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
};

export function clerkRuntimeConfiguration() {
  const workerEnv = env as unknown as ClerkWorkerEnv;
  return {
    publishableKey: workerEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: workerEnv.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY,
  };
}

function clerkClient() {
  const { secretKey, publishableKey } = clerkRuntimeConfiguration();
  if (!secretKey || !publishableKey) return null;
  return createClerkClient({ secretKey, publishableKey });
}

export async function clerkAuthFromRequest(request: Request): Promise<GatewayAuth> {
  const clerk = clerkClient();
  if (!clerk) return { userId: null };

  try {
    const requestState = await clerk.authenticateRequest(request, {
      authorizedParties: [new URL(request.url).origin],
    });
    if (!requestState.isAuthenticated) return { userId: null };
    return { userId: requestState.toAuth().userId };
  } catch {
    return { userId: null };
  }
}

export async function clerkAuthFromServerComponent() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return clerkAuthFromRequest(new Request(`${protocol}://${host}`, { headers: requestHeaders }));
}

export async function clerkPrimaryEmail(userId: string) {
  const clerk = clerkClient();
  if (!clerk) throw new Error("Clerk is not configured.");
  const user = await clerk.users.getUser(userId);
  return user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress
    ?? user.emailAddresses[0]?.emailAddress
    ?? null;
}
