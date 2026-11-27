/**
 * Brand splash - the ONLY splash the customer sees.
 *  - "poster" mode (shop uploaded a splash image): that image FULL SCREEN, same as the App Studio preview.
 *    The native splash before it shows just the same background colour (transparent icon), so there is
 *    no small-logo splash first.
 *  - "icon" mode: the logo on the brand colour, smoothly growing from the system-splash size to a large size.
 * It stays until the app is ready, so there is no blank frame and no sudden size jump.
 */
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, useWindowDimensions } from "react-native";

import { tenantConfig } from "@/src/tenantConfig";

// Must match app.json / app.config.js -> expo-splash-screen "imageWidth"
export const SPLASH_IMAGE_WIDTH = 240;

const theme = (tenantConfig.theme || {}) as { splashBackground?: string; accentColor?: string };
const SPLASH_BG = theme.splashBackground || theme.accentColor || "#000000";
const MODE = ((tenantConfig.assets as any)?.splashMode === "poster" ? "poster" : "icon") as "poster" | "icon";
// Tall poster fills the whole screen; a square / wide upload is shown whole on its own background colour.
const FIT = ((tenantConfig.assets as any)?.splashFit === "contain" ? "contain" : "cover") as "cover" | "contain";
const MIN_VISIBLE_MS = MODE === "poster" ? 1400 : 900;

// Keep the system splash until our copy is on screen
SplashScreen.preventAutoHideAsync().catch(() => {});

export function BrandSplash({ ready }: { ready: boolean }) {
  const { width: W } = useWindowDimensions();
  const [gone, setGone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const target = Math.min(W * 0.62, 300);
  const grow = useRef(new Animated.Value(0.92)).current;
  const hiddenNative = useRef(false);
  const shownAt = useRef(Date.now());

  const reveal = () => {
    if (hiddenNative.current) return;
    hiddenNative.current = true;
    shownAt.current = Date.now();
    SplashScreen.hideAsync().catch(() => {});
    if (MODE === "icon") {
      Animated.timing(grow, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  };

  // Safety fallback in case onLoad doesn't fire quickly on web/cold boot
  useEffect(() => {
    const id = setTimeout(reveal, 250);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => setGone(true));
    }, wait);
    return () => clearTimeout(id);
  }, [ready, opacity]);

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999, opacity }]}
      testID="brand-splash"
    >
      {MODE === "poster" ? (
        <Image
          source={require("../../assets/images/splash-full.png")}
          style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
          resizeMode={FIT}
          fadeDuration={0}
          onLoad={reveal}
          onError={reveal}
        />
      ) : (
        <Animated.View style={{ transform: [{ scale: grow }] }}>
          <Image
            source={require("../../assets/images/splash-image.png")}
            style={{ width: target, height: target }}
            resizeMode="contain"
            fadeDuration={0}
            onLoad={reveal}
            onError={reveal}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}
