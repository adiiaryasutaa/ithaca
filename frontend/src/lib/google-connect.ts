import { apiFetch } from '@/lib/api';

const PLACEHOLDER_HTML =
  '<html><head><title>Connecting...</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#64748b;}</style></head><body><div style="text-align:center;"><h2>Connecting to Google...</h2><p>Please wait while we redirect you.</p></div></body></html>';

/**
 * Starts the Google Drive OAuth flow in a popup. The window is opened synchronously with
 * placeholder markup *before* fetching the consent URL — opening it after the await would
 * no longer be attributable to the click and browsers would block it.
 *
 * The popup posts a GOOGLE_CONNECTED message back when it lands on /google-connected.
 * Throws if the consent URL cannot be fetched; callers decide how loudly to report that.
 */
export async function openGoogleConnectPopup() {
  const popup = window.open('', 'google-drive-connect', 'width=540,height=720');
  if (popup) popup.document.write(PLACEHOLDER_HTML);
  try {
    const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url');
    if (popup) {
      popup.location.href = data.url;
    } else {
      // Popup blocked — fall back to a full-page redirect.
      window.location.href = data.url;
    }
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
}
