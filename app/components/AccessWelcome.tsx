"use client";

import { ArrowRight, Download, Mail } from "lucide-react";
import { useEffect, useState } from "react";

export default function AccessWelcome() {
  const [updates, setUpdates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const detect = () => setStandalone(displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    detect();
    displayMode.addEventListener("change", detect);
    return () => displayMode.removeEventListener("change", detect);
  }, []);

  const enter = async () => {
    setSaving(true);
    try {
      await fetch("/api/access/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingConsent: updates }),
      });
    } finally {
      window.location.assign("/library");
    }
  };

  return (
    <main className="access-shell">
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

      <section className="access-card" aria-labelledby="access-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="access-mark" src="/icons/gateway-tapes-512.png" alt="Gateway Tapes crystal ball" />
        <p className="access-kicker">PRIVATE LISTENING ARCHIVE</p>
        <h1 id="access-title">Gateway Tapes</h1>
        <p className="access-intro">Your email has been verified. Enter the six-wave audio and manual archive.</p>

        <label className="updates-choice">
          <input type="checkbox" checked={updates} onChange={(event) => setUpdates(event.target.checked)} />
          <span className="choice-box"><Mail /></span>
          <span><b>Occasional project notes</b><small>Optional. No automated newsletters or sharing.</small></span>
        </label>

        <button className="access-enter" type="button" onClick={enter} disabled={saving}>
          <span>{saving ? "OPENING" : "ENTER THE ARCHIVE"}</span><ArrowRight />
        </button>

        {!standalone && (
          <p className="install-note"><Download /><span>For the best mobile experience, use your browser’s <b>Add to Home Screen</b> option. Gateway Tapes will open like an app.</span></p>
        )}
        <p className="access-privacy">Access lasts for up to 30 days on this device. Your verified email is stored for access management. Project updates remain optional.</p>
      </section>
    </main>
  );
}
