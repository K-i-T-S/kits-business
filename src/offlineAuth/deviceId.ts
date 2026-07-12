/**
 * A stable, random identifier for this browser/device, generated once and
 * persisted in localStorage. Not derived from hardware fingerprinting (no
 * privacy concerns, no fragility across browser updates) -- it's purely a
 * label this specific browser profile can present to the server when
 * registering itself as a trusted offline terminal. Clearing site data
 * resets it, which is the correct behavior (a wiped browser profile is
 * not the same trusted device anymore).
 */
const DEVICE_ID_KEY = 'kits-device-id';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
