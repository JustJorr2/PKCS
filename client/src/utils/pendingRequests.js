export const PENDING_REQUESTS_EVENT = "pending-requests-changed";

// Call after approving/rejecting anything so the nav badge refreshes right away.
export function notifyPendingRequestsChanged() {
  window.dispatchEvent(new Event(PENDING_REQUESTS_EVENT));
}