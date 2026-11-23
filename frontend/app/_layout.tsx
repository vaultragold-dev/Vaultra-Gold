import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BrandSplash } from "@/src/components/BrandSplash";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { LanguageProvider, useLang } from "@/src/i18n";
import { AppProvider, useApp } from "@/src/store/AppContext";
import { AppLockProvider } from "@/src/store/AppLock";
import { ThemeProvider, fonts, useTheme } from "@/src/theme";

const qc = new QueryClient();

/** Screens are re-mounted when the theme or language changes, so every style/label updates instantly (no app restart). */
function ThemedStack() {
  const { scheme, ready } = useTheme();
  const { lang } = useLang();
  if (!ready) return null;
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack key={`${scheme}-${lang}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="faq" />
        <Stack.Screen name="referral" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="product-detail" />
        <Stack.Screen name="store-locator" />
        <Stack.Screen name="security" />
        <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

function SplashGate() {
  const { ready } = useTheme();
  const { booting } = useApp();
  return <BrandSplash ready={ready && !booting} />;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fonts.regular]: require("../assets/fonts/Inter-400.ttf"),
    [fonts.medium]: require("../assets/fonts/Inter-500.ttf"),
    [fonts.semibold]: require("../assets/fonts/Inter-600.ttf"),
    [fonts.bold]: require("../assets/fonts/Inter-700.ttf"),
    [fonts.black]: require("../assets/fonts/Inter-800.ttf"),
  });

  if (!loaded && !error) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <SafeAreaProvider>
            <KeyboardProvider>
              <QueryClientProvider client={qc}>
                <AppProvider>
                  <ToastProvider>
                    <View style={{ flex: 1 }}>
                      <AppLockProvider>
                        <ThemedStack />
                      </AppLockProvider>
                      <SplashGate />
                    </View>
                  </ToastProvider>
                </AppProvider>
              </QueryClientProvider>
            </KeyboardProvider>
          </SafeAreaProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
