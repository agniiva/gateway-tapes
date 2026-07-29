import { registerGatewayUser } from "../../../../db/access";
import { clerkAuthFromRequest, clerkPrimaryEmail } from "../../../clerk-auth";

export async function POST(request: Request) {
  const { userId } = await clerkAuthFromRequest(request);
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });

  const email = await clerkPrimaryEmail(userId);
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return Response.json({ error: "Verified email unavailable." }, { status: 422 });

  let marketingConsent: boolean | undefined;
  try {
    const payload = await request.json() as { marketingConsent?: unknown };
    if (typeof payload.marketingConsent === "boolean") marketingConsent = payload.marketingConsent;
  } catch {
    marketingConsent = undefined;
  }

  try {
    await registerGatewayUser(normalizedEmail, marketingConsent);
    return Response.json({ registered: true });
  } catch {
    return Response.json({ error: "Registration could not be saved." }, { status: 500 });
  }
}
