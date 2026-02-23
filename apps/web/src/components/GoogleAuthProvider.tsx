"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import React from "react";

/**
 * Provider component for Google OAuth.
 * Wraps the application and handles the Google Client ID from environment variables.
 */
export default function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

    if (!clientId) {
        console.warn(
            "[GoogleAuthProvider] Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable. " +
            "Google login features will be disabled. App will continue to run."
        );
    }

    return (
        <GoogleOAuthProvider clientId={clientId}>
            {children}
        </GoogleOAuthProvider>
    );
}
