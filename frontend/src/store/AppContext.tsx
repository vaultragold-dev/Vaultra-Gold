import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { API_BASE, api, setApiTenant, setToken } from "@/src/api";
import { storage } from "@/src/utils/storage";
import { TENANT_NAME, TENANT_PHONE } from "@/src/format";
import { LOCKED_TENANT_ID, tenantConfig } from "@/src/tenantConfig";

export const DEFAULT_TENANT = "demo-jeweller-001";
// Branded builds identify themselves on the very first request
if (LOCKED_TENANT_ID) setApiTenant(LOCKED_TENANT_ID);

export type User = {
  id: string;
  phone: string;
  name: string;
  wallet_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  dob?: string;
  gender?: string;
  tenant: string;
  kyc_status: "not_submitted" | "pending" | "approved" | "rejected";
  gold_grams: number;
  silver_grams?: number;
  invested: number;
  avg_buy_price: number;
  wallet_balance?: number;
  created_at: string;
  kyc: any;
  referral_code?: string;
  referral_balance?: number;
  referred_by?: string | null;
};

export type SilverPrice = { buy: number; sell: number; change: number; change_pct: number; direction: "up" | "down" };

export type Price = { buy: number; sell: number; change: number; change_pct: number; direction: "up" | "down"; updated_at: string; live?: boolean; offline?: boolean; has_live?: boolean; rates_hidden?: boolean; booking_enabled?: boolean; min_investment?: number; source?: string; silver?: SilverPrice; karats?: Record<"24K" | "22K" | "18K", number> };

export type Vault = {
  user: User;
  buy_rate: number;
  sell_rate: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pct: number;
  pending_pickups: any[];
};

export type PriceAlert = {
  id: string;
  target: number;
  tenant: string;
  status: "active" | "triggered";
  created_at: string;
  triggered_at: string | null;
  triggered_price: number | null;
};

type Ctx = {
  booting: boolean;
  token: string | null;
  user: User | null;
  tenant: string;
  tenantName: string;
  tenantPhone: string;
  tenantLogo: string;
  tenantLocked: boolean;
  price: Price | null;
  priceError: boolean;
  vault: Vault | null;
  alerts: PriceAlert[];
  unreadNotifs: number;
  reloadAlerts: () => Promise<void>;
  reloadNotifs: () => Promise<void>;
  setTenant: (t: string) => void;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

function toAbsUrl(u?: string): string {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = (
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    tenantConfig?.apiBaseUrl ||
    "https://master.vaultragold.com"
  ).trim().replace(/\/+$/, "").replace(/\/api$/, "");
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

const AppCtx = createContext<Ctx>(null as any);
const TOKEN_KEY = "vdg_user_token";
const TENANT_KEY = "vdg_tenant";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [token, setTok] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenantState] = useState(LOCKED_TENANT_ID || DEFAULT_TENANT);
  const [tenantName, setTenantName] = useState("");
  const [tenantLogo, setTenantLogo] = useState(toAbsUrl(tenantConfig.assets?.logoUrl));
  const [tenantLocked, setTenantLocked] = useState(false);
  const [price, setPrice] = useState<Price | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [vault, setVault] = useState<Vault | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const inFlight = useRef<Set<string>>(new Set());
  const tenantRef = useRef(tenant);
  tenantRef.current = tenant;

  const reloadAlerts = useCallback(async () => {
    try {
      setAlerts(await api<PriceAlert[]>("/alerts"));
    } catch {}
  }, []);

  const reloadNotifs = useCallback(async () => {
    try {
      const r = await api<{ unread_count: number }>("/notifications");
      setUnreadNotifs(r.unread_count);
    } catch {}
  }, []);

  useEffect(() => {
    if (token) { reloadAlerts(); reloadNotifs(); }
    else { setAlerts([]); setUnreadNotifs(0); }
  }, [token, reloadAlerts, reloadNotifs]);

  // When the live price crosses below an active target, ask the server to verify & mark it triggered.
  useEffect(() => {
    if (!price || !token) return;
    const hits = alerts.filter((a) => a.status === "active" && a.tenant === tenant && ((a as any).metal === "silver" ? price.silver?.buy ?? Infinity : price.buy) <= a.target && !inFlight.current.has(a.id));
    if (!hits.length) return;
    hits.forEach((a) => inFlight.current.add(a.id));
    Promise.all(hits.map((a) => api(`/alerts/${a.id}/trigger`, { method: "POST" }).catch(() => null))).then(async () => {
      await reloadAlerts();
      hits.forEach((a) => inFlight.current.delete(a.id));
    });
  }, [price, alerts, token, tenant, reloadAlerts]);

  const refresh = useCallback(async () => {
    try {
      const v = await api<Vault>("/vault");
      setVault(v);
      setUser(v.user);
    } catch (e: any) {
      if (e.status === 401 || e.status === 403) {
        setToken("user", null);
        setTok(null);
        setUser(null);
        setVault(null);
        await storage.secureRemove(TOKEN_KEY);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [t, tn] = await Promise.all([storage.secureGet(TOKEN_KEY, null), storage.getItem(TENANT_KEY, DEFAULT_TENANT)]);
      let active = LOCKED_TENANT_ID || String(tn || DEFAULT_TENANT);
      try {
        const list = await api<{ id: string; business_name: string; support_phone?: string }[]>("/jewellers/list", { auth: "none" });
        list.forEach((j) => { TENANT_NAME[j.id] = j.business_name; TENANT_PHONE[j.id] = j.support_phone || ""; });
        if (!LOCKED_TENANT_ID && !list.some((j) => j.id === active)) active = list.some((j) => j.id === DEFAULT_TENANT) ? DEFAULT_TENANT : list[0]?.id || DEFAULT_TENANT;
      } catch {}
      if (LOCKED_TENANT_ID) {
        // Branded build: always this jeweller, shown under the app's own name
        TENANT_NAME[active] = tenantConfig.appName || TENANT_NAME[active] || "";
        if (tenantConfig.support?.phone) TENANT_PHONE[active] = tenantConfig.support.phone;
        setTenantLocked(true);
      }
      // Jeweller's own custom domain → fixed store (web)
      if (!LOCKED_TENANT_ID && Platform.OS === "web" && typeof window !== "undefined") {
        try {
          const r = await api<{ kind: "app" | "admin"; jeweller: { id: string; business_name: string } }>(
            `/tenant/resolve?host=${encodeURIComponent(window.location.hostname)}`, { auth: "none" });
          if (r.kind === "admin") { window.location.replace("/api/admin/jeweller"); return; }
          active = r.jeweller.id;
          TENANT_NAME[active] = r.jeweller.business_name;
          setTenantLocked(true);
        } catch {}
      }
      setApiTenant(active);
      setTenantState(active);
      setTenantName(TENANT_NAME[active] || "");
      try {
        const cfg = await api<{ appName?: string; assets?: { logoUrl?: string } }>(`/tenant/${active}/config`, { auth: "none" });
        if (cfg.assets?.logoUrl) {
          setTenantLogo(toAbsUrl(cfg.assets.logoUrl));
        }
      } catch {}
      if (t) {
        setToken("user", String(t));
        setTok(String(t));
      }
      setBooting(false);
    })();
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [token, tenant, refresh]);

  // Live rates: server pushes every MT5 tick over a WebSocket (no polling delay).
  // HTTP polling is only a fallback while the socket is reconnecting.
  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let backoff = 1000;
    const load = async () => {
      try {
        const p = await api<Price>(`/price?jeweller_id=${tenantRef.current}`, { auth: "none" });
        if (active) {
          setPrice(p);
          setPriceError(false);
        }
      } catch {
        if (active) setPriceError(true);
      }
    };
    const schedule = () => {
      if (retry || !active) return;
      retry = setTimeout(() => { retry = null; connect(); }, backoff);
      backoff = Math.min(backoff * 2, 15000);
    };
    const connect = () => {
      if (!active || ws) return;
      const url = `${API_BASE.replace(/^http/, "ws")}/ws/rates?jeweller_id=${encodeURIComponent(tenantRef.current || "")}`;
      try {
        ws = new WebSocket(url);
      } catch {
        ws = null;
        schedule();
        return;
      }
      ws.onopen = () => {
        backoff = 1000;
        if (ping) clearInterval(ping);
        ping = setInterval(() => { try { ws?.send("ping"); } catch {} }, 25000);
      };
      ws.onmessage = (e) => {
        try {
          const { type, feed, ...p } = JSON.parse(String(e.data));
          if (!active || type === "pong" || p.buy === undefined) return;
          setPrice(p as Price);
          setPriceError(false);
        } catch {}
      };
      ws.onclose = () => {
        ws = null;
        if (ping) { clearInterval(ping); ping = null; }
        if (active && AppState.currentState === "active") schedule();
      };
      ws.onerror = () => { try { ws?.close(); } catch {} };
    };
    const start = () => {
      load();
      connect();
      if (!poll) poll = setInterval(() => { if (!ws || ws.readyState !== 1) load(); }, 3000);
    };
    const stop = () => {
      if (poll) { clearInterval(poll); poll = null; }
      if (retry) { clearTimeout(retry); retry = null; }
      if (ping) { clearInterval(ping); ping = null; }
      if (ws) { const w = ws; ws = null; w.onclose = null; try { w.close(); } catch {} }
    };
    start();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") start();
      else stop();
    });
    return () => {
      active = false;
      stop();
      sub.remove();
    };
  }, [tenant]);

  const setTenant = (t: string) => {
    if (tenantLocked) return;
    setApiTenant(t);
    setTenantState(t);
    setTenantName(TENANT_NAME[t] || "");
    storage.setItem(TENANT_KEY, t);
  };

  const signIn = async (t: string, u: User) => {
    setToken("user", t);
    await storage.secureSet(TOKEN_KEY, t);
    setUser(u);
    setTok(t);
  };

  const signOut = async () => {
    setToken("user", null);
    await storage.secureRemove(TOKEN_KEY);
    setTok(null);
    setUser(null);
    setVault(null);
  };

  return (
    <AppCtx.Provider value={{ booting, token, user, tenant, tenantName, tenantPhone: TENANT_PHONE[tenant] || "", tenantLogo, tenantLocked, price, priceError, vault, alerts, unreadNotifs, reloadAlerts, reloadNotifs, setTenant, signIn, signOut, refresh }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
