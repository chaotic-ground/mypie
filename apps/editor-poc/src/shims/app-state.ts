// $app/state shim — theme.svelte.ts reads page.url; Helmet reads page.
export const page = {
  get url() {
    return new URL(window.location.href);
  },
  params: {} as Record<string, string>,
  route: { id: null as string | null },
  status: 200,
  error: null as unknown,
  data: {} as Record<string, unknown>,
  form: undefined as unknown,
  state: {} as Record<string, unknown>,
};

export const navigating = { from: null, to: null, type: null, willUnload: false, delta: null, complete: Promise.resolve() };
export const updated = { get current() { return false; }, check: async () => false };
