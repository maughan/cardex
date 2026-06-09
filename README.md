# CarDex (mobile)

A Pokédex for the cars you spot in the wild. Spot a car, photograph it live, the
app identifies it, and it joins your collection with a rarity tier.

Expo + TypeScript. Uses `react-native-vision-camera` for live capture and
`react-native-reanimated` for the catch-reveal animation, with a Supabase
backend (auth, Postgres, Edge Functions).

## Getting started

```bash
npm install
npx expo install --fix          # align native module versions to the SDK
cp .env.example .env            # fill in your Supabase URL + anon key
```

vision-camera and reanimated include native code, so **Expo Go won't work** —
you need a custom dev client. Once built, it behaves like Expo Go: run
`npm start`, scan the QR, and you get live reload on a physical device.

### Option A — EAS Build (no Xcode/Mac required) — recommended for now

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios     # builds in the cloud
```

Install the resulting build on your iPhone, then `npm start` and scan the QR.
Note: iOS still needs an Apple ID registered with the project for device
signing; full App Store distribution requires a paid Apple Developer account
(sort licensing before going to production).

### Option B — Local build (needs Xcode / Android Studio) — later

```bash
npx expo run:ios       # requires Xcode
npx expo run:android   # requires Android Studio
```

## Project structure

```
App.tsx                     Providers + navigator
index.ts                    Entry (registers App)
src/
  context/AuthProvider.tsx  Supabase session context + auth gate
  navigation/RootNavigator  Auth gate → bottom tabs (Hunt / Garage)
  screens/
    AuthScreen.tsx          Email/password sign in + sign up
    CaptureScreen.tsx       Camera → recognize → confirm → reveal
    GarageScreen.tsx        Collection grid + set progress
  components/
    ConfirmSheet.tsx        Hybrid confirm/correct step
    RevealCard.tsx          Animated rarity reveal
  hooks/useCatchFlow.ts     Capture flow state machine
  lib/
    supabase.ts             Shared client (AsyncStorage session)
    api.ts                  recognize() + confirmCatch() Edge Function calls
    collection.ts           Garage + set-progress reads
    rarity.ts               Rarity colours/labels
    location.ts             Geolocation wrapper (wire up expo-location)
    config.ts               Env config
  types.ts                  Shared types
```

## Backend

The matching schema, seed data, and Edge Functions (`recognize`,
`confirm-catch`) live in the `supabase/` project. Deploy those and set the
function secrets before the capture flow will work end to end.

## Known stubs

- `src/lib/location.ts` returns `null` — wire in `expo-location`.
- The "search manually" action in the confirm sheet currently cancels.
- The recognition service endpoint must be running for `recognize` to return
  candidates.
