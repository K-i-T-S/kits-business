/** Call from anywhere (e.g. a "Switch User" header button) to lock the
 * shared-terminal PIN lock screen (PinLockScreen.tsx) immediately. */
export function lockTerminal() {
  window.dispatchEvent(new Event('kits:lock-terminal'));
}
