// Minimal typings for the Facebook JS SDK (connect.facebook.net/en_US/sdk.js).
// The project has no @types/facebook-js-sdk dependency and only needs the
// two calls the WhatsApp Embedded Signup flow uses: FB.init() and FB.login()
// with the v3 Coexistence option bag. Kept here (a global .d.ts) rather than
// an importable module so `window.FB` is typed everywhere without an import.

interface FacebookAuthResponse {
  // Present only when FB.login is called with response_type: 'code'
  // (Embedded Signup) — this is the short-lived ES code, 30s TTL.
  code?: string;
  accessToken?: string;
  userID?: string;
  expiresIn?: number;
  signedRequest?: string;
  graphDomain?: string;
}

interface FacebookLoginStatusResponse {
  status: 'connected' | 'not_authorized' | 'unknown' | string;
  // null when the user closed the popup without authorizing.
  authResponse: FacebookAuthResponse | null;
}

interface FacebookLoginOptions {
  config_id?: string;
  response_type?: string;
  override_default_response_type?: boolean;
  scope?: string;
  extras?: Record<string, unknown>;
}

interface FacebookInitParams {
  appId: string;
  version: string;
  xfbml?: boolean;
  autoLogAppEvents?: boolean;
  cookie?: boolean;
  status?: boolean;
}

interface FacebookSdk {
  init(params: FacebookInitParams): void;
  login(
    callback: (response: FacebookLoginStatusResponse) => void,
    options?: FacebookLoginOptions,
  ): void;
  getLoginStatus(callback: (response: FacebookLoginStatusResponse) => void): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

export {};
