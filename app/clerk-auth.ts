import { createClerkClient } from "@clerk/backend";
import { headers } from "next/headers";

type GatewayAuth = { userId: string | null };

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) return null;
  return createClerkClient({ secretKey, publishableKey });
}

export async function clerkAuthFromRequest(request: Request): Promise<GatewayAuth> {
  const clerk = clerkClient();
  if (!clerk) return { userId: null };

  try {
    const requestState = await clerk.authenticateRequest(request);
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
