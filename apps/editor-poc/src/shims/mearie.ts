// Shim for $mearie + @mearie/svelte: replace the GraphQL data layer with a
// local blank Editor_document. The View render path only reads document.data
// (id + editorFontFamilies). We return empty fontFamilies (no CDN font fetch)
// and register Pretendard out-of-band (see fonts-local.ts).

export function graphql(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw({ raw: strings }, ...values);
}

const LOCAL_DOCUMENT = {
  id: 'local-blank',
  editorFontFamilies: [] as never[],
  entity: { id: 'local-entity' },
  subscription: { id: 'local-sub' },
  preferences: { aiOptIn: true },
};

// createFragment(def, () => key) -> reactive holder with always-defined .data.
export function createFragment(_def: unknown, _key?: () => unknown) {
  return {
    get data() {
      return LOCAL_DOCUMENT;
    },
  };
}

// Present but inert: ExternalEmbed imports createMutation; never fires on a blank doc.
export function createMutation(_def: unknown) {
  const run = async () => {
    throw new Error('mearie mutation disabled in editor-poc');
  };
  return [
    run,
    {
      get data() {
        return undefined;
      },
      get inflight() {
        return false;
      },
    },
  ] as const;
}

export function createQuery(_def: unknown, _vars?: () => unknown) {
  return {
    get data() {
      return undefined;
    },
  };
}

export function createSubscription(..._args: unknown[]) {
  /* no-op; tolerates (def), (def, vars), (def, vars, opts) */
}

// $lib/graphql/client.ts builds a client at module load and calls
// mearieClient.extension('cache') at top level — return an object that
// satisfies that without doing anything.
export function createClient(_opts?: unknown) {
  return {
    extension: (_name?: unknown) => ({}) as Record<string, unknown>,
    query: () => ({ get data() { return undefined; } }),
    mutation: () => async () => undefined,
    subscription: () => ({}),
  } as Record<string, unknown>;
}
export function setClient(_client?: unknown): void {}
export function getClient() {
  return {} as Record<string, unknown>;
}
const exchange = (..._a: unknown[]) => ({}) as Record<string, unknown>;
export const cacheExchange = exchange;
export const dedupExchange = exchange;
export const httpExchange = exchange;
export const fetchExchange = exchange;
export const errorExchange = exchange;
export const subscriptionExchange = exchange;

export const schema = {} as Record<string, unknown>;
export class AggregatedError extends Error {}
export function isAggregatedError(_e: unknown): boolean {
  return false;
}
export function isGraphQLError(_e: unknown): boolean {
  return false;
}
export function isExchangeError(_e: unknown): boolean {
  return false;
}

export type FontFamilySource = 'DEFAULT' | 'USER' | 'FALLBACK';
export type Editor_document$key = unknown;
