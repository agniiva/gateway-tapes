import { authenticatedEmail, registerGatewayUser } from "../../../../db/access";

export async function POST(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });

  let marketingConsent: boolean | undefined;
  try {
    const payload = await request.json() as { marketingConsent?: unknown };
    if (typeof payload.marketingConsent === "boolean") marketingConsent = payload.marketingConsent;
  } catch {
    marketingConsent = undefined;
  }

  try {
    await registerGatewayUser(email, marketingConsent);
    return Response.json({ registered: true });
  } catch {
    return Response.json({ error: "Registration could not be saved." }, { status: 500 });
  }
}
