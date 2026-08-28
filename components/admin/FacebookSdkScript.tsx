'use client';

import Script from 'next/script';

interface FacebookSdkScriptProps {
  appId: string;
  graphVersion: string;
  // Fired after sdk.js loads AND FB.init() has run — the point at which
  // FB.login() is safe to call.
  onReady?: () => void;
  onError?: () => void;
}

// Loads the Facebook JS SDK for WhatsApp Embedded Signup.
//
// Rendered ONLY inside app/(admin)/admin/whatsapp/page.tsx — never in a
// layout, never on the tenant PWA. next/script with strategy="afterInteractive"
// (the default for this Next version, confirmed against
// node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md:
// afterInteractive is the default and supports onLoad in client components;
// beforeInteractive would force this into the root layout, which is exactly
// what we are avoiding). Because the script lives in the page, it only loads
// when /whatsapp is opened.
//
// CSP note (design §8 A5 / Phase 6 task 6.2): there is NO Content-Security-
// Policy in this repo today. If nginx on the VPS adds one, it MUST whitelist
// connect.facebook.net in script-src, *.facebook.com in frame-src (the OAuth
// popup) and graph.facebook.com in connect-src, or Embedded Signup breaks in
// prod while passing every local test. Verifying that is a manual pre-
// screencast step, not handled here.
//
// PWA cache note: next.config.ts adds a NetworkOnly runtime-caching rule for
// url.hostname === 'connect.facebook.net' so the SDK is never served stale
// from the service worker.
export default function FacebookSdkScript({
  appId,
  graphVersion,
  onReady,
  onError,
}: FacebookSdkScriptProps) {
  return (
    <Script
      id="facebook-jssdk"
      src="https://connect.facebook.net/en_US/sdk.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.FB?.init({
          appId,
          version: graphVersion,
          xfbml: false,
          autoLogAppEvents: true,
        });
        onReady?.();
      }}
      onError={() => {
        onError?.();
      }}
    />
  );
}
