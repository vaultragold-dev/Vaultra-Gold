// Expo dynamic config.
//  * Always: store-compliance hardening (Face ID usage string, export-compliance flag, unique build numbers,
//    cleartext HTTP only when the backend URL itself is plain http — i.e. local/test builds).
//  * Branded build: applies the white-label tenant.config.json (from the App Kit) on top of app.json.
//    With an empty tenantId (base app, never published) only the hardening is applied.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  let t = {};
  try {
    t = JSON.parse(fs.readFileSync(path.join(__dirname, "tenant.config.json"), "utf8")) || {};
  } catch {
    t = {};
  }
  const branded = !!t.tenantId;
  const appName = (branded && t.appName) || config.name;

  // Backend the app talks to. Store builds are always https (the backend refuses to start a cloud build otherwise);
  // plain http is only reachable for local dev builds, and only then do we allow cleartext traffic / ATS exceptions.
  const apiBase = String(process.env.EXPO_PUBLIC_BACKEND_URL || t.apiBaseUrl || "").trim();
  const plainHttp = /^http:\/\//i.test(apiBase);

  // Android versionCode / iOS CFBundleVersion: App Studio increments this on every cloud build (APP_VERSION_CODE in CI,
  // versionCode in tenant.config.json). Both stores reject an upload that repeats a previous number.
  const envCode = parseInt(process.env.APP_VERSION_CODE || "", 10);
  const versionCode = Math.max(1, (Number.isFinite(envCode) && envCode) || parseInt(t.versionCode, 10) || config.android?.versionCode || 1);
  const buildNumber = String((Number.isFinite(envCode) && envCode) || t.buildNumber || t.versionCode || config.ios?.buildNumber || versionCode);

  const infoPlist = {
    ...(config.ios?.infoPlist || {}),
    // expo-local-authentication (App Lock) — App Store rejects a Face ID prompt without this string
    NSFaceIDUsageDescription: `${appName} uses Face ID to unlock your gold vault`,
    // Only standard HTTPS/TLS is used — skips the export-compliance question on every upload
    ITSAppUsesNonExemptEncryption: false,
    ...(plainHttp ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } : {}),
  };

  const common = {
    ...config,
    ios: { ...config.ios, buildNumber, infoPlist },
    android: { ...config.android, versionCode, usesCleartextTraffic: plainHttp },
  };
  if (!branded) return common;

  const asset = (file, fallback) => (fs.existsSync(path.join(__dirname, "tenant-assets", file)) ? `./tenant-assets/${file}` : fallback);
  const bg = (t.theme && t.theme.accentColor) || "#000000";
  const iconBg = (t.theme && (t.theme.adaptiveIconBackground || t.theme.primaryColor)) || bg;
  const splashBg = (t.theme && (t.theme.splashBackground || t.theme.accentColor)) || bg;
  // Every branded app shows ONE clean splash in BrandSplash.tsx (full-screen custom poster if uploaded, or
  // crisp brand logo fallback). Using a transparent native splash icon with the exact splashBg colour prevents
  // Android 12+ / iOS from flashing a small native logo splash before the app's own splash.
  const blankSplash = "./assets/images/splash-blank.png";

  const plugins = (common.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === "expo-splash-screen") {
      return [
        "expo-splash-screen",
        {
          ...p[1],
          image: blankSplash,
          backgroundColor: splashBg,
          resizeMode: "contain",
          imageWidth: 240,
        },
      ];
    }
    if (Array.isArray(p) && p[0] === "expo-local-authentication") {
      return ["expo-local-authentication", { ...p[1], faceIDPermission: infoPlist.NSFaceIDUsageDescription }];
    }
    return p;
  });

  return {
    ...common,
    name: appName,
    slug: t.slug || common.slug,
    scheme: (t.slug || "").replace(/[^a-z0-9]/g, "") || common.scheme,
    version: t.version || common.version,
    icon: asset("icon.png", common.icon),
    ios: {
      ...common.ios,
      bundleIdentifier: t.bundleId || common.ios?.bundleIdentifier,
    },
    android: {
      ...common.android,
      package: t.packageName || t.bundleId || common.android?.package,
      adaptiveIcon: {
        ...common.android?.adaptiveIcon,
        foregroundImage: asset("adaptive-icon.png", common.android?.adaptiveIcon?.foregroundImage),
        backgroundColor: iconBg,
      },
    },
    plugins,
    extra: { ...common.extra, tenant: { tenantId: t.tenantId, appName: t.appName, versionCode } },
  };
};
