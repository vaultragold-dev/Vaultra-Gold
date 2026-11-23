"""Setu KYC gateway client: PAN verification, DigiLocker (Aadhaar) and Reverse Penny Drop (bank account).

Credentials come from Master → KYC settings (stored in app_settings) or environment variables.
Only masked / minimal data is ever returned to callers (no full Aadhaar or account numbers are stored).
"""
import re
from typing import Optional

import httpx

BASE = {"sandbox": "https://dg-sandbox.setu.co", "production": "https://dg.setu.co"}

# Product instance IDs from the Setu Bridge console (VAULTRA GOLD PVT LTD)
DEFAULT_PRODUCTS = {
    "pan": "97e4b21b-2cb9-4de7-b3d1-08b86ab45718",
    "digilocker": "41b74757-0871-4872-a036-8f0e0f0bf2bc",
    "bank": "d19c1b01-4962-4ef7-970a-dcd1ec11d009",
}


class SetuError(Exception):
    def __init__(self, message: str, status: int = 400, raw: Optional[dict] = None):
        super().__init__(message)
        self.status = status
        self.raw = raw or {}


def _headers(cfg: dict, product: str) -> dict:
    return {
        "x-client-id": cfg.get("client_id", ""),
        "x-client-secret": cfg.get("client_secret", ""),
        "x-product-instance-id": (cfg.get("products") or {}).get(product) or DEFAULT_PRODUCTS[product],
        "Content-Type": "application/json",
    }


def _err_message(data, fallback: str) -> str:
    if isinstance(data, dict):
        for k in ("message", "error", "detail", "errorMessage"):
            v = data.get(k)
            if isinstance(v, str) and v:
                return v
            if isinstance(v, dict):
                for kk in ("message", "detail", "code"):
                    if isinstance(v.get(kk), str):
                        return v[kk]
    return fallback


async def _call(cfg: dict, product: str, method: str, path: str, json: Optional[dict] = None) -> dict:
    if not cfg.get("client_id") or not cfg.get("client_secret"):
        raise SetuError("KYC service is not configured yet. Please contact the store.", 503)
    url = BASE.get(cfg.get("mode", "sandbox"), BASE["sandbox"]) + path
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as c:
            r = await c.request(method, url, headers=_headers(cfg, product), json=json)
    except httpx.HTTPError as e:
        raise SetuError(f"KYC service unreachable ({type(e).__name__}). Please try again.", 502)
    try:
        data = r.json()
    except ValueError:
        data = {"raw": r.text[:300]}
    if r.status_code >= 400:
        raise SetuError(_err_message(data, f"KYC check failed (HTTP {r.status_code})"), 400 if r.status_code < 500 else 502, data)
    return data if isinstance(data, dict) else {"data": data}


def _pick(d: dict, *keys, default=""):
    """First non-empty value among keys, searching d and d['data']."""
    for src in (d, d.get("data") if isinstance(d.get("data"), dict) else {}):
        for k in keys:
            v = src.get(k) if isinstance(src, dict) else None
            if v not in (None, ""):
                return v
    return default


def mask(v: str, keep: int = 4) -> str:
    v = re.sub(r"\s", "", str(v or ""))
    return ("X" * max(0, len(v) - keep)) + v[-keep:] if v else ""


# ─── PAN ────────────────────────────────────────────────────────────────────
async def verify_pan(cfg: dict, pan: str) -> dict:
    data = await _call(cfg, "pan", "POST", "/api/verify/pan", {
        "pan": pan, "consent": "Y", "reason": "KYC verification for digital gold account opening",
    })
    verification = str(_pick(data, "verification", "status")).lower()
    name = _pick(data, "full_name", "fullName", "name", "registered_name")
    ok = verification in ("success", "valid", "verified") or (bool(name) and verification not in ("failed", "invalid"))
    return {
        "valid": bool(ok),
        "name": str(name or "").strip(),
        "category": _pick(data, "category"),
        "aadhaar_linked": str(_pick(data, "aadhaar_seeding_status", "aadhaarSeedingStatus")).upper() in ("LINKED", "Y", "YES", "TRUE"),
        "message": _pick(data, "message"),
        "trace": data.get("traceId", ""),
    }


# ─── DigiLocker (Aadhaar) ───────────────────────────────────────────────────
async def digilocker_start(cfg: dict, redirect_url: str) -> dict:
    data = await _call(cfg, "digilocker", "POST", "/api/digilocker", {"redirectUrl": redirect_url})
    return {"id": _pick(data, "id", "requestId"), "url": _pick(data, "url", "link"), "status": _pick(data, "status"), "valid_upto": _pick(data, "validUpto")}


async def digilocker_status(cfg: dict, rid: str) -> str:
    data = await _call(cfg, "digilocker", "GET", f"/api/digilocker/{rid}/status")
    return str(_pick(data, "status")).lower()


async def digilocker_aadhaar(cfg: dict, rid: str) -> dict:
    data = await _call(cfg, "digilocker", "GET", f"/api/digilocker/{rid}/aadhaar")
    a = data.get("aadhaar") if isinstance(data.get("aadhaar"), dict) else (data.get("data") if isinstance(data.get("data"), dict) else data)
    addr = a.get("address") if isinstance(a.get("address"), dict) else {}
    uid = a.get("maskedNumber") or a.get("maskedAadhaarNumber") or a.get("uid") or a.get("aadhaarNumber") or ""
    return {
        "name": str(a.get("name") or "").strip(),
        "dob": a.get("dateOfBirth") or a.get("dob") or "",
        "gender": a.get("gender") or "",
        "aadhaar_last4": re.sub(r"\D", "", str(uid))[-4:],
        "city": addr.get("district") or addr.get("vtc") or addr.get("city") or "",
        "state": addr.get("state") or "",
        "pincode": addr.get("pin") or addr.get("pincode") or addr.get("postalCode") or "",
    }


# ─── Reverse Penny Drop (bank account) ─────────────────────────────────────
async def bank_rpd_start(cfg: dict, redirect_url: str = "", ref: str = "") -> dict:
    body = {"additionalData": {"ref": ref}} if ref else {}
    if redirect_url:
        body["redirectionConfig"] = {"redirectUrl": redirect_url, "timeout": 30}
    data = await _call(cfg, "bank", "POST", "/api/verify/ban/reverse", body)
    upi = data.get("upiBillPayment") or data.get("upi") or {}
    return {
        "id": _pick(data, "id"),
        "short_url": _pick(data, "shortUrl", "short_url") or (upi.get("shortUrl") if isinstance(upi, dict) else ""),
        "upi_link": (upi.get("upiLink") or upi.get("upiIntent")) if isinstance(upi, dict) else "",
        "status": _pick(data, "status"),
    }


def parse_rpd(data: dict) -> dict:
    d = data.get("data") if isinstance(data.get("data"), dict) else data
    acct = d.get("bankAccountNumber") or d.get("accountNumber") or ""
    status = str(d.get("status") or "").upper()
    return {
        "status": status,
        "success": "SUCCESS" in status and "FAIL" not in status,
        "failed": "FAIL" in status or "EXPIRED" in status,
        "name": str(d.get("name") or d.get("bankAccountName") or d.get("accountHolderName") or "").strip(),
        "account_masked": mask(acct),
        "ifsc": d.get("bankAccountIfsc") or d.get("ifsc") or "",
        "bank": d.get("bankName") or "",
        "id": d.get("id") or "",
    }


async def bank_rpd_status(cfg: dict, rid: str) -> dict:
    return parse_rpd(await _call(cfg, "bank", "GET", f"/api/verify/ban/reverse/{rid}"))


# ─── Name match ─────────────────────────────────────────────────────────────
_TITLES = {"mr", "mrs", "ms", "miss", "dr", "shri", "smt", "kumari", "km"}


def _tokens(s: str) -> set:
    return {t for t in re.sub(r"[^a-z ]", " ", (s or "").lower()).split() if t not in _TITLES}


def name_match(a: str, b: str) -> float:
    """0..1 similarity based on shared name words (handles initials and word order)."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    common = len(ta & tb)
    # initials: "N Aswani" vs "Niraj Aswani"
    for x in ta - tb:
        if len(x) == 1 and any(y.startswith(x) for y in tb - ta):
            common += 0.5
    return min(1.0, common / min(len(ta), len(tb)))
