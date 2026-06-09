// App configuration. In a bare RN app, wire these via react-native-config;
// in Expo, EXPO_PUBLIC_* env vars are inlined at build time.

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://YOUR-PROJECT.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "your-anon-key";

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
