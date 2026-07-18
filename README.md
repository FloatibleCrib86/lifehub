# LifeSim Android — Codemagic project

This package wraps the existing LifeSim HTML/CSS/JavaScript app with Capacitor so Codemagic can build it as Android APK and AAB files.

## What remains persistent

LifeSim keeps its data in the WebView's local storage under `LifeSimSave`. Installing a newer APK over the existing app keeps the data as long as:

- the package ID stays `com.chetwin.lifesim`;
- the update is signed with the same keystore;
- the user does not uninstall the app or clear its storage.

## First Codemagic build

1. Extract this folder and push its contents to a GitHub, GitLab, or Bitbucket repository.
2. Add that repository to Codemagic.
3. Select **LifeSim Debug APK** to create an APK that can be installed directly for testing.
4. Download the APK from the build artifacts.

The `codemagic.yaml` file must remain in the repository root.

## Signed, updateable releases

For Android to accept future APKs as updates, every release must use the same package ID and signing key.

1. Generate or reuse one Android keystore.
2. In Codemagic, upload it under **Team settings → codemagic.yaml settings → Code signing identities → Android keystores**.
3. Give the keystore the reference name `lifesim_keystore`.
4. Run the **LifeSim Release APK and AAB** workflow.

Do not lose or replace that keystore. Android will reject an update signed with a different key.

## Publishing updates

Before a new release, change `APP_VERSION` in both Codemagic workflows, for example from `1.0.0` to `1.0.1`. Codemagic supplies an increasing `BUILD_NUMBER`, which becomes Android's `versionCode`, so each build can update the preceding build.

You can also update the project version locally:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

After editing anything inside `www/`, commit and push the changes. Codemagic runs `npm run sync` automatically before building.

## Local Android build

With Android Studio and the Android SDK installed:

```bash
npm ci
npm run android:debug
```

The APK will be under:

`android/app/build/outputs/apk/debug/`

## Main files

- `www/` — the LifeSim application
- `android/` — native Android wrapper
- `capacitor.config.json` — app name, package ID, and web directory
- `codemagic.yaml` — automated APK/AAB workflows
- `scripts/bump-version.js` — version helper
