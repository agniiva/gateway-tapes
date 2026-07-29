import AccessWelcome from "./components/AccessWelcome";
import ClerkAuthForm from "./components/ClerkAuthForm";
import { clerkAuthFromServerComponent } from "./clerk-auth";

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
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  const { userId } = await clerkAuthFromServerComponent();
  if (userId) return <AccessWelcome />;

  return (
    <main className="access-shell auth-shell">
      <Preview />
      <section className="auth-card" aria-label="Gateway Tapes access">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="access-mark auth-mark" src="/icons/gateway-tapes-512.png" alt="Gateway Tapes crystal ball" />
        <p className="access-kicker">PRIVATE LISTENING ARCHIVE</p>
        <h1>Gateway Tapes</h1>
        <p className="auth-intro">{clerkConfigured ? "Enter your email. We’ll send a one-time code." : "Authentication setup is waiting for the Clerk API keys."}</p>
        {clerkConfigured ? <ClerkAuthForm mode="sign-in" /> : <p className="auth-setup">Add the two Clerk keys to the local environment file to enable access.</p>}
        <p className="access-privacy">Your email is used for access management. No password is required.</p>
      </section>
    </main>
  );
}
