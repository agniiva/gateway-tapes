"use client";

import { SignIn, SignUp } from "@clerk/react";

const appearance = {
  variables: {
    colorPrimary: "#6541a5",
    colorBackground: "#e8e8ee",
    colorForeground: "#353231",
    colorInputBackground: "#f5f4f7",
    colorInputForeground: "#353231",
    colorDanger: "#7e3029",
    borderRadius: "0px",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  elements: {
    rootBox: "clerk-root",
    cardBox: "clerk-card-box",
    card: "clerk-card",
    headerTitle: "clerk-title",
    headerSubtitle: "clerk-subtitle",
    formButtonPrimary: "clerk-primary-button",
    formButtonArrowIcon: "clerk-button-arrow",
    formFieldLabel: "clerk-field-label",
    formFieldInput: "clerk-input",
    formFieldErrorText: "clerk-field-error",
    identityPreview: "clerk-identity-preview",
    footer: "clerk-footer",
    footerAction: "clerk-footer-action",
    footerActionText: "clerk-footer-text",
    developmentModeBadge: "clerk-development-badge",
    footerActionLink: "clerk-link",
    identityPreviewEditButton: "clerk-link",
  },
};

export default function ClerkAuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  if (mode === "sign-up") {
    return (
      <SignUp
        routing="hash"
        signInUrl="/"
        forceRedirectUrl="/library"
        appearance={appearance}
      />
    );
  }

  return (
    <SignIn
      routing="hash"
      withSignUp
      signUpUrl="/sign-up"
      forceRedirectUrl="/library"
      appearance={appearance}
    />
  );
}
