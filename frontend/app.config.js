// Expo dynamic config: applies the white-label tenant.config.json (from the App Kit) on top of app.json.
// With an empty tenantId (base app) app.json is used unchanged.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  let t = {};
  try {
    t = JSON.parse(fs.readFileSync(path.join(__dirname, "tenant.config.json"), "utf8"));
  } catch {
    return config;
  }
  if (!t.tenantId) return config;

  const asset = (file, fallback) => (fs.existsSync(path.join(__dirname, "tenant-assets", file)) ? `./tenant-assets/${file}` : fallback);
  const bg = (t.theme && t.theme.accentColor) || "#000000";
  const iconBg = (t.theme && (t.theme.adaptiveIconBackground || t.theme.primaryColor)) || bg;
  const splashBg = (t.theme && (t.theme.splashBackground || t.theme.accentColor)) || bg;
  // Every branded app shows ONE clean splash in BrandSplash.tsx (full-screen custom poster if uploaded, or
  // crisp brand logo fallback). Using a transparent native splash icon with the exact splashBg colour prevents
  // Android 12+ / iOS from flashing a small native logo splash before the app's own splash.
  const blankSplash = "./assets/images/splash-blank.png";

  const plugins = (config.plugins || []).map((p) => {
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
    return p;
  });

  return {
    ...config,
    name: t.appName || config.name,
    slug: t.slug || config.slug,
    scheme: (t.slug || "").replace(/[^a-z0-9]/g, "") || config.scheme,
    version: t.version || config.version,
    icon: asset("icon.png", config.icon),
    ios: {
      ...config.ios,
      bundleIdentifier: t.bundleId || config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      usesCleartextTraffic: true,
      package: t.packageName || t.bundleId || config.android?.package,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: asset("adaptive-icon.png", config.android?.adaptiveIcon?.foregroundImage),
        backgroundColor: iconBg,
      },
    },
    plugins,
    extra: { ...config.extra, tenant: { tenantId: t.tenantId, appName: t.appName } },
  };
};
