jest.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { buildSwissQuery, looksLikeBarcode } from './foodApi';

describe('buildSwissQuery', () => {
  // Regression: `countries_tags` used to be sent as its own separate query-string
  // param (`&countries_tags=en:switzerland`), which Search-a-licious silently
  // ignores - verified against the live endpoint. The country filter only takes
  // effect embedded in `q` as a quoted field:value clause.
  it('embeds a quoted countries_tags clause in the q string, not a separate param', () => {
    expect(buildSwissQuery('milch', false)).toBe('milch AND countries_tags:"en:switzerland"');
  });

  it('additionally restricts to the major Swiss retailer own-brands when retailerOnly is set', () => {
    const query = buildSwissQuery('milch', true);
    expect(query).toContain('countries_tags:"en:switzerland"');
    expect(query).toContain('brands_tags:migros');
    expect(query).toContain('brands_tags:coop');
    expect(query).toContain('brands_tags:m-budget');
    expect(query).toContain('brands_tags:prix-garantie');
    expect(query).toContain('brands_tags:alnatura');
  });
});

describe('looksLikeBarcode', () => {
  it('accepts bare 8-14 digit strings', () => {
    expect(looksLikeBarcode('40084001234')).toBe(true);
  });

  it('rejects text queries', () => {
    expect(looksLikeBarcode('Milch')).toBe(false);
  });
});
