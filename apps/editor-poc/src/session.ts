// Session persistence: auto-save the working document (+ title/subtitle) so that
// closing and reopening the app restores where you left off. localStorage
// persists across restarts in both the browser dev server and the Tauri webview
// (kept in the app's data dir), so no filesystem plugin is needed.
import type { PlainDoc } from '@typie/editor-ffi/browser';

const KEY = 'mypie:session:v1';

export type Session = {
  v: 1;
  doc?: PlainDoc;
  title?: string;
  subtitle?: string;
};

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.v === 1 ? (parsed as Session) : null;
  } catch (err) {
    console.error('loadSession failed', err);
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch (err) {
    console.error('saveSession failed', err);
  }
}
