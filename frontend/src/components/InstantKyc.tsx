/**
 * Instant KYC (Setu): 1) PAN check (3 sec)  2) Aadhaar via DigiLocker  3) Bank account via ₹1 UPI (refunded).
 * PAN + matching name approves KYC automatically; the other two are needed for redemption when the store asks.
 */
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { BadgeCheck, Building2, CheckCircle2, CreditCard, Fingerprint } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Button } from "@/src/components/ui";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, themed } from "@/src/theme";

type Steps = {
  kyc_status: string;
  enabled: boolean;
  mode: string;
  pan: { verified?: boolean; name?: string; pan_masked?: string };
  aadhaar: { verified?: boolean; name?: string; aadhaar_last4?: string; city?: string };
  bank: { verified?: boolean; name?: string; account_masked?: string; ifsc?: string; bank?: string };
  require_aadhaar_redeem?: boolean;
  require_bank_redeem?: boolean;
  note?: string;
};

export function useKycSteps() {
  const { token } = useApp();
  const [steps, setSteps] = useState<Steps | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    try { setSteps(await api<Steps>("/kyc/status")); } catch { setSteps(null); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  return { steps, setSteps, reload: load };
}

function Row({ icon, title, sub, ok, children }: { icon: React.ReactNode; title: string; sub: string; ok?: boolean; children?: React.ReactNode }) {
  return (
    <View style={[styles.step, ok && styles.stepOk]}>
      <View style={styles.stepHead}>
        <View style={[styles.icon, ok && { backgroundColor: colors.successTint }]}>{ok ? <CheckCircle2 size={18} color={colors.success} /> : icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export function InstantKyc({ steps, setSteps }: { steps: Steps; setSteps: (s: Steps) => void }) {
  const toast = useToast();
  const { refresh } = useApp();
  const [pan, setPan] = useState("");
  const [busy, setBusy] = useState<"" | "pan" | "aadhaar" | "bank">("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const done = async (s: Steps, msg?: string) => {
    setSteps(s);
    await refresh();
    if (msg) toast("success", msg);
  };

  const verifyPan = async () => {
    const p = pan.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p)) return toast("error", "Enter a valid PAN", "Format: ABCDE1234F");
    setBusy("pan");
    try {
      const s = await api<Steps>("/kyc/pan", { method: "POST", body: { pan: p } });
      await done(s, s.kyc_status === "approved" ? "KYC approved ✓" : "PAN verified");
      if (s.kyc_status === "pending") toast("info", "Sent for review", s.note || "Your store will confirm shortly");
    } catch (e: any) {
      toast("error", "PAN verification failed", e.message);
    } finally {
      setBusy("");
    }
  };

  const verifyAadhaar = async () => {
    setBusy("aadhaar");
    try {
      const returnUrl = Linking.createURL("kyc");
      const r = await api<{ kid: string; url: string }>("/kyc/digilocker/start", { method: "POST", body: { return_url: returnUrl } });
      await WebBrowser.openAuthSessionAsync(r.url, returnUrl);
      const s = await api<Steps & { done: boolean }>(`/kyc/digilocker/${r.kid}/complete`, { method: "POST" });
      if (s.done) await done(s, "Aadhaar verified ✓");
      else toast("info", "DigiLocker not completed", "Please finish the DigiLocker steps and try again");
    } catch (e: any) {
      toast("error", "DigiLocker verification failed", e.message);
    } finally {
      setBusy("");
    }
  };

  const verifyBank = async () => {
    setBusy("bank");
    try {
      const returnUrl = Linking.createURL("kyc");
      const r = await api<{ kid: string; url: string; upi_link?: string }>("/kyc/bank/start", { method: "POST", body: { return_url: returnUrl } });
      const target = r.url || r.upi_link;
      if (!target) throw new Error("Could not create the ₹1 payment link");
      toast("info", "Pay ₹1 from your bank account", "It is refunded automatically");
      if (poll.current) clearInterval(poll.current);
      let tries = 0;
      poll.current = setInterval(async () => {
        tries += 1;
        try {
          const s = await api<Steps & { status: string }>(`/kyc/bank/${r.kid}`);
          if (s.status === "success" || s.status === "failed" || tries > 60) {
            if (poll.current) clearInterval(poll.current);
            poll.current = null;
            setBusy("");
            if (s.status === "success") await done(s, "Bank account verified ✓");
            else if (s.status === "failed") toast("error", "Bank verification failed", "Please try again");
          }
        } catch {}
      }, 3000);
      await WebBrowser.openBrowserAsync(target);
    } catch (e: any) {
      setBusy("");
      toast("error", "Bank verification failed", e.message);
    }
  };

  return (
    <View style={{ gap: 10, marginTop: 8 }} testID="instant-kyc">
      {steps.mode === "sandbox" ? <Text style={styles.sandbox}>TEST MODE — sample data only</Text> : null}
      <Row icon={<CreditCard size={18} color={colors.brandDeep} />} title="1. PAN verification" ok={steps.pan.verified}
        sub={steps.pan.verified ? `${steps.pan.name} · ${steps.pan.pan_masked}` : "Instant check with the Income Tax database · needed to buy"}>
        {!steps.pan.verified ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput value={pan} onChangeText={(t) => setPan(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} autoCapitalize="characters"
              placeholder="ABCDE1234F" placeholderTextColor={colors.mutedLight} style={styles.input} testID="kyc-pan-instant-input" />
            <Button title="Verify" size="sm" loading={busy === "pan"} disabled={!!busy} onPress={verifyPan} style={{ minWidth: 92 }} testID="kyc-pan-verify" />
          </View>
        ) : null}
      </Row>
      <Row icon={<Fingerprint size={18} color={colors.brandDeep} />} title={`2. Aadhaar via DigiLocker${steps.require_aadhaar_redeem ? "" : " (optional)"}`} ok={steps.aadhaar.verified}
        sub={steps.aadhaar.verified ? `${steps.aadhaar.name} · XXXX ${steps.aadhaar.aadhaar_last4 || ""}` : "Govt-signed Aadhaar in ~1 minute · needed for redemption"}>
        {!steps.aadhaar.verified ? (
          <Button title="Verify with DigiLocker" size="sm" variant="outline" loading={busy === "aadhaar"} disabled={!!busy || !steps.pan.verified}
            onPress={verifyAadhaar} style={{ marginTop: 10 }} testID="kyc-digilocker" icon={<BadgeCheck size={16} color={colors.onSurface} />} />
        ) : null}
      </Row>
      <Row icon={<Building2 size={18} color={colors.brandDeep} />} title={`3. Bank account${steps.require_bank_redeem ? "" : " (optional)"}`} ok={steps.bank.verified}
        sub={steps.bank.verified ? `${steps.bank.name} · ${steps.bank.bank || steps.bank.ifsc} ${steps.bank.account_masked}` : "Pay ₹1 by UPI (refunded) · sale money goes only to this account"}>
        {!steps.bank.verified ? (
          busy === "bank" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={styles.sub}>Waiting for your ₹1 UPI payment…</Text>
            </View>
          ) : (
            <Button title="Verify bank with ₹1 UPI" size="sm" variant="outline" disabled={!!busy || !steps.pan.verified} onPress={verifyBank} style={{ marginTop: 10 }} testID="kyc-bank" />
          )
        ) : null}
      </Row>
    </View>
  );
}

const styles = themed(() => ({
  step: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.surface },
  stepOk: { borderColor: colors.success, backgroundColor: colors.successTint },
  stepHead: { flexDirection: "row", gap: 10, alignItems: "center" },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  input: { flex: 1, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontFamily: fonts.bold, fontSize: 15, letterSpacing: 1, color: colors.onSurface, backgroundColor: colors.surface },
  sandbox: { alignSelf: "flex-start", fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: "#B45309", backgroundColor: colors.warningTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
}));
