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

  const plugins = (config.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === "expo-splash-screen") {
      return [
        "expo-splash-screen",
        {
          ...p[1],
          image: asset("splash.png", p[1]?.image),
          backgroundColor: splashBg,
          resizeMode: "contain",
          imageWidth: 280,
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
      splash: {
        image: asset("splash.png", config.ios?.splash?.image),
        resizeMode: "contain",
        backgroundColor: splashBg,
      },
    },
    android: {
      ...config.android,
      usesCleartextTraffic: true,
      package: t.packageName || t.bundleId || config.android?.package,
      splash: {
        image: asset("splash.png", config.android?.splash?.image),
        resizeMode: "contain",
        backgroundColor: splashBg,
      },
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
