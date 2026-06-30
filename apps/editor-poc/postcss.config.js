// Panda CSS extraction over the imported submodule source + local src.
// (@typie/lib/postcss dark-mode→media transform is intentionally skipped: light-only.)
export default {
  plugins: {
    '@pandacss/dev/postcss': {},
  },
};
