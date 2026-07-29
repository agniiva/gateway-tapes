import { redirect } from "next/navigation";
import ClerkAuthForm from "./components/ClerkAuthForm";
import { clerkAuthFromServerComponent, clerkRuntimeConfiguration } from "./clerk-auth";

export const dynamic = "force-dynamic";

function Preview() {
  return (
    <div className="access-preview" aria-hidden="true">
      <div className="preview-phone">
        <span className="preview-title">WAVE I — DISCOVERY</span>
        <span className="preview-disc"><i /></span>
        <span className="preview-track" />
        <span className="preview-subtitle" />
        <span className="preview-rail" />
        <span className="preview-play" />
      </div>
    </div>
  );
}

export default async function Home() {
  const { publishableKey, secretKey } = clerkRuntimeConfiguration();
  const clerkConfigured = Boolean(publishableKey && secretKey);
  const { userId } = await clerkAuthFromServerComponent();
  if (userId) redirect("/library");

  return (
    <main className="access-shell auth-shell">
      <Preview />
      <section className="auth-card" aria-label="Gateway Tapes access">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="access-mark auth-mark" src="/icons/gateway-tapes-512.png" alt="Gateway Tapes crystal ball" />
        <p className="access-kicker">PRIVATE LISTENING ARCHIVE</p>
        <h1>Gateway Tapes</h1>
        <p className="auth-intro">{clerkConfigured ? "Sign in or register with your email. We’ll send a one-time code." : "Authentication setup is waiting for the Clerk API keys."}</p>
        {clerkConfigured ? <ClerkAuthForm mode="sign-in" /> : <p className="auth-setup">Add the two Clerk keys to the local environment file to enable access.</p>}
        <div className="auth-install">
          <b>USE AS AN APP</b>
          <p>On mobile, open your browser menu and choose <strong>Add to Home Screen</strong>.</p>
          <p className="analytics-notice">Signed-in usage is measured privately to improve the archive.</p>
        </div>
      </section>
    </main>
  );
}
