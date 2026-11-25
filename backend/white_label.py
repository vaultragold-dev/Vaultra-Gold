"""White-label App Studio: theme presets, tenant config.json and App Kit (zip) generation.

Everything a CI/CD pipeline needs to build one jeweller's branded Android/iOS app from the
shared base app lives in the kit produced by `build_app_kit()`.
"""
import io
import json
import re
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path(__file__).resolve().parent / "fonts"  # GNU FreeSans: has ₹ and → glyphs (Inter does not)

# Five store-safe looks. Each changes colours, card shape and the order of home sections,
# so every jeweller's app looks distinct (helps App Store "4.3 spam" review).
THEME_PRESETS = {
    "royal_gold": {
        "label": "Royal Gold", "primaryColor": "#D4AF37", "secondaryColor": "#8A6E1C", "accentColor": "#111827",
        "backgroundColor": "#FDF8E8", "font": "Inter", "cardRadius": 18,
        "homeLayout": ["prices", "banners", "trending", "karats", "sip", "buy", "categories", "promos"],
    },
    "midnight_luxe": {
        "label": "Midnight Luxe", "primaryColor": "#C9A227", "secondaryColor": "#334155", "accentColor": "#0B1220",
        "backgroundColor": "#F1F3F7", "font": "Inter", "cardRadius": 12,
        "homeLayout": ["prices", "banners", "trending", "buy", "karats", "categories", "sip", "promos"],
    },
    "ivory_classic": {
        "label": "Ivory Classic", "primaryColor": "#A67C2E", "secondaryColor": "#5B4321", "accentColor": "#3A2E1F",
        "backgroundColor": "#FBF7EF", "font": "Inter", "cardRadius": 8,
        "homeLayout": ["prices", "banners", "trending", "karats", "buy", "categories", "sip", "promos"],
    },
    "emerald_heritage": {
        "label": "Emerald Heritage", "primaryColor": "#C8A04A", "secondaryColor": "#0F5132", "accentColor": "#064E3B",
        "backgroundColor": "#F3F8F5", "font": "Inter", "cardRadius": 14,
        "homeLayout": ["prices", "banners", "trending", "karats", "categories", "buy", "sip", "promos"],
    },
    "rose_gold": {
        "label": "Rose Gold", "primaryColor": "#B76E79", "secondaryColor": "#8C4A55", "accentColor": "#3B1F24",
        "backgroundColor": "#FDF4F3", "font": "Inter", "cardRadius": 22,
        "homeLayout": ["prices", "banners", "trending", "sip", "buy", "karats", "categories", "promos"],
    },
}
DEFAULT_PRESET = "royal_gold"

APP_STATUSES = ["details_pending", "theme_selected", "config_ready", "built", "submitted", "live"]
APP_STATUS_LABEL = {"details_pending": "Details pending", "theme_selected": "Theme chosen", "config_ready": "Config ready",
                    "built": "Built", "submitted": "Submitted to store", "live": "Live"}


def preset(key):
    return THEME_PRESETS.get(key or "", THEME_PRESETS[DEFAULT_PRESET])


def slugify(s, sep=""):
    return re.sub(r"[^a-z0-9]+", sep, (s or "").lower()).strip(sep) or "jeweller"


def default_bundle_id(business_name):
    # Reverse-DNS id, letters/digits only per segment, must not start with a digit
    seg = slugify(business_name)[:24]
    if seg[0].isdigit():
        seg = "j" + seg
    return f"in.{seg}.gold"


def valid_bundle_id(b):
    return bool(re.fullmatch(r"[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}", b or ""))


def default_store_text(j):
    name = j.app_name or f"{j.business_name} Gold"
    city = f" in {j.city}" if j.city else ""
    short = f"Buy 24K digital gold & silver from {j.business_name} starting ₹10."[:80]
    long = (
        f"{name} is the official app of {j.business_name}{city}.\n\n"
        "• Buy 24K 99.9% pure digital gold and 999 silver at live market rates\n"
        "• Every gram is backed by physical metal held in insured vaults\n"
        "• Start an Auto SIP from ₹100 and grow your savings in gold\n"
        "• Redeem as coins or jewellery at our store\n"
        "• Live 24K, 22K and 18K rates for jewellery shopping\n"
        "• Secure OTP login, KYC verified and tax invoices for every purchase\n\n"
        f"Visit {j.business_name} or contact us at {j.phone} for any help."
    )
    keywords = "digital gold,gold savings,buy gold,gold SIP,silver,jewellery," + slugify(j.business_name, " ")
    return short, long, keywords[:100]


def tenant_config(j, api_base, logo_bytes=None, splash_bytes=None):
    p = dict(preset(j.theme_preset))
    if getattr(j, "primary_color", None):
        p["primaryColor"] = j.primary_color
    if getattr(j, "secondary_color", None):
        p["secondaryColor"] = j.secondary_color
    if getattr(j, "accent_color", None):
        p["accentColor"] = j.accent_color
    if getattr(j, "background_color", None):
        p["backgroundColor"] = j.background_color
    p["textColor"] = getattr(j, "text_color", None) or p.get("textColor") or "#111827"
    short, long, kw = default_store_text(j)
    bundle = j.bundle_id or default_bundle_id(j.business_name)
    name = j.app_name or f"{j.business_name} Gold"

    # Auto-detect icon & splash background colors from uploaded assets
    adaptive_bg = p["primaryColor"]
    splash_bg = p["accentColor"]
    if logo_bytes:
        try:
            temp_logo = Image.open(io.BytesIO(logo_bytes))
            if not _is_transparent(temp_logo):
                adaptive_bg = _sample_bg_color(temp_logo)
        except Exception:
            pass
    splash_mode = "icon"
    try:
        _sp0 = Image.open(io.BytesIO(splash_bytes)) if splash_bytes else None
        if _sp0 is not None and _sp0.height > 1.2 * _sp0.width:
            splash_mode = "poster"  # full-screen splash image, shown edge to edge by the app (matches App Studio preview)
    except Exception:
        pass
    try:
        _lg = Image.open(io.BytesIO(logo_bytes)) if logo_bytes else None
        _sp = Image.open(io.BytesIO(splash_bytes)) if splash_bytes else None
        splash_bg = splash_background(p, _lg, _sp)
    except Exception:
        pass

    return {
        "tenantId": j.id,
        "appName": name,
        "slug": slugify(name, "-"),
        "bundleId": bundle,
        "packageName": bundle,
        "version": j.app_version or "1.0.0",
        "apiBaseUrl": api_base,
        "theme": {"preset": j.theme_preset or DEFAULT_PRESET, "primaryColor": p["primaryColor"],
                  "secondaryColor": p["secondaryColor"], "accentColor": p["accentColor"],
                  "backgroundColor": p["backgroundColor"], "textColor": p.get("textColor") or "#111827",
                  "adaptiveIconBackground": adaptive_bg,
                  "splashBackground": splash_bg,
                  "font": p["font"], "cardRadius": p["cardRadius"]},
        "homeLayout": p["homeLayout"],
        "assets": {"logoUrl": abs_url(j.logo_url, api_base), "splashUrl": abs_url(j.splash_url, api_base),
                   "splashMode": splash_mode,
                   "icon": "assets/icon.png", "adaptiveIcon": "assets/adaptive-icon.png", "splash": "assets/splash.png"},
        "support": {"phone": j.phone, "email": j.support_email or j.email},
        "storeInfo": {"name": j.business_name, "address": getattr(j, "address", "") or "", "city": getattr(j, "city", "") or "",
                      "state": getattr(j, "state", "") or "", "pincode": getattr(j, "pincode", "") or "",
                      "phone": getattr(j, "phone", "") or "", "lat": getattr(j, "store_lat", None), "lng": getattr(j, "store_lng", None),
                      "hours": getattr(j, "store_hours", "") or "10:00 AM – 8:00 PM (Mon–Sat)"},
        "store": {"shortDescription": j.store_short or short, "longDescription": j.store_long or long,
                  "keywords": j.store_keywords or kw,
                  "privacyPolicyUrl": f"{api_base}/api/tenant/{j.id}/privacy",
                  "termsUrl": f"{api_base}/api/tenant/{j.id}/terms"},
    }


def abs_url(u, base):
    if not u:
        return ""
    return base + u if u.startswith("/") else u


# ── image generation ─────────────────────────────────────────────────────────
def _font(size, weight=700):
    try:
        return ImageFont.truetype(str(FONT_DIR / ("FreeSansBold.ttf" if weight >= 600 else "FreeSans.ttf")), size)
    except OSError:
        return ImageFont.load_default()


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _gradient(w, h, c1, c2):
    a, b = _rgb(c1), _rgb(c2)
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    return img


def _initials(name):
    words = [w for w in re.split(r"\s+", name or "") if w and w[0].isalnum()]
    return "".join(w[0] for w in words[:2]).upper() or "G"


def _center_text(d, box_w, y, text, font, fill):
    w = d.textlength(text, font=font)
    d.text(((box_w - w) / 2, y), text, font=font, fill=fill)


def _is_transparent(img):
    """Returns True if the image has transparent corners (i.e. is an emblem/glyph, not a full-bleed square icon)."""
    if not img:
        return False
    if img.mode not in ("RGBA", "LA") and "transparency" not in img.info:
        return False
    rgba = img.convert("RGBA")
    w, h = rgba.size
    alpha = rgba.split()[3]
    test_points = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                   (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    transparent_count = sum(1 for pt in test_points if alpha.getpixel(pt) < 50)
    return transparent_count >= 4


def _sample_bg_color(img):
    """Sample the dominant background color from the edges/corners of the image."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    corners = [rgb.getpixel((0, 0)), rgb.getpixel((w - 1, 0)),
               rgb.getpixel((0, h - 1)), rgb.getpixel((w - 1, h - 1))]
    avg_r = sum(c[0] for c in corners) // 4
    avg_g = sum(c[1] for c in corners) // 4
    avg_b = sum(c[2] for c in corners) // 4
    return f"#{avg_r:02x}{avg_g:02x}{avg_b:02x}"


def _feather_square(img, target_size, feather=45):
    """Resizes square image to target_size with feathered (alpha-faded) edges for seamless blending."""
    scaled = img.convert("RGBA").resize((target_size, target_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (target_size, target_size), 255)
    d = ImageDraw.Draw(mask)
    for i in range(feather):
        alpha = int(255 * (i / max(feather, 1)))
        d.rectangle([i, i, target_size - 1 - i, target_size - 1 - i], outline=alpha)
    scaled.putalpha(mask)
    return scaled


def _paste_logo(canvas, logo, size, center):
    lg = logo.convert("RGBA")
    lg.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas.paste(lg, (int(center[0] - lg.width / 2), int(center[1] - lg.height / 2)), lg)


def make_icon(name, p, logo=None, transparent=False):
    s = 1024
    if not logo:
        # Fallback initials monogram
        img = Image.new("RGBA", (s, s), (0, 0, 0, 0)) if transparent else _gradient(s, s, p["primaryColor"], p["secondaryColor"]).convert("RGBA")
        d = ImageDraw.Draw(img)
        f = _font(420 if not transparent else 340)
        txt = _initials(name)
        w = d.textlength(txt, font=f)
        d.text(((s - w) / 2, s / 2 - 260 if not transparent else s / 2 - 210), txt, font=f,
               fill=(255, 255, 255) if not transparent else _rgb(p["secondaryColor"]))
        out = io.BytesIO()
        (img if transparent else img.convert("RGB")).save(out, "PNG")
        return out.getvalue()

    is_trans = _is_transparent(logo)

    if not is_trans:
        # User uploaded a full-bleed square icon with solid/gradient background (e.g. MVZA, Blinkit, etc.)
        bg_hex = _sample_bg_color(logo)
        bg_rgb = _rgb(bg_hex)
        lg = logo.convert("RGBA")
        w, h = lg.size

        if not transparent:
            # Full square icon for iOS, Play Store listing, Web
            img = Image.new("RGB", (s, s), bg_rgb)
            if 0.85 <= w / h <= 1.15:
                # Scale logo to target safe size (740px) with feathered edges so emblem has comfortable breathing room
                scaled = _feather_square(lg, 740, 45)
                pos = ((s - 740) // 2, (s - 740) // 2)
                img.paste(scaled.convert("RGB"), pos, scaled)
            else:
                # Aspect fit inside 740x740 centered
                lg_fit = lg.copy()
                lg_fit.thumbnail((740, 740), Image.Resampling.LANCZOS)
                img.paste(lg_fit, (int((s - lg_fit.width) / 2), int((s - lg_fit.height) / 2)), lg_fit)
            out = io.BytesIO()
            img.save(out, "PNG")
            return out.getvalue()
        else:
            # Android Adaptive Icon foreground (adaptive-icon.png):
            # Android launchers mask the outer 18-20% into squircles/circles within the 66% safe zone (~676px).
            # By scaling the emblem inside a 620px safe box with feathered edges onto bg_rgb canvas,
            # brand text & emblems will never touch or get clipped by Samsung squircles, Pixel circles, or OnePlus icons!
            img = Image.new("RGBA", (s, s), (*bg_rgb, 255))
            if 0.85 <= w / h <= 1.15:
                scaled = _feather_square(lg, 620, 45)
                pos = ((s - 620) // 2, (s - 620) // 2)
                img.paste(scaled, pos, scaled)
            else:
                lg_fit = lg.copy()
                lg_fit.thumbnail((620, 620), Image.Resampling.LANCZOS)
                img.paste(lg_fit, (int((s - lg_fit.width) / 2), int((s - lg_fit.height) / 2)), lg_fit)
            out = io.BytesIO()
            img.save(out, "PNG")
            return out.getvalue()
    else:
        # Transparent emblem/glyph logo uploaded
        if not transparent:
            # iOS / store icon: draw branded gradient and center logo inside safe zone
            img = _gradient(s, s, p["primaryColor"], p["secondaryColor"]).convert("RGBA")
            _paste_logo(img, logo, 520, (s / 2, s / 2))
            out = io.BytesIO()
            img.convert("RGB").save(out, "PNG")
            return out.getvalue()
        else:
            # Android Adaptive Icon foreground: transparent canvas with centered emblem
            img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
            _paste_logo(img, logo, 520, (s / 2, s / 2))
            out = io.BytesIO()
            img.save(out, "PNG")
            return out.getvalue()


def make_icon_512(name, p, logo=None):
    icon_bytes = make_icon(name, p, logo, transparent=False)
    img = Image.open(io.BytesIO(icon_bytes)).resize((512, 512), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


# Splash icon geometry (1024px canvas):
#  - Android 12+ shows the splash icon masked to a circle of 2/3 of the canvas (~683px).
#  - The logo is fitted inside that circle (square of 683/sqrt(2) = ~480px), so it is NEVER clipped on
#    Android 12+ and looks exactly the same size on Android 8-11 and iOS (app.config uses the same imageWidth).
SPLASH_CANVAS = 1024
SPLASH_LOGO = 470


def _splash_source(logo=None, splash_img=None):
    """Which uploaded image the splash uses: a square-ish splash upload, otherwise the brand logo."""
    if splash_img is not None and (logo is None or splash_img.height <= 1.2 * splash_img.width):
        w, h = splash_img.size
        if h > w:
            top = (h - w) // 2
            return splash_img.crop((0, top, w, top + w)), "splash"
        if w > h:
            left = (w - h) // 2
            return splash_img.crop((left, 0, left + h, h)), "splash"
        return splash_img, "splash"
    if logo is not None:
        return logo, "logo"
    return None, "none"


def splash_background(p, logo=None, splash_img=None):
    """Background colour of the splash image — the native splash window uses the SAME colour so no box is visible."""
    src, _ = _splash_source(logo, splash_img)
    if src is None or _is_transparent(src):
        return p["accentColor"]
    return _sample_bg_color(src)


def make_splash(name, p, logo=None, splash_img=None):
    """
    Generates the 1024x1024 splash icon shown centred on a full-screen background of the same colour.
    Same visual size on every phone (see SPLASH_LOGO above).
    """
    s = SPLASH_CANVAS
    src, _ = _splash_source(logo, splash_img)
    if src is not None:
        bg = _rgb(splash_background(p, logo, splash_img))
        img = Image.new("RGBA", (s, s), (*bg, 255))
        if _is_transparent(src):
            _paste_logo(img, src, SPLASH_LOGO, (s / 2, s / 2))
        else:
            w, h = src.size
            if 0.85 <= w / h <= 1.15:
                scaled = _feather_square(src.convert("RGBA"), SPLASH_LOGO, 70)
            else:
                scaled = src.convert("RGBA").copy()
                scaled.thumbnail((SPLASH_LOGO, SPLASH_LOGO), Image.Resampling.LANCZOS)
            img.paste(scaled, ((s - scaled.width) // 2, (s - scaled.height) // 2), scaled)
        out = io.BytesIO()
        img.convert("RGB").save(out, "PNG")
        return out.getvalue()
    # Default initials monogram
    img = Image.new("RGB", (s, s), _rgb(p["accentColor"]))
    d = ImageDraw.Draw(img)
    f = _font(280)
    _center_text(d, s, s / 2 - 200, _initials(name), f, _rgb(p["primaryColor"]))
    _center_text(d, s, s / 2 + 100, name, _font(56), (255, 255, 255))
    _center_text(d, s, s / 2 + 180, "24K Digital Gold", _font(34, 500), _rgb(p["primaryColor"]))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def _inr(n):
    s = f"{n:,.2f}"
    whole, dec = s.split(".")
    digits = whole.replace(",", "")
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        head = ",".join([head[max(i - 2, 0):i] for i in range(len(head), 0, -2)][::-1])
        whole = head + "," + tail
    return f"₹{whole}.{dec}"


def make_screenshot(kind, name, p, rates, logo=None):
    """Store-size (1290x2796, iPhone 6.7") screenshot drawn in the chosen theme."""
    W, H = 1290, 2796
    img = Image.new("RGB", (W, H), _rgb(p["backgroundColor"]))
    d = ImageDraw.Draw(img)
    pri, sec, acc = _rgb(p["primaryColor"]), _rgb(p["secondaryColor"]), _rgb(p["accentColor"])
    r = p["cardRadius"] * 3
    # marketing headline band
    head = {"home": ("Live gold rates", "Buy 24K gold from ₹10"), "rates": ("24K · 22K · 18K", "Today's rates, every second"),
            "vault": ("Your gold vault", "Insured, 99.9% pure, always yours")}[kind]
    band = _gradient(W, 620, p["accentColor"], p["secondaryColor"])
    img.paste(band, (0, 0))
    _center_text(d, W, 200, head[0], _font(96), (255, 255, 255))
    _center_text(d, W, 330, head[1], _font(54, 500), pri)
    # app header
    y = 700
    d.rounded_rectangle([60, y, 180, y + 120], 30, fill=pri)
    d.text((86, y + 22), _initials(name)[:2], font=_font(64), fill=(255, 255, 255))
    d.text((210, y + 30), name[:22], font=_font(64), fill=acc)
    y += 200
    if kind in ("home", "rates"):
        g24 = rates.get("24K", 0)
        if kind == "home":
            cards = [("Gold 24K", g24), ("Silver 999", rates.get("silver", 0))]
            cw = (W - 180) // 2
            for i, (lbl, val) in enumerate(cards):
                x = 60 + i * (cw + 60)
                d.rounded_rectangle([x, y, x + cw, y + 380], r, fill=acc)
                d.text((x + 40, y + 50), "LIVE RATE", font=_font(34, 600), fill=pri)
                d.text((x + 40, y + 120), lbl, font=_font(56), fill=pri if i == 0 else (229, 231, 235))
                d.text((x + 40, y + 220), (_inr(val) if val else "—") + "/g", font=_font(58), fill=(255, 255, 255))
            y += 460
            rows = [("24K · 99.9%", rates.get("24K", 0)), ("22K · 91.6%", rates.get("22K", 0)), ("18K · 75.0%", rates.get("18K", 0))]
        else:
            rows = [("Gold 24K · 99.9%", rates.get("24K", 0)), ("Gold 22K · 91.6%", rates.get("22K", 0)),
                    ("Gold 18K · 75.0%", rates.get("18K", 0)), ("Silver 999", rates.get("silver", 0))]
        d.rounded_rectangle([60, y, W - 60, y + 120 + 150 * len(rows)], r, fill=(255, 255, 255), outline=pri, width=3)
        d.text((110, y + 40), "Today's gold rates", font=_font(52), fill=acc)
        for i, (lbl, val) in enumerate(rows):
            yy = y + 150 + i * 150
            d.text((110, yy), lbl, font=_font(50, 500), fill=sec)
            v = (_inr(val) if val else "—") + "/g"
            d.text((W - 110 - d.textlength(v, font=_font(54)), yy), v, font=_font(54), fill=acc)
        y += 180 + 150 * len(rows)
        d.rounded_rectangle([60, y, W - 60, y + 170], r, fill=pri)
        _center_text(d, W, y + 50, "Buy Gold  →", _font(66), (255, 255, 255))
    else:
        d.rounded_rectangle([60, y, W - 60, y + 560], r, fill=acc)
        d.text((120, y + 70), "Gold balance", font=_font(48, 500), fill=pri)
        d.text((120, y + 160), "12.5000 g", font=_font(120), fill=(255, 255, 255))
        d.text((120, y + 340), "≈ " + (_inr(12.5 * rates.get("24K", 0)) if rates.get("24K") else "—"), font=_font(60, 600), fill=(229, 231, 235))
        y += 640
        for i, (t, s) in enumerate([("Auto SIP", "₹500 every month"), ("Redeem", "Coins & jewellery at store"), ("Live rates", "24K · 22K · 18K every second")]):
            d.rounded_rectangle([60, y, W - 60, y + 220], r, fill=(255, 255, 255), outline=pri, width=3)
            d.ellipse([110, y + 50, 230, y + 170], fill=pri)
            d.text((280, y + 50), t, font=_font(58), fill=acc)
            d.text((280, y + 125), s, font=_font(44, 500), fill=sec)
            y += 260
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def make_feature_graphic(name, p, logo=None):
    img = _gradient(1024, 500, p["accentColor"], p["secondaryColor"])
    d = ImageDraw.Draw(img)
    d.text((70, 150), name[:26], font=_font(72), fill=(255, 255, 255))
    d.text((70, 260), "24K Digital Gold · Live rates · SIP", font=_font(36, 500), fill=_rgb(p["primaryColor"]))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def privacy_html(j=None, terms=False):
    app_name = (getattr(j, "app_name", None) or getattr(j, "business_name", None) or "Vaultra Gold") if j else "Vaultra Gold"
    business = getattr(j, "business_name", "Vaultra Gold Private Limited") if j else "Vaultra Gold Private Limited"
    support_email = (getattr(j, "support_email", None) or getattr(j, "email", None) or "info@vaultragold.com") if j else "info@vaultragold.com"
    support_phone = getattr(j, "phone", "+91 98765 43210") if j else "+91 98765 43210"
    addr = f"{getattr(j, 'address', '')} {getattr(j, 'city', '')} {getattr(j, 'state', '')} {getattr(j, 'pincode', '')}".strip() if j else "Ahmedabad, Gujarat, India"
    if not addr:
        addr = "Ahmedabad, Gujarat, India"

    is_partner = (j is not None and getattr(j, "id", "") not in ("master", "vaultra", ""))
    partner_note = (
        f"<div class='partner-badge'><strong>Partner Store:</strong> {business} operates the {app_name} consumer storefront, powered by the core technology and 24K digital bullion infrastructure of <strong>Vaultra Gold Private Limited</strong>.</div>"
        if is_partner else
        "<div class='partner-badge'><strong>Official Platform Policy:</strong> Governs Vaultra Gold applications, websites, and digital precious metals vaulting infrastructure operated by <strong>Vaultra Gold Private Limited</strong>.</div>"
    )

    if terms:
        title = f"Terms & Conditions of Service — {app_name}"
        effective_date = "November 18, 2026"
        content = f"""
        {partner_note}
        <p class="lead">Please read these Terms and Conditions carefully before accessing or using the <strong>{app_name}</strong> mobile application, website, or services. By downloading, browsing, creating an account, or transacting on the platform, you agree to be bound by these Terms.</p>

        <h2>1. The Platform & Operational Framework</h2>
        <p>The {app_name} mobile application and associated web interfaces (collectively, the &ldquo;Platform&rdquo;) provide users with access to 24 Karat 999.0 purity digital gold and 999 purity digital silver accumulation, systematic investment plans (SIPs), live spot rate feeds, and in-store bullion redemption services. Technology infrastructure, live market pricing engines, digital ledger vaulting, and transaction settlement are operated by <strong>Vaultra Gold Private Limited</strong> (&ldquo;Vaultra Gold&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), alongside authorized partner jewellers.</p>

        <h2>2. Eligibility</h2>
        <p>You must be at least 18 years of age and legally competent to enter into binding contracts under the Indian Contract Act, 1872. By creating an account, you represent that all information provided (including your phone number, legal name, and KYC identifiers) is accurate and truthful.</p>

        <h2>3. Bullion Purity & 1:1 Physical Custody Backing</h2>
        <p>Every digital gold transaction purchases <strong>24 Karat Gold of 999.0 fineness (99.9% pure)</strong>, and every digital silver transaction purchases <strong>Silver of 999.0 fineness</strong>. All digital balances recorded in your vault ledger are backed 1:1 by physical bullion bars safely held and insured in accredited institutional vaults on behalf of the customer.</p>

        <h2>4. Live Market Pricing & Spreads</h2>
        <ul>
            <li><strong>Live Rate Synchronisation:</strong> Buy and sell prices are streamed in real time based on active commodity market spot rates and commodity exchange benchmarks (MCX/MT5).</li>
            <li><strong>Applicable Taxes:</strong> In compliance with Government of India regulations, a 3% Goods and Services Tax (GST) is levied on all digital gold and silver purchases and is clearly itemized on every invoice.</li>
            <li><strong>Price Lock Window:</strong> When you initiate a purchase or sale, the rate is locked for up to 120 seconds to protect you from interim market fluctuations while completing payment.</li>
            <li><strong>Minimum Investment:</strong> Purchases can be made starting from an accessible minimum order value of ₹500 for both digital gold and silver.</li>
        </ul>

        <h2>5. Instant Settlement & Non-Refundability</h2>
        <p>Due to the real-time volatility of precious metal spot commodity markets, once a buy or sell transaction is completed and confirmed via the payment aggregator, <strong>it cannot be cancelled, reversed, or refunded</strong>. Customers may liquidate their accumulated metal at any time by executing a sell order at the prevailing live sell rate.</p>

        <h2>6. Systematic Investment Plan (SIP)</h2>
        <p>Users may set up automated daily, weekly, or monthly SIPs. SIP purchases execute at the prevailing live buy rate at the scheduled trigger time. Users retain complete freedom to pause, edit, or terminate an active SIP mandate at any time without penalty or exit load.</p>

        <h2>7. In-Store Redemption for Physical Coins & Jewellery</h2>
        <p>Accumulated digital gold and silver balances can be redeemed as physical certified coins, minted bars, or jewellery across authorized retail showrooms. Counter redemption requires presenting the one-time pickup OTP generated in the mobile app along with matching government-issued photo identification.</p>

        <h2>8. Buyback & Liquidation to Cash</h2>
        <p>Customers may sell their vaulted gold or silver back through the app at the transparent live sell rate displayed on screen. Sale proceeds are remitted electronically to the customer&rsquo;s verified Indian bank account or UPI VPA within standard banking settlement windows (T+1 business days).</p>

        <h2>9. Know Your Customer (KYC) & Regulatory Compliance</h2>
        <p>In adherence to the Prevention of Money Laundering Act (PMLA), 2002, and RBI/Income Tax guidelines, KYC verification (PAN, Aadhaar/Government ID) is mandatory for cumulative transactions reaching statutory thresholds (₹2,00,000/-) or physical bullion delivery. Accounts providing fraudulent or forged documentation will be suspended.</p>

        <h2>10. Market Risk Disclosures</h2>
        <p>Precious metals commodity prices fluctuate according to global macro-economic conditions, currency rates, and market liquidity. Past price trends do not guarantee future performance. Vaultra Gold does not provide financial or speculative trading advice.</p>

        <h2>11. Termination & Account Closure</h2>
        <p>Users may close their account at any time provided all metal balances have been liquidated or redeemed. Vaultra Gold reserves the right to suspend accounts engaged in fraudulent activity, payment chargebacks, or violations of applicable Indian laws.</p>

        <h2>12. Governing Law & Dispute Resolution</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any legal dispute arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts in <strong>Ahmedabad, Gujarat, India</strong>.</p>

        <h2>13. Customer Support & Contact</h2>
        <p>For inquiries, support, or billing concerns:<br>
        <strong>Vaultra Gold Support:</strong> <a href="mailto:{support_email}">{support_email}</a><br>
        <strong>Phone:</strong> {support_phone}<br>
        <strong>Address:</strong> {addr}</p>
        """
    else:
        title = f"Privacy Policy — {app_name}"
        effective_date = "November 18, 2026"
        content = f"""
        {partner_note}
        <p class="lead"><strong>Vaultra Gold Private Limited</strong> (&ldquo;Vaultra Gold&rdquo;, &ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to safeguarding your personal data and privacy. This Privacy Policy governs your use of the <strong>{app_name}</strong> mobile applications (iOS and Android), web portals, and services.</p>

        <p>This Policy is published in compliance with the <strong>Information Technology Act, 2000</strong>, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong>.</p>

        <h2>1. Information We Collect (Google Play & App Store Data Safety)</h2>
        <p>We collect only the minimum necessary information required to operate a secure digital bullion vault and satisfy statutory Indian financial compliance:</p>
        <ul>
            <li><strong>Personal & Contact Data:</strong> Mobile phone number (used as your primary account identifier and for secure OTP sign-in), First and Last Name, Email address, Date of Birth, and Gender.</li>
            <li><strong>Identity & KYC Documentation:</strong> Permanent Account Number (PAN), Government identity details (Aadhaar, Passport, or Voter ID), and selfie/face photo. <em>Collection is strictly conducted in compliance with PMLA regulations for cumulative transactions exceeding statutory limits (₹2,00,000/-) or physical bullion redemption.</em></li>
            <li><strong>Financial & Transaction Records:</strong> Purchase history, sell orders, SIP schedules, fractional gram holdings, GST tax invoice records, and bank account / UPI VPA details submitted for receiving sale payouts. <em>Payment Card Security Note: We DO NOT collect, store, or process credit/debit card numbers, CVVs, netbanking passwords, or UPI MPINs. All payment transactions are processed through RBI-authorized payment aggregators (e.g., Razorpay) via 256-bit encrypted checkout.</em></li>
            <li><strong>Device & Diagnostics Data:</strong> IP address, device model, operating system version, unique device identifiers, app version, network state, and crash diagnostics used strictly for fraud prevention, server load balancing, and stability.</li>
            <li><strong>OTP Authentication:</strong> One-time password verification via SMS and WhatsApp (via licensed telecom gateways such as Hanu). We <strong>DO NOT</strong> request or access your private SMS inbox.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
            <li>To create, authenticate, and maintain your 24K 999.0 digital gold and silver vault account.</li>
            <li>To process instant buy, sell, SIP, and counter redemption transactions at live spot rates.</li>
            <li>To issue legally valid GST invoices and annual transaction statements.</li>
            <li>To prevent fraud, identity theft, money laundering, and unauthorized bullion redemptions.</li>
            <li>To transmit critical transactional confirmations, OTP codes, and rate alerts requested by you.</li>
            <li>To comply with regulatory obligations under Indian tax laws and the Prevention of Money Laundering Act, 2002.</li>
        </ul>

        <h2>3. We Never Sell Your Data</h2>
        <p><strong>Vaultra Gold does not sell, rent, monetize, or trade your personal information</strong> with third-party data brokers, marketers, or advertisers under any circumstances.</p>

        <h2>4. Disclosures & Authorized Third Parties</h2>
        <p>We share data strictly on a need-to-know basis with trusted partners who are bound by strict non-disclosure and data protection agreements:</p>
        <ul>
            <li><strong>Authorized Partner Jeweller:</strong> If you use a partner store branded application, order and pickup verification details are shared with the participating jeweller ({business}) to enable in-store physical gold pickup and customer care.</li>
            <li><strong>Payment Aggregators:</strong> RBI-licensed payment gateways (Razorpay Software Private Limited) to process UPI, cards, and netbanking.</li>
            <li><strong>Telecom Gateways:</strong> Licensed SMS and WhatsApp business service providers (Hanu) strictly for sending 6-digit OTP verification codes.</li>
            <li><strong>Vault Custodians & Insurers:</strong> Independent institutional vaults storing physical bullion backing your digital holdings.</li>
            <li><strong>Statutory & Regulatory Authorities:</strong> Government bodies, tax authorities, or law enforcement agencies only when legally compelled by a binding court order, summons, or statutory duty under Indian law.</li>
        </ul>

        <h2>5. Data Security & Storage Standards</h2>
        <p>We employ enterprise-grade security protocols conforming to ISO/IEC 27001 and RBI cyber security guidelines:</p>
        <ul>
            <li><strong>Encryption in Transit:</strong> All data transmitted between your device and our servers is secured using modern TLS 1.3 / SSL 256-bit encryption.</li>
            <li><strong>Encryption at Rest:</strong> Sensitive credentials, tokens, and KYC data are encrypted using industry-standard AES-256 algorithms.</li>
            <li><strong>Domestic Data Residency:</strong> All customer vaults, transaction ledgers, and database backups are hosted domestically within the Republic of India in secure data centers.</li>
            <li><strong>Access Controls:</strong> Multi-factor authentication and strict role-based access control (RBAC) restrict internal ledger access to authorized security personnel only.</li>
        </ul>

        <h2>6. Account Deletion & Statutory Retention Policy</h2>
        <p>In full compliance with <strong>Google Play Data Safety</strong> and <strong>Apple App Store Guideline 5.1.1(v)</strong>, users have the unconditional right to delete their account and have their personal data scrubbed:</p>
        <ul>
            <li><strong>In-App Deletion:</strong> Open the app &rarr; go to <strong>Profile</strong> &rarr; tap <strong>Delete Account</strong> &rarr; confirm deletion.</li>
            <li><strong>Web Deletion Portal:</strong> You can submit a deletion request anytime via our dedicated portal at <a href="https://master.vaultragold.com/delete-account">https://master.vaultragold.com/delete-account</a> or by emailing <a href="mailto:info@vaultragold.com">info@vaultragold.com</a>.</li>
            <li><strong>Mandatory Pre-requisite:</strong> To prevent financial loss, your gold, silver, and wallet balance must be zero (liquidated or redeemed) before account deletion can be completed.</li>
            <li><strong>Data Retention Limitations:</strong> Upon confirmed deletion, your personal identifiers (name, phone number, email, profile photo, authentication tokens) are permanently deleted or anonymized within 30 days. However, as mandated by Section 12 of the <strong>Prevention of Money Laundering Act (PMLA), 2002</strong>, and Section 36 of the <strong>Central Goods and Services Tax (CGST) Act, 2017</strong>, financial transaction ledgers, invoices, and statutory audit logs must be maintained in an encrypted, read-only regulatory archive for a statutory period of <strong>5 (five) years</strong>, after which they are permanently purged.</li>
        </ul>

        <h2>7. Your Rights under the DPDP Act, 2023</h2>
        <p>As a data principal, you have the right to:</p>
        <ul>
            <li>Access a summary of your personal data and vault transaction history.</li>
            <li>Request correction or updating of inaccurate personal data.</li>
            <li>Withdraw consent and request account deletion.</li>
            <li>Seek redressal of any grievance through our Grievance Officer.</li>
        </ul>

        <h2>8. Children's Privacy</h2>
        <p>The Platform is intended strictly for individuals aged 18 and older. We do not knowingly collect personal information from minors.</p>

        <h2>9. Grievance Redressal Officer (IT Rules, 2021)</h2>
        <p>In accordance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Digital Personal Data Protection Act, 2023, the contact details of our Grievance Redressal Officer are:</p>
        <div class="officer-box">
            <strong>Grievance Redressal Officer</strong><br>
            Vaultra Gold Private Limited<br>
            <strong>Email:</strong> <a href="mailto:info@vaultragold.com">info@vaultragold.com</a><br>
            <strong>Phone:</strong> {support_phone}<br>
            <strong>Registered Office:</strong> {addr}<br>
            <em>Acknowledgment timeframe: within 24 hours &middot; Resolution timeframe: within 15 business days</em>
        </div>

        <h2>10. Updates to this Policy</h2>
        <p>We may update this Privacy Policy from time to time to reflect evolving regulatory requirements or platform features. Significant updates will be notified through the mobile application or our website.</p>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    :root {{
      --gold-primary: #C59A45;
      --gold-dark: #8F6A1E;
      --gold-light: #FBF4E6;
      --text-main: #1A1A1A;
      --text-muted: #555555;
      --bg-page: #F8F9FA;
      --bg-card: #FFFFFF;
      --border-color: #E5E7EB;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      line-height: 1.68;
      padding: 0 16px 60px;
    }}
    header {{
      background: linear-gradient(135deg, #1C1917 0%, #292524 100%);
      color: #FFFFFF;
      padding: 36px 20px;
      margin: -0 -16px 32px -16px;
      text-align: center;
      border-bottom: 3px solid var(--gold-primary);
    }}
    .brand-title {{
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #F6D686;
      margin-bottom: 6px;
    }}
    .doc-subtitle {{
      font-size: 14px;
      color: #D6D3D1;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }}
    .container {{
      max-width: 820px;
      margin: 0 auto;
      background: var(--bg-card);
      padding: 40px;
      border-radius: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--border-color);
    }}
    .nav-tabs {{
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 12px;
    }}
    .nav-tabs a {{
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 6px;
      transition: all 0.2s;
    }}
    .nav-tabs a.active, .nav-tabs a:hover {{
      background: var(--gold-light);
      color: var(--gold-dark);
    }}
    h1 {{
      font-size: 24px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }}
    .date-badge {{
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 24px;
    }}
    .partner-badge {{
      background: #FFFBEB;
      border-left: 4px solid var(--gold-primary);
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      color: #92400E;
      margin-bottom: 24px;
    }}
    .lead {{
      font-size: 16px;
      color: #374151;
      margin-bottom: 24px;
      font-weight: 500;
    }}
    h2 {{
      font-size: 18px;
      font-weight: 700;
      color: #1F2937;
      margin: 30px 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border-color);
    }}
    p {{
      margin-bottom: 16px;
      font-size: 15px;
      color: #374151;
    }}
    ul {{
      margin: 12px 0 20px 24px;
      color: #374151;
    }}
    li {{
      margin-bottom: 8px;
      font-size: 15px;
    }}
    a {{
      color: var(--gold-dark);
      text-decoration: underline;
      font-weight: 600;
    }}
    .officer-box {{
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 18px;
      margin: 16px 0;
      font-size: 14px;
      line-height: 1.6;
    }}
    footer {{
      text-align: center;
      margin-top: 40px;
      font-size: 13px;
      color: #9CA3AF;
    }}
    @media (max-width: 640px) {{
      .container {{ padding: 22px 18px; }}
      h1 {{ font-size: 20px; }}
      h2 {{ font-size: 16px; }}
    }}
  </style>
</head>
<body>
  <header>
    <div class="brand-title">VAULTRA GOLD</div>
    <div class="doc-subtitle">Institutional 24K Digital Gold & Silver Infrastructure</div>
  </header>
  <div class="container">
    <div class="nav-tabs">
      <a href="privacy" class="{"active" if not terms else ""}">Privacy Policy</a>
      <a href="terms" class="{"active" if terms else ""}">Terms of Service</a>
      <a href="/delete-account">Account Deletion</a>
    </div>
    <h1>{title}</h1>
    <div class="date-badge">Effective Date: {effective_date} &middot; Version 2.4</div>
    {content}
    <footer>
      &copy; 2026 Vaultra Gold Private Limited. All Rights Reserved.<br>
      Licensed Digital Gold & Silver Infrastructure Provider
    </footer>
  </div>
</body>
</html>"""


def delete_account_html(j=None):
    app_name = (getattr(j, "app_name", None) or getattr(j, "business_name", None) or "Vaultra Gold") if j else "Vaultra Gold"
    support_email = (getattr(j, "support_email", None) or getattr(j, "email", None) or "info@vaultragold.com") if j else "info@vaultragold.com"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Delete Account — {app_name}</title>
  <style>
    :root {{
      --gold: #C59A45;
      --danger: #DC2626;
      --bg: #F8F9FA;
      --text: #1F2937;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 30px 16px;
    }}
    .box {{
      max-width: 600px;
      margin: 40px auto;
      background: #FFF;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      border: 1px solid #E5E7EB;
    }}
    h1 {{ font-size: 22px; color: #111; margin-bottom: 12px; }}
    p {{ font-size: 15px; margin-bottom: 16px; color: #4B5563; }}
    .alert {{
      background: #FEF2F2;
      border-left: 4px solid var(--danger);
      padding: 14px;
      color: #991B1B;
      font-size: 14px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
    }}
    .steps {{
      background: #F9FAFB;
      border-radius: 8px;
      padding: 18px 22px;
      margin-bottom: 24px;
    }}
    .steps ol {{ margin-left: 18px; }}
    .steps li {{ margin-bottom: 8px; font-size: 14px; color: #374151; }}
    .btn {{
      display: inline-block;
      background: var(--gold);
      color: #FFF;
      text-decoration: none;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 8px;
      text-align: center;
    }}
    .retention {{
      font-size: 13px;
      color: #6B7280;
      border-top: 1px solid #E5E7EB;
      padding-top: 18px;
      margin-top: 24px;
    }}
  </style>
</head>
<body>
  <div class="box">
    <h1>Delete Your {app_name} Account</h1>
    <p>We respect your privacy and provide two simple methods to permanently delete your account and personal data:</p>

    <div class="steps">
      <strong>Method 1: Direct In-App Deletion (Instant)</strong>
      <ol>
        <li>Open the <strong>{app_name}</strong> mobile app.</li>
        <li>Go to <strong>Profile / Account</strong> from the bottom menu.</li>
        <li>Scroll down and tap <strong>Delete Account</strong>.</li>
        <li>Confirm the deletion prompt. Your session and credentials will be purged immediately.</li>
      </ol>
    </div>

    <div class="alert">
      <strong>Important Requirement:</strong> To protect your financial assets, your gold and silver vault balance must be <strong>0.0000 grams</strong> (sold or redeemed in store) before deletion. If you hold metal, please liquidate or collect it first.
    </div>

    <div class="steps">
      <strong>Method 2: Web Deletion Request</strong>
      <p style="margin-top: 8px; font-size: 14px;">If you no longer have access to the mobile application, you can submit an account closure request directly to our security team:</p>
      <p style="margin-top: 8px;"><a href="mailto:{support_email}?subject=Account%20Deletion%20Request%20-%20{app_name}&body=Please%20delete%20my%20account.%20Registered%20Mobile%20Number:%20" class="btn">Email Account Deletion Request</a></p>
    </div>

    <div class="retention">
      <strong>Statutory Data Retention Notice:</strong> Upon account deletion, all personal identification data (name, phone number, email, address, profile photo, and active credentials) is deleted or scrubbed within 30 days. In compliance with the Prevention of Money Laundering Act (PMLA), 2002, and GST tax laws, historical financial ledger entries and tax invoices must be retained in an encrypted regulatory archive for 5 years.
    </div>
  </div>
</body>
</html>"""


def build_app_kit(j, api_base, rates, logo_bytes=None, splash_bytes=None):
    cfg = tenant_config(j, api_base, logo_bytes, splash_bytes)
    p = dict(preset(j.theme_preset))
    if getattr(j, "primary_color", None):
        p["primaryColor"] = j.primary_color
    if getattr(j, "secondary_color", None):
        p["secondaryColor"] = j.secondary_color
    if getattr(j, "accent_color", None):
        p["accentColor"] = j.accent_color
    if getattr(j, "background_color", None):
        p["backgroundColor"] = j.background_color
    p["textColor"] = getattr(j, "text_color", None) or p.get("textColor") or "#111827"
    name = cfg["appName"]
    logo = Image.open(io.BytesIO(logo_bytes)) if logo_bytes else None
    splash_img = Image.open(io.BytesIO(splash_bytes)) if splash_bytes else None

    # Generate 1024x1024 square splash icon (blends seamlessly with splashBackground)
    splash_data = make_splash(name, p, logo, splash_img)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("config.json", json.dumps(cfg, indent=2, ensure_ascii=False))
        z.writestr("assets/icon.png", make_icon(name, p, logo))
        z.writestr("assets/adaptive-icon.png", make_icon(name, p, logo, transparent=True))
        z.writestr("assets/splash.png", splash_data)
        if logo_bytes:
            z.writestr("assets/logo-original.png", logo_bytes)
        if splash_bytes:
            z.writestr("assets/splash-original.png", splash_bytes)
        for i, kind in enumerate(("home", "rates", "vault"), 1):
            z.writestr(f"store/screenshots/{i}-{kind}.png", make_screenshot(kind, name, p, rates, logo))
        z.writestr("store/feature-graphic.png", make_feature_graphic(name, p, logo))
        z.writestr("store/icon-512x512.png", make_icon_512(name, p, logo))
        s = cfg["store"]
        z.writestr("store/listing.md", f"# {name}\n\n**Short description:** {s['shortDescription']}\n\n**Keywords:** {s['keywords']}\n\n"
                   f"**Privacy policy:** {s['privacyPolicyUrl']}\n**Terms:** {s['termsUrl']}\n\n## Full description\n\n{s['longDescription']}\n")
        z.writestr("store/privacy-policy.html", privacy_html(j))
        z.writestr("store/terms.html", privacy_html(j, terms=True))
        z.writestr("store/delete-account.html", delete_account_html(j))
        z.writestr("README.md", KIT_README.format(name=name, bundle=cfg["bundleId"], tenant=j.id))
    return buf.getvalue(), cfg


KIT_README = """# App Kit — {name}

Tenant ID: `{tenant}` · Bundle / package ID: `{bundle}`

## Inject into the base app (CI/CD)
1. Copy `config.json` to `frontend/tenant.config.json` (replaces the empty base file).
2. Copy `assets/*` to `frontend/tenant-assets/`.
3. Set `EXPO_PUBLIC_BACKEND_URL` to the `apiBaseUrl` in config.json.
4. Run your pipeline's Android (AAB) and iOS (IPA) build. `app.config.js` reads
   tenant.config.json and sets the app name, bundle ID, package, icon and splash automatically.

The app then opens directly into this jeweller's store, sends `X-Tenant-ID: {tenant}` on every
API request, and uses this jeweller's theme, logo and home layout.

## Store submission
- `store/listing.md` — name, short/long description, keywords
- `store/screenshots/` — 1290×2796 (iPhone 6.7") images, also accepted by Google Play
- `store/feature-graphic.png` — Google Play 1024×500
- Privacy policy and terms URLs are hosted by the platform (see listing.md)
"""
