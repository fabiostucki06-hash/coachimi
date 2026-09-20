import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

function readEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

const SUPABASE_URL = readEnv(process.env.EXPO_PUBLIC_SUPABASE_URL, 'https://nejndycalbepcfmmuiai.supabase.co');
const SUPABASE_PUBLISHABLE_KEY = readEnv(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  'sb_publishable_3r2L5b3ergcCPhHBafqjcA__PRaVGQG',
);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('[supabase] Fehlende Konfiguration: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY sind nicht gesetzt.');
}

// Every Supabase request (PostgREST reads, auth) bypasses the browser HTTP cache,
// so a diary/profile/diet_cycles read can never be answered from a stale cached
// response. Uses the fetch `cache` option rather than a Cache-Control request
// header: a custom header on these cross-origin calls would force an extra CORS
// preflight and can be rejected by the API gateway. Ignored by React Native's fetch.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: noStoreFetch },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
