async function openShopAdmin(jid) {
  try {
    const r = await api(`/master/jewellers/${jid}/impersonate-token`, { method: 'POST' });
    window.open(r.admin_url, '_blank');
    toast(`Opening ${r.business_name} Admin Panel...`);
  } catch (e) {
    toast(e.message, true);
  }
}

/* Master console: App Studio — white-label app per jeweller */
S.studio = null; S.studioSel = ''; S.draft = null; S.buildState = {}; S.buildTimer = null;
const loadStudio = () => safe(async () => {
  S.studio = await api('/master/app-studio');
  if (!S.studio.apps.some((a) => a.id === S.studioSel)) S.studioSel = S.studio.apps[0]?.id || '';
  pickDraft();
  if (S.studioSel) checkBuildStatus(S.studioSel);
}, 'studio');

function pickDraft() {
  const a = (S.studio?.apps || []).find((x) => x.id === S.studioSel);
  S.draft = a ? {
    app_name: a.app_name || `${a.business_name.split(' ')[0]} Gold`,
    bundle_id: a.bundle_id || a.suggested_bundle_id,
    theme_preset: a.theme_preset || 'royal_gold',
    logo_url: a.logo_url,
    splash_url: a.splash_url,
    app_version: a.app_version,
    support_email: a.support_email || a.email,
    domain: a.domain || '',
    admin_domain: a.admin_domain || '',
    store_short: a.store_short || a.config.store.shortDescription,
    store_long: a.store_long || a.config.store.longDescription,
    store_keywords: a.store_keywords || a.config.store.keywords
  } : null;
}

function studioSelect(id) { S.studioSel = id; pickDraft(); render(); checkBuildStatus(id); }
function dset(k, v, rerender) { S.draft[k] = v; if (rerender) render(); else { const pv = $('#studio-preview'); if (pv) pv.innerHTML = phone(); } }

async function checkBuildStatus(id) {
  if (!id) return;
  try {
    const st = await api(`/master/app-studio/${id}/build-status`);
    S.buildState[id] = st;
    const box = $('#studio-build-box');
    if (box && S.studioSel === id) box.innerHTML = renderBuildCenter(id);
    if (S.buildTimer) { clearTimeout(S.buildTimer); S.buildTimer = null; }
    if (st && (st.status === 'queued' || st.status === 'in_progress')) {
      S.buildTimer = setTimeout(() => checkBuildStatus(id), 5000);
    }
  } catch (_) {}
}

function renderBuildCenter(id) {
  const st = S.buildState[id] || { status: 'idle', jobs: [], downloads: {} };
  const dl = st.downloads || {};
  const isRunning = st.status === 'queued' || st.status === 'in_progress';
  const statusBadgeHtml = isRunning
    ? `<span class="badge gold">⏳ Building in Cloud (${st.status.replace('_', ' ')})… Auto-refreshing every 5s</span>`
    : st.conclusion === 'success' || dl.apk || dl.ipa
    ? `<span class="badge green">✓ Build Ready for Direct Download</span>`
    : st.conclusion === 'failure'
    ? `<span class="badge red">⚠ Last build stopped — select an option below to rebuild</span>`
    : st.conclusion === 'cancelled'
    ? `<span class="badge amber">⏹ Build was cancelled</span>`
    : `<span class="badge">Ready to Build</span>`;

  const jobsHtml = (st.jobs && st.jobs.length)
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">${st.jobs.map((j) => {
        const icon = j.conclusion === 'success' ? '✅' : j.conclusion === 'failure' ? '❌' : j.status === 'in_progress' ? '⏳' : '🕒';
        return `<div style="flex:1;min-width:180px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:12px"><b>${icon} ${esc(j.name)}</b><div class="sub">${esc(j.conclusion || j.status || 'queued')}</div></div>`;
      }).join('')}</div>`
    : '';

  return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div><b style="font-size:14px">📲 Multi-Tenant App Builder & Direct Downloads (Android & iOS)</b>
        <div class="sub">Compiles real Android (.APK / .AAB) and iOS (.IPA) binaries in GitHub Actions cloud runners</div></div>
      ${statusBadgeHtml}
    </div>
    ${jobsHtml}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn gold" onclick="studioBuild('${id}','android_apk')" id="studio-build-apk" ${isRunning ? 'disabled' : ''}>
        ⚡ Fast Build Android .APK (~4 min)
      </button>
      <button class="btn" onclick="studioBuild('${id}','android_bundle')" id="studio-build-aab" ${isRunning ? 'disabled' : ''}>
        📦 Build Play Store .AAB
      </button>
      <button class="btn" onclick="studioBuild('${id}','ios')" id="studio-build-ios" ${isRunning ? 'disabled' : ''}>
        🍎 Build iOS .IPA
      </button>
      <button class="btn" onclick="studioBuild('${id}','all')" id="studio-build-all" ${isRunning ? 'disabled' : ''}>
        🚀 Build All (APK + AAB + iOS)
      </button>
      ${isRunning ? `<button class="btn red" onclick="studioCancelBuild('${id}')" id="studio-cancel">⏹ Cancel Stuck Build</button>` : ''}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn ${dl.apk ? 'primary' : ''}" onclick="studioDownload('${id}','apk')" ${dl.apk ? '' : 'disabled title="Run Fast Build Android .APK first"'}>
        📲 Download Android .APK ${dl.apk ? '✓' : '(Build first)'}
      </button>
      <button class="btn ${dl.aab ? 'primary' : ''}" onclick="studioDownload('${id}','aab')" ${dl.aab ? '' : 'disabled title="Run Build Play Store .AAB first"'}>
        📦 Download Play Store .AAB ${dl.aab ? '✓' : '(Build first)'}
      </button>
      <button class="btn ${dl.ipa ? 'primary' : ''}" onclick="studioDownload('${id}','ipa')" ${dl.ipa ? '' : 'disabled title="Run Build iOS .IPA first"'}>
        🍎 Download iOS .IPA ${dl.ipa ? '✓' : '(Build first)'}
      </button>
      <button class="btn" onclick="studioDownload('${id}','kit')">
        🖼 Download Store Graphics (.ZIP)
      </button>
      <button class="btn" onclick="checkBuildStatus('${id}')" title="Refresh build status">↻ Refresh Status</button>
    </div>`;
}

const SECTION_LABEL = { prices: 'Live prices', karats: '24K · 22K · 18K', sip: 'Auto SIP', banners: 'Offers', buy: 'Buy gold', categories: 'Categories', trending: 'Trending', promos: 'Gift & refer' };
function phone(small) {
  const d = S.draft; const P = S.studio.presets[d.theme_preset]; const cur = S.studio.apps.find((x) => x.id === S.studioSel) || {}; const k = cur.karats || S.studio.karats || {}; const nodata = S.studio.price?.has_live === false;
  const r = P.cardRadius; const name = esc(d.app_name || 'Your app');
  const val = (v) => nodata || !v ? '—' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const logo = d.logo_url ? `<img src="${esc(d.logo_url)}" style="width:100%;height:100%;object-fit:contain">` : esc(initials(d.app_name || 'G'));
  const block = (s) => ({
    prices: `<div style="display:flex;gap:6px"><div style="flex:1;background:${P.accentColor};border-radius:${r * .6}px;padding:8px"><div style="font-size:7px;color:${P.primaryColor};letter-spacing:.5px">LIVE RATE</div><div style="font-size:10px;color:${P.primaryColor};font-weight:700">Gold 24K</div><div style="font-size:11px;color:#fff;font-weight:700">${val(k['24K'])}</div></div><div style="flex:1;background:${P.accentColor};border-radius:${r * .6}px;padding:8px"><div style="font-size:7px;color:#cbd5e1">LIVE RATE</div><div style="font-size:10px;color:#e5e7eb;font-weight:700">Silver</div><div style="font-size:11px;color:#fff;font-weight:700">${val(cur.silver_buy || S.studio.price?.silver?.buy)}</div></div></div>`,
    karats: `<div style="background:#fff;border:1px solid ${P.primaryColor}55;border-radius:${r * .6}px;padding:7px 9px;font-size:9px">${['24K', '22K', '18K'].map((x) => `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:${P.secondaryColor}">${x}</span><b style="color:${P.accentColor}">${val(k[x])}</b></div>`).join('')}</div>`,
    sip: `<div style="background:${P.accentColor};border-radius:${r * .6}px;padding:8px;color:#fff;font-size:9px"><span style="color:${P.primaryColor};font-size:7px;letter-spacing:.6px">AUTO SIP</span><br><b>Save daily from ₹100</b></div>`,
    banners: `<div style="height:44px;border-radius:${r * .6}px;background:linear-gradient(120deg,${P.secondaryColor},${P.primaryColor});color:#fff;font-size:9px;padding:8px"><b>Festive offer</b><br>0% making on coins</div>`,
    buy: `<div style="background:#fff;border-radius:${r * .6}px;padding:8px;border:1px solid ${P.primaryColor}33"><div style="font-size:8px;color:#6b7280">Buy gold</div><div style="font-size:12px;font-weight:700;color:${P.accentColor}">₹ 1,000</div><div style="margin-top:5px;background:${P.primaryColor};color:#fff;border-radius:${r * .5}px;text-align:center;font-size:9px;padding:5px;font-weight:700">Proceed to Buy →</div></div>`,
    categories: `<div style="display:flex;gap:5px">${['Rings', 'Bangles', 'Chains', 'Kadas'].map((c) => `<div style="flex:1;text-align:center"><div style="height:26px;border-radius:${r * .5}px;background:${P.backgroundColor};border:1px solid ${P.primaryColor}55"></div><div style="font-size:7px;margin-top:2px;color:${P.accentColor}">${c}</div></div>`).join('')}</div>`,
    trending: `<div style="display:flex;gap:5px">${[1, 2].map(() => `<div style="flex:1;height:46px;border-radius:${r * .6}px;background:#fff;border:1px solid ${P.primaryColor}33"></div>`).join('')}</div>`,
    promos: `<div style="background:#fff;border-radius:${r * .6}px;padding:7px;font-size:9px;color:${P.accentColor};border:1px solid ${P.primaryColor}33">Refer & Earn · FAQs</div>`,
  }[s] || '');
  const sections = small ? P.homeLayout.slice(0, 4) : P.homeLayout;
  return `<div class="phone ${small ? 'sm' : ''}" style="background:${P.backgroundColor}">
    <div style="display:flex;align-items:center;gap:6px;padding:10px 10px 8px;background:#fff;border-bottom:1px solid ${P.primaryColor}55">
      <div style="width:22px;height:22px;border-radius:${Math.max(4, r * .35)}px;background:linear-gradient(135deg,${P.primaryColor},${P.secondaryColor});color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;overflow:hidden">${logo}</div>
      <b style="font-size:11px;color:${P.accentColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</b></div>
    <div style="display:flex;flex-direction:column;gap:7px;padding:9px">${sections.map(block).join('')}</div></div>`;
}

function stepper(a) {
  const st = S.studio.statuses; const cur = st.findIndex((s) => s.key === a.app_status);
  return `<div class="stepper">${st.map((s, i) => `<div class="step ${i < cur ? 'done' : i === cur ? 'on' : ''}"><span>${i < cur ? '✓' : i + 1}</span><b>${s.label}</b></div>`).join('')}</div>`;
}

function vStudio() {
  const head = ph('App Studio', 'Brand each shop\'s Android & iOS app, compile real .APK / .AAB / .IPA binaries in 1 click, and download them directly.');
  const s = S.studio; if (!s) return head + loading;
  if (!s.apps.length) return head + '<div class="card"><div class="empty"><b>No shops yet</b></div></div>';
  const a = s.apps.find((x) => x.id === S.studioSel); const d = S.draft;
  const label = Object.fromEntries(s.statuses.map((x) => [x.key, x.label]));
  const list = `<div class="card studio-list">${s.apps.map((x) => `<button class="studio-item ${x.id === S.studioSel ? 'on' : ''}" onclick="studioSelect('${x.id}')" data-testid="studio-shop-${x.id}">
      <div><b>${esc(x.app_name || x.business_name)}</b><div class="sub">${esc(x.business_name)}${x.city ? ' · ' + esc(x.city) : ''}</div></div>
      <span class="badge ${x.app_status === 'live' ? 'green' : x.app_status === 'details_pending' ? 'amber' : 'gold'}">${label[x.app_status]}</span></button>`).join('')}</div>`;
  const nextStatus = { config_ready: 'built', built: 'submitted', submitted: 'live' }[a.app_status];
  const themes = Object.entries(s.presets).map(([key, P]) => `<button class="theme-opt ${d.theme_preset === key ? 'on' : ''}" onclick="dset('theme_preset','${key}',true)" data-testid="theme-${key}">
      <div class="sw">${[P.primaryColor, P.secondaryColor, P.accentColor, P.backgroundColor].map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${P.label}</b><span>Radius ${P.cardRadius} · ${P.homeLayout.slice(0, 3).map((x) => SECTION_LABEL[x]).join(' → ')}</span></button>`).join('');

  const serverIp = window.location.hostname || '13.233.54.98';
  const appHostPart = (d.domain || '').split('.')[0] || 'gold';
  const adminHostPart = (d.admin_domain || '').split('.')[0] || 'admin';

  return head + `<div class="studio">
    ${list}
    <div class="studio-main">
      <div class="card pad">${stepper(a)}
        <div class="studio-actions">
          <button class="btn primary" onclick="studioSave()" id="studio-save">💾 Save Branding Details</button>
          ${nextStatus ? `<button class="btn" onclick="studioStatus('${a.id}','${nextStatus}')" id="studio-next">Mark as ${label[nextStatus]}</button>` : ''}
          ${a.app_status !== 'details_pending' ? `<select class="select" style="width:auto" onchange="studioStatus('${a.id}',this.value)">${s.statuses.map((x) => `<option value="${x.key}" ${x.key === a.app_status ? 'selected' : ''}>${x.label}</option>`).join('')}</select>` : ''}
        </div>
        <div id="studio-build-box" style="margin-top:14px;padding-top:14px;border-top:1px solid #e5e7eb">
          ${renderBuildCenter(a.id)}
        </div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-top:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="margin:0 0 3px 0;color:#166534;font-size:13.5px">🏪 ${esc(a.business_name)} — Shop Admin Portal</h4>
            <div style="font-size:12px;color:#15803d">
              Login Email: <b>${esc(a.email)}</b> &bull; Default Password: <code>jeweller123</code><br>
              Direct Link: <a href="/api/admin/jeweller" target="_blank" style="color:#15803d;font-weight:700">${window.location.origin}/api/admin/jeweller</a>
            </div>
          </div>
          <button class="btn primary" onclick="openShopAdmin('${a.id}')" style="background:#16a34a">
            🚀 1-Click Login as Shop Admin ↗
          </button>
        </div>
      </div>
      <div class="studio-grid">
        <div>
          <div class="card pad"><h3 class="card-t">App identity</h3>
            <div class="field"><label>App name (shown under the icon)</label><input class="input" id="st_name" maxlength="30" value="${esc(d.app_name)}" oninput="dset('app_name',this.value)"></div>
            <div class="field"><label>App ID / package name</label><input class="input" id="st_bundle" value="${esc(d.bundle_id)}" oninput="dset('bundle_id',this.value.toLowerCase())"><div class="hint">Auto-made from the shop name · used for both Play Store and App Store · cannot change after publishing</div></div>
            <div class="grid g2"><div class="field"><label>Logo (square PNG, 1024px best)</label><input type="file" accept="image/png,image/jpeg,image/webp" onchange="studioUpload(this,'logo_url')" id="st_logo"></div>
              <div class="field"><label>Splash image (optional)</label><input type="file" accept="image/png,image/jpeg" onchange="studioUpload(this,'splash_url')" id="st_splash"></div></div>
            <div class="grid g2"><div class="field"><label>Version</label><input class="input" value="${esc(d.app_version)}" oninput="dset('app_version',this.value)"></div>
              <div class="field"><label>Support email</label><input class="input" value="${esc(d.support_email)}" oninput="dset('support_email',this.value)"></div></div>
          </div>

          <div class="card pad section"><h3 class="card-t">🌐 Custom Domain & DNS Settings</h3>
            <div class="sub" style="margin-bottom:12px">Connect the jeweller's custom domain for customer web access and jeweller admin portal.</div>
            <div class="grid g2">
              <div class="field">
                <label>Customer App Domain (Web / PWA)</label>
                <input class="input" id="st_domain" placeholder="e.g. gold.sharmajewellers.in" value="${esc(d.domain || '')}" oninput="dset('domain',this.value)">
                <div class="hint">Live rates, digital gold buying, SIP & catalog portal</div>
              </div>
              <div class="field">
                <label>Jeweller Admin Portal Domain</label>
                <input class="input" id="st_admin_domain" placeholder="e.g. admin.sharmajewellers.in" value="${esc(d.admin_domain || '')}" oninput="dset('admin_domain',this.value)">
                <div class="hint">Jeweller's private billing, customer KYC & rate margins portal</div>
              </div>
            </div>

            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:12px 0;font-size:12px">
              <div style="font-weight:700;color:#0f172a;margin-bottom:6px">📌 Required DNS Records at Domain Registrar (GoDaddy, Cloudflare, Namecheap):</div>
              <table style="width:100%;font-size:12px;border-collapse:collapse">
                <thead>
                  <tr style="text-align:left;color:#64748b;border-bottom:1px solid #cbd5e1">
                    <th style="padding:4px 6px">Type</th>
                    <th style="padding:4px 6px">Host / Subdomain</th>
                    <th style="padding:4px 6px">Points To (Target IP)</th>
                    <th style="padding:4px 6px">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #e2e8f0">
                    <td style="padding:6px;font-weight:700">A</td>
                    <td style="padding:6px"><code>${esc(appHostPart)}</code></td>
                    <td style="padding:6px"><code>${serverIp}</code></td>
                    <td style="padding:6px">Automatic / 3600</td>
                  </tr>
                  <tr>
                    <td style="padding:6px;font-weight:700">A</td>
                    <td style="padding:6px"><code>${esc(adminHostPart)}</code></td>
                    <td style="padding:6px"><code>${serverIp}</code></td>
                    <td style="padding:6px">Automatic / 3600</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <button class="btn primary" onclick="checkDomainDNS('${a.id}')" id="btn-check-dns">🔍 Live Verify DNS Records</button>
              <div id="dns-verify-result" style="font-size:12px"></div>
            </div>
          </div>

          <div class="card pad section"><h3 class="card-t">Theme</h3><div class="themes">${themes}</div></div>
          <div class="card pad section"><h3 class="card-t">Store listing <span class="sub">auto-written · edit if you like</span></h3>
            <div class="field"><label>Short description (80)</label><input class="input" maxlength="80" value="${esc(d.store_short)}" oninput="dset('store_short',this.value)"></div>
            <div class="field"><label>Full description</label><textarea class="input" rows="7" oninput="dset('store_long',this.value)">${esc(d.store_long)}</textarea></div>
            <div class="field"><label>Keywords (100)</label><input class="input" maxlength="100" value="${esc(d.store_keywords)}" oninput="dset('store_keywords',this.value)"></div>
            <div class="kv"><span>Privacy policy</span><a href="${esc(a.config.store.privacyPolicyUrl)}" target="_blank">${esc(a.config.store.privacyPolicyUrl)}</a></div>
            <div class="kv"><span>Terms</span><a href="${esc(a.config.store.termsUrl)}" target="_blank">${esc(a.config.store.termsUrl)}</a></div>
          </div>
        </div>
        <div class="studio-preview-col"><div class="sub" style="margin-bottom:8px">Live preview · ${esc(s.presets[d.theme_preset].label)}</div><div id="studio-preview">${phone()}</div>
          <div class="sub" style="margin-top:10px">Tenant ID <code>${esc(a.id)}</code></div></div>
      </div></div></div>`;
}

async function checkDomainDNS(id) {
  const resBox = $('#dns-verify-result');
  if (resBox) resBox.innerHTML = '<span class="badge">Checking DNS propagation…</span>';
  try {
    const saved = await api('/master/app-studio/' + id, { method: 'PUT', body: S.draft });
    S.studio.apps = S.studio.apps.map((x) => x.id === saved.id ? saved : x);
    const r = await api(`/master/jewellers/${id}/domain-check`);
    if (!resBox) return;
    const doms = r.domains || [];
    if (!doms.length) {
      resBox.innerHTML = '<span class="badge amber">No custom domain entered yet. Add App Domain or Admin Domain above.</span>';
      return;
    }
    const htmls = doms.map((d) => {
      const label = d.kind === 'app' ? 'App Domain' : 'Admin Domain';
      if (d.points_here) {
        return `<span class="badge green">✓ ${label} (${esc(d.domain)}) points to server IP (${(d.resolves_to||[]).join(', ')})</span>`;
      } else {
        const ips = (d.resolves_to && d.resolves_to.length) ? d.resolves_to.join(', ') : 'No IP found';
        return `<span class="badge red">✗ ${label} (${esc(d.domain)}) currently resolves to [${ips}], needs to point to ${esc((r.target_ips||[window.location.hostname||'13.233.54.98']).join(', '))}</span>`;
      }
    });
    resBox.innerHTML = htmls.join(' ');
  } catch (e) {
    if (resBox) resBox.innerHTML = `<span class="badge red">DNS verification error: ${esc(e.message)}</span>`;
  }
}

async function studioUpload(inp, key) {
  const f = inp.files[0]; if (!f) return;
  try { const url = await uploadImage(f, 'master_token', '/master/v3/upload'); S.draft[key] = url; toast(key === 'logo_url' ? 'Logo uploaded · save to keep it' : 'Splash uploaded · save to keep it'); render(); } catch (e) { toast(e.message, true); }
}

async function studioSave() {
  const b = $('#studio-save'); if (b) b.disabled = true;
  try {
    const r = await api('/master/app-studio/' + S.studioSel, { method: 'PUT', body: S.draft });
    S.studio.apps = S.studio.apps.map((x) => x.id === r.id ? r : x);
    pickDraft();
    toast('App details & custom domains saved');
    render();
  } catch (e) { toast(e.message, true); if (b) b.disabled = false; }
}

async function studioStatus(id, status) {
  try { const r = await api(`/master/app-studio/${id}/status`, { method: 'PUT', body: { status } }); S.studio.apps = S.studio.apps.map((x) => x.id === r.id ? r : x); toast('Status updated'); render(); } catch (e) { toast(e.message, true); render(); }
}

async function studioBuild(id, platform) {
  try {
    const saved = await api('/master/app-studio/' + id, { method: 'PUT', body: S.draft });
    S.studio.apps = S.studio.apps.map((x) => x.id === saved.id ? saved : x);
    const res = await api(`/master/app-studio/${id}/build`, { method: 'POST', body: { platform: platform || 'android_apk' } });
    if (res.row) S.studio.apps = S.studio.apps.map((x) => x.id === res.row.id ? res.row : x);
    toast(res.message || 'Cloud build started! Progress will update automatically.');
    await checkBuildStatus(id);
    render();
  } catch (e) { toast(e.message, true); }
}

async function studioCancelBuild(id) {
  if (!confirm('Cancel the currently running cloud build?')) return;
  try {
    await api(`/master/app-studio/${id}/cancel`, { method: 'POST' });
    toast('Build cancelled.');
    await checkBuildStatus(id);
  } catch (e) { toast(e.message, true); }
}

async function studioDownload(id, kind) {
  try {
    if (kind === 'kit') {
      const saved = await api('/master/app-studio/' + id, { method: 'PUT', body: S.draft });
      S.studio.apps = S.studio.apps.map((x) => x.id === saved.id ? saved : x);
    }
    toast(`Preparing ${kind.toUpperCase()} download…`);
    const tok = localStorage.getItem('master_token') || '';
    const r = await fetch(API + `/master/app-studio/${id}/download/${kind}`, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Download failed'); }
    const blob = await r.blob(); const cd = r.headers.get('Content-Disposition') || ''; const fn = (cd.match(/filename="([^"]+)"/) || [])[1] || `app.${kind}`;
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    toast(`Downloaded ${fn}`);
  } catch (e) { toast(e.message, true); }
}

/* Master console: Security & Controls — live-rate visibility, booking switch, minimum investment */
S.ctl = null;
const loadCtl = () => safe(async () => { S.ctl = await api('/master/v3/controls'); }, 'security');
const sw = (id, on, onchange) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} onchange="${onchange}"><span></span></label>`;
function vSecurity() {
  const head = ph('Security & Controls', 'Turn live rates and booking on or off for all shops, or only for one shop\'s customers.');
  const c = S.ctl; if (!c) return head + loading;
  const g = c.global;
  return head + `<div class="card pad"><h3 class="card-t">All shops <span class="sub">applies to every shop owner and all their customers</span></h3>
    <div class="ctl-row"><div><b>Show live rates</b><div class="sub">Off hides every price in all customer apps</div></div>${sw('g_rates', g.rates, 'ctlSet()')}</div>
    <div class="ctl-row"><div><b>Allow booking</b><div class="sub">Off stops all new buys and SIP payments on every shop</div></div>${sw('g_booking', g.booking, 'ctlSet()')}</div>
    <div class="ctl-row"><div><b>Minimum investment (gold & silver)</b><div class="sub">Smallest buy or SIP amount a customer can place</div></div><div class="prefix" style="width:140px"><span>₹</span><input class="input num" id="g_min" type="number" min="10" step="50" value="${g.min_investment}"></div></div>
    <div style="margin-top:12px"><button class="btn primary" onclick="ctlSave()" id="ctl-save">Save controls</button></div></div>
    <div class="card section"><div class="card-h"><h3>Per shop <span class="sub" style="font-weight:400">only that shop's customers are affected</span></h3></div><div class="table-wrap"><table><thead><tr><th>Shop</th><th>Live rates</th><th>Booking</th><th>Customers see</th></tr></thead><tbody>
    ${c.shops.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="sub">${statusBadge(s.status)}</div></td><td>${sw('r_' + s.id, s.rates, 'ctlSet()')}</td><td>${sw('b_' + s.id, s.booking, 'ctlSet()')}</td>
      <td>${s.effective.rates ? '<span class="badge green">Rates on</span>' : '<span class="badge red">Rates hidden</span>'} ${s.effective.booking && s.effective.rates ? '<span class="badge green">Booking on</span>' : '<span class="badge red">Booking off</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function ctlSet() { const b = $('#ctl-save'); if (b) b.textContent = 'Save controls · unsaved changes'; }
async function ctlSave() {
  const shops = {}; S.ctl.shops.forEach((s) => { shops[s.id] = { rates: $('#r_' + s.id).checked, booking: $('#b_' + s.id).checked }; });
  try { await api('/master/v3/controls', { method: 'PUT', body: { rates: $('#g_rates').checked, booking: $('#g_booking').checked, min_investment: Number($('#g_min').value || 500), shops } }); toast('Controls saved'); loadCtl(); } catch (e) { toast(e.message, true); }
}
