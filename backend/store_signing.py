"""Store signing automation for App Studio.

- Android: generates one upload keystore per jeweller (PKCS12, RSA 2048, 25 years) and stores it as GitHub
  Actions secrets with the jeweller's store key as suffix (ANDROID_KEYSTORE_BASE64_<KEY> ...).
- Apple: App Store Connect API keys cannot be created by software, so they are entered once per Apple account,
  verified against Apple, kept encrypted and pushed as GitHub secrets for every jeweller that uses that account.
- Google Play: optional service-account JSON for automatic uploads.

Everything sensitive is encrypted at rest (Fernet) before it goes into app_settings.
"""
import base64
import hashlib
import json
import os
import re
import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import requests
from cryptography import x509
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

GH_API = "https://api.github.com"
ASC_API = "https://api.appstoreconnect.apple.com"
KEY_ALIAS = "upload"


class SigningError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ─── Encryption at rest ─────────────────────────────────────────────────────
def _fernet() -> Fernet:
    raw = (os.environ.get("STORE_SECRETS_KEY") or "").strip()
    if raw:
        try:
            return Fernet(raw.encode())
        except (ValueError, TypeError):
            seed = raw
    else:
        seed = os.environ.get("JWT_SECRET", "")
    if not seed:
        raise SigningError("JWT_SECRET / STORE_SECRETS_KEY is not configured", 500)
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("vaultra-store-signing:" + seed).encode()).digest()))


def seal(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def unseal(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    try:
        return json.loads(_fernet().decrypt(token.encode()).decode())
    except (InvalidToken, ValueError):
        return None


def mask(v: str, keep: int = 4) -> str:
    v = str(v or "")
    return ("•" * 10 + v[-keep:]) if v else ""


# ─── Store key (GitHub secret suffix) ───────────────────────────────────────
def make_store_key(business_name: str, jid: str, taken: set) -> str:
    """Readable, unique, GitHub-safe suffix, e.g. 'XYZJEWELLERS'."""
    base = re.sub(r"[^A-Z0-9]", "", (business_name or "").upper())[:24] or "SHOP"
    if base[0].isdigit() or base.startswith("GITHUB"):
        base = "J" + base
    key = base
    if key in taken:
        key = f"{base}_{re.sub(r'[^A-Z0-9]', '', jid.upper())[:6]}"
    return key[:40]


# ─── Android upload keystore ────────────────────────────────────────────────
def _password(n: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def generate_keystore(org_name: str) -> dict:
    """PKCS12 keystore readable by keytool / Gradle (JDK 9+ autodetects PKCS12 even for type JKS)."""
    password = _password()
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cn = re.sub(r"[^A-Za-z0-9 &.\-]", "", org_name or "Vaultra Jeweller")[:60] or "Vaultra Jeweller"
    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, cn),
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
    ])
    now = datetime.now(timezone.utc)
    valid_to = now + timedelta(days=365 * 25 + 6)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject).issuer_name(subject).public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5)).not_valid_after(valid_to)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    # Legacy PBES (3DES + SHA1 MAC): readable by every Java / keytool version
    enc = (
        serialization.PrivateFormat.PKCS12.encryption_builder()
        .kdf_rounds(50000)
        .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
        .hmac_hash(hashes.SHA1())
        .build(password.encode())
    )
    p12 = pkcs12.serialize_key_and_certificates(KEY_ALIAS.encode(), key, cert, None, enc)
    fp = cert.fingerprint(hashes.SHA256()).hex().upper()
    return {
        "alias": KEY_ALIAS,
        "password": password,
        "keystore_b64": base64.b64encode(p12).decode(),
        "sha256": ":".join(fp[i:i + 2] for i in range(0, len(fp), 2)),
        "created_at": now.isoformat(),
        "valid_to": valid_to.isoformat(),
    }


def android_secrets(ks: dict, key: str) -> dict:
    return {
        f"ANDROID_KEYSTORE_BASE64_{key}": ks["keystore_b64"],
        f"ANDROID_KEYSTORE_PASSWORD_{key}": ks["password"],
        f"ANDROID_KEY_ALIAS_{key}": ks["alias"],
        f"ANDROID_KEY_PASSWORD_{key}": ks["password"],
    }


def keystore_backup_zip(ks: dict, business_name: str, key: str, bundle_id: str) -> bytes:
    import io
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("upload.keystore", base64.b64decode(ks["keystore_b64"]))
        z.writestr("CREDENTIALS.txt", (
            f"Android upload keystore - {business_name}\n"
            f"App ID / package : {bundle_id}\n"
            f"Store account key: {key}\n\n"
            f"Keystore file    : upload.keystore (PKCS12)\n"
            f"Keystore password: {ks['password']}\n"
            f"Key alias        : {ks['alias']}\n"
            f"Key password     : {ks['password']}\n"
            f"SHA-256          : {ks['sha256']}\n"
            f"Created          : {ks['created_at']}\n"
            f"Valid until      : {ks['valid_to']}\n\n"
            "KEEP THIS FILE SAFE. Every Play Store update of this app must be signed with this keystore.\n"
            "If it is lost, Google Play support must reset the upload key.\n"
        ))
    return buf.getvalue()


# ─── Apple App Store Connect ────────────────────────────────────────────────
TEAM_RE = re.compile(r"^[A-Z0-9]{10}$")
KID_RE = re.compile(r"^[A-Z0-9]{8,12}$")
ISS_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def clean_apple(team_id: str, key_id: str, issuer_id: str, p8: str) -> dict:
    team_id, key_id, issuer_id = (team_id or "").strip().upper(), (key_id or "").strip().upper(), (issuer_id or "").strip().lower()
    p8 = (p8 or "").strip()
    if not TEAM_RE.match(team_id):
        raise SigningError("Team ID should be 10 letters/digits (developer.apple.com -> Account -> Membership details)")
    if not KID_RE.match(key_id):
        raise SigningError("Key ID looks wrong (App Store Connect -> Users and Access -> Integrations -> App Store Connect API)")
    if not ISS_RE.match(issuer_id):
        raise SigningError("Issuer ID looks wrong - it is the long ID shown above the keys list")
    if "BEGIN PRIVATE KEY" not in p8:
        raise SigningError("Upload the .p8 file downloaded when the API key was created")
    try:
        serialization.load_pem_private_key(p8.encode(), password=None)
    except ValueError:
        raise SigningError("The .p8 file could not be read - download a new key from App Store Connect")
    return {"team_id": team_id, "key_id": key_id, "issuer_id": issuer_id, "p8": p8 + "\n"}


def verify_apple(acc: dict) -> None:
    """Calls App Store Connect with a short-lived ES256 token: proves Key ID + Issuer ID + .p8 belong together."""
    now = int(time.time())
    token = jwt.encode({"iss": acc["issuer_id"], "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"},
                       acc["p8"], algorithm="ES256", headers={"kid": acc["key_id"], "typ": "JWT"})
    try:
        r = requests.get(f"{ASC_API}/v1/apps?limit=1", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    except requests.RequestException as e:
        raise SigningError(f"Could not reach Apple ({type(e).__name__}). Try again.", 502)
    if r.status_code == 401:
        raise SigningError("Apple rejected this key: Key ID, Issuer ID and .p8 file do not match (or the key was revoked)")
    if r.status_code == 403:
        raise SigningError("Apple accepted the key but it has no access - create it with the 'App Manager' or 'Admin' role")
    if r.status_code >= 400:
        raise SigningError(f"Apple check failed (HTTP {r.status_code})", 502)


def apple_secrets(acc: dict, key: str) -> dict:
    return {
        f"APPLE_TEAM_ID_{key}": acc["team_id"],
        f"ASC_KEY_ID_{key}": acc["key_id"],
        f"ASC_ISSUER_ID_{key}": acc["issuer_id"],
        f"ASC_API_KEY_P8_BASE64_{key}": base64.b64encode(acc["p8"].encode()).decode(),
    }


APPLE_SECRET_NAMES = ("APPLE_TEAM_ID", "ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_API_KEY_P8_BASE64")


# ─── Google Play service account ────────────────────────────────────────────
def clean_play_json(raw: str) -> str:
    try:
        d = json.loads(raw)
    except ValueError:
        raise SigningError("Upload the JSON key file of the Play Console service account")
    if d.get("type") != "service_account" or not d.get("private_key") or not d.get("client_email"):
        raise SigningError("This is not a Google service-account key (Play Console -> Setup -> API access)")
    return json.dumps(d)


# ─── GitHub Actions secrets ─────────────────────────────────────────────────
class GitHub:
    def __init__(self, token: str, repo: str):
        if not token:
            raise SigningError("GITHUB_TOKEN is not configured in backend/.env", 400)
        self.repo = repo
        self.h = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        self._pk = None

    def _public_key(self):
        if self._pk:
            return self._pk
        r = requests.get(f"{GH_API}/repos/{self.repo}/actions/secrets/public-key", headers=self.h, timeout=15)
        if r.status_code in (401, 403, 404):
            raise SigningError("The GitHub token cannot manage repository secrets. Create a token with "
                               "'Secrets: Read and write' + 'Actions: Read and write' for this repo and put it in "
                               "backend/.env as GITHUB_TOKEN.", 400)
        r.raise_for_status()
        self._pk = r.json()
        return self._pk

    def check(self) -> dict:
        try:
            self._public_key()
            return {"ok": True}
        except SigningError as e:
            return {"ok": False, "error": str(e)}
        except requests.RequestException as e:
            return {"ok": False, "error": f"GitHub unreachable ({type(e).__name__})"}

    def put(self, name: str, value: str) -> None:
        from nacl import encoding, public
        pk = self._public_key()
        box = public.SealedBox(public.PublicKey(pk["key"].encode(), encoding.Base64Encoder()))
        enc = base64.b64encode(box.encrypt(value.encode())).decode()
        r = requests.put(f"{GH_API}/repos/{self.repo}/actions/secrets/{name}", headers=self.h,
                         json={"encrypted_value": enc, "key_id": pk["key_id"]}, timeout=15)
        if r.status_code not in (201, 204):
            raise SigningError(f"GitHub refused secret {name} (HTTP {r.status_code})", 502)

    def put_many(self, values: dict) -> None:
        for k, v in values.items():
            self.put(k, v)

    def delete(self, name: str) -> None:
        requests.delete(f"{GH_API}/repos/{self.repo}/actions/secrets/{name}", headers=self.h, timeout=15)

    def exists(self, name: str) -> bool:
        r = requests.get(f"{GH_API}/repos/{self.repo}/actions/secrets/{name}", headers=self.h, timeout=15)
        return r.status_code == 200
