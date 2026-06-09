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

vision-camera, reanimated, and react-native-maps include native code, so
**Expo Go won't work** — you need a custom dev client. Once built, it behaves
like Expo Go: run `npm start`, scan the QR, and you get live reload.

### Build a dev client with EAS (cloud — no Mac required)

Prerequisites: an [Expo account](https://expo.dev), `npm install -g eas-cli`,
and (for an iPhone) an **Apple Developer Program** membership — a physical iOS
device build must be code-signed, which a free Apple ID can't do via EAS.

```bash
npm install                 # pull all native deps (maps, camera, etc.)
eas login
# project is already linked via extra.eas.projectId in app.json
```

**iOS — physical iPhone** (requires the paid Apple account):

```bash
eas device:create           # registers your iPhone; install the profile it shows
eas build --profile development --platform ios
```

`device:create` gives you a QR / URL — open it on the iPhone and install the
provisioning profile (Settings → Profile Downloaded). Then the build runs in
the cloud (~10–20 min), and EAS returns a link to install the dev client.

**No Apple account yet?** Two free alternatives:

```bash
eas build --profile development-simulator --platform ios   # iOS Simulator (needs a Mac)
eas build --profile development --platform android         # any Android device
```

**Then, for any of the above**, start the bundler and load onto the dev client:

```bash
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL + anon key first
npx expo start --dev-client # scan the QR from the installed dev client
```

### Local build alternative (needs Xcode / Android Studio)

```bash
npx expo run:ios       # requires Xcode (free personal team works, 7-day signing)
npx expo run:android   # requires Android Studio
```

### Maps note

iOS uses Apple Maps (no key). For Android, add a Google Maps API key to
`app.json` under `expo.android.config.googleMaps.apiKey` before the map renders.

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
