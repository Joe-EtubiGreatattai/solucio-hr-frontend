// Notification sound, with a per-browser mute preference.
const KEY = 'notificationSound';
let audio;

export function isSoundOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

export function playNotificationSound() {
  if (!isSoundOn()) return;
  audio ||= new Audio('/sounds/notification.mp3');
  audio.currentTime = 0;
  // Browsers block audio until the user has interacted with the page; ignore that case quietly.
  audio.play().catch(() => {});
}
