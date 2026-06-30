// $app/navigation shim — link.ts uses goto; Menu.svelte uses afterNavigate.
export function goto(url: string): Promise<void> {
  window.location.assign(url);
  return Promise.resolve();
}
export function afterNavigate(_cb: (nav: unknown) => void): void {}
export function beforeNavigate(_cb: (nav: unknown) => void): void {}
export function invalidate(_dep?: unknown): Promise<void> {
  return Promise.resolve();
}
export function invalidateAll(): Promise<void> {
  return Promise.resolve();
}
export function preloadData(): Promise<void> {
  return Promise.resolve();
}
export function preloadCode(): Promise<void> {
  return Promise.resolve();
}
export function pushState(): void {}
export function replaceState(): void {}
