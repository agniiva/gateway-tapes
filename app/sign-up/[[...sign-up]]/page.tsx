import ClerkAuthForm from "../../components/ClerkAuthForm";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  return (
    <main className="access-shell auth-shell">
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
      <section className="auth-card" aria-label="Create Gateway Tapes access">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="access-mark auth-mark" src="/icons/gateway-tapes-512.png" alt="Gateway Tapes crystal ball" />
        <p className="access-kicker">PRIVATE LISTENING ARCHIVE</p>
        <h1>Gateway Tapes</h1>
        <p className="auth-intro">{clerkConfigured ? "Register with your email and verify the one-time code." : "Authentication setup is waiting for the Clerk API keys."}</p>
        {clerkConfigured ? <ClerkAuthForm mode="sign-up" /> : <p className="auth-setup">Add the two Clerk keys to the local environment file to enable access.</p>}
        <p className="access-privacy">Your email is used for access management. No password is required.</p>
      </section>
    </main>
  );
}
