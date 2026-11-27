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
  const p = a ? (S.studio?.presets?.[a.theme_preset || 'royal_gold'] || {}) : {};
  S.draft = a ? {
    app_name: a.app_name || `${a.business_name.split(' ')[0]} Gold`,
    bundle_id: a.bundle_id || a.suggested_bundle_id,
    theme_preset: a.theme_preset || 'royal_gold',
    primary_color: a.primary_color || p.primaryColor || '#D4AF37',
    secondary_color: a.secondary_color || p.secondaryColor || '#C5A028',
    accent_color: a.accent_color || p.accentColor || '#111827',
    background_color: a.background_color || p.backgroundColor || '#FDF8E8',
    text_color: a.text_color || '#111827',
    store_lat: a.store_lat ?? null,
    store_lng: a.store_lng ?? null,
    store_hours: a.store_hours || '',
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
    : st.conclusion === 'success'
    ? `<span class="badge green">✓ Build Ready for Direct Download</span>`
    : st.conclusion === 'failure'
    ? `<span class="badge red">⚠ Last build stopped — select an option below to rebuild</span>`
    : st.conclusion === 'cancelled'
    ? `<span class="badge amber">⏹ Build was cancelled</span>`
    : (dl.apk || dl.ipa)
    ? `<span class="badge green">✓ Build Ready for Direct Download</span>`
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
S.phonePreviewTab = S.phonePreviewTab || 'home';
function setPhoneTab(tab) {
  S.phonePreviewTab = tab;
  const pv = $('#studio-preview');
  if (pv) pv.innerHTML = phone();
  document.querySelectorAll('.pv-tab-btn').forEach(b => {
    b.className = (b.dataset.tab === tab ? 'btn primary' : 'btn ghost') + ' pv-tab-btn';
  });
}

function phone(small) {
  const d = S.draft;
  const P = Object.assign({}, S.studio.presets[d.theme_preset]);
  if (d.primary_color) P.primaryColor = d.primary_color;
  if (d.secondary_color) P.secondaryColor = d.secondary_color;
  if (d.accent_color) P.accentColor = d.accent_color;
  if (d.background_color) P.backgroundColor = d.background_color;
  P.textColor = d.text_color || '#111827';
  const cur = S.studio.apps.find((x) => x.id === S.studioSel) || {}; const k = cur.karats || S.studio.karats || {}; const nodata = S.studio.price?.has_live === false;
  const r = P.cardRadius; const name = esc(d.app_name || 'Your app');
  const val = (v) => nodata || !v ? '—' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const logo = d.logo_url ? `<img src="${esc(d.logo_url)}" style="width:100%;height:100%;object-fit:cover">` : esc(initials(d.app_name || 'G'));

  if (!small && S.phonePreviewTab === 'icon') {
    const iconContent = d.logo_url
      ? `<img src="${esc(d.logo_url)}" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${P.primaryColor},${P.secondaryColor});color:#fff;font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center">${esc(initials(d.app_name || 'G'))}</div>`;

    return `<div class="phone" style="background:linear-gradient(180deg,#4a779d 0%,#28527a 100%);display:flex;flex-direction:column;justify-content:space-between;padding:16px 12px;position:relative;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.3)">
      <div style="display:flex;justify-content:space-between;color:rgba(255,255,255,0.9);font-size:9.5px;font-weight:600;padding:0 4px">
        <span>16:50</span>
        <span>5G · 97%</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px 6px;margin-top:20px;text-align:center">
        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:44px;height:44px;border-radius:13px;background:#F8CB46;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.2)">
            <span style="font-size:9.5px;font-weight:900;color:#0C831F">blinkit</span>
          </div>
          <span style="font-size:9px;color:#fff;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,0.6)">Blinkit</span>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:44px;height:44px;border-radius:13px;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.2)">
            <span style="font-size:16px;color:#fff">💬</span>
          </div>
          <span style="font-size:9px;color:#fff;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,0.6)">WhatsApp</span>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:44px;height:44px;border-radius:13px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.2)">
            <span style="font-size:16px">📁</span>
          </div>
          <span style="font-size:9px;color:#fff;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,0.6)">Files</span>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:44px;height:44px;border-radius:13px;background:#C8A04A;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.2);color:#064E3B;font-weight:800;font-size:13px">
            NG
          </div>
          <span style="font-size:9px;color:#fff;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,0.6)">Nick Gold</span>
        </div>

        <!-- CURRENT JEWELLER APP ICON -->
        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:44px;height:44px;border-radius:13px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.35);border:1.5px solid rgba(255,255,255,0.6)">
            ${iconContent}
          </div>
          <span style="font-size:9px;color:#fff;font-weight:700;margin-top:4px;text-shadow:0 1px 3px rgba(0,0,0,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48px">${name}</span>
        </div>
      </div>

      <div style="margin-top:auto">
        <div style="background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:20px;padding:6px 12px;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,0.15)">
          <span style="color:#64748b;font-size:10px">🔍 Search apps</span>
        </div>
        <div style="display:flex;justify-content:space-around;color:rgba(255,255,255,0.7);font-size:11px;margin-top:10px">
          <span>|||</span><span>○</span><span>&lt;</span>
        </div>
      </div>
    </div>`;
  }

  if (!small && S.phonePreviewTab === 'splash') {
    if (d.splash_url) {
      return `<div class="phone" style="padding:0;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 36px rgba(0,0,0,0.3)">
        <img src="${esc(d.splash_url)}" style="width:100%;height:100%;object-fit:cover;display:block">
      </div>`;
    }
    return `<div class="phone" style="background:${P.accentColor};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;box-shadow:0 12px 36px rgba(0,0,0,0.3);position:relative">
      <div style="width:68px;height:68px;border-radius:16px;background:linear-gradient(135deg,${P.primaryColor},${P.secondaryColor});display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,0.25);margin-bottom:14px;overflow:hidden">
        ${logo}
      </div>
      <div style="font-size:17px;font-weight:800;color:#fff;letter-spacing:0.5px">${name}</div>
      <div style="font-size:10px;font-weight:600;color:${P.primaryColor};margin-top:5px;letter-spacing:1px">24K DIGITAL GOLD</div>
      <div style="position:absolute;bottom:16px;font-size:8px;color:rgba(255,255,255,0.4);letter-spacing:0.5px">POWERED BY VAULTRA GOLD</div>
    </div>`;
  }
  const block = (s) => ({
    prices: `<div style="display:flex;gap:6px"><div style="flex:1;background:${P.accentColor};border-radius:${r * .6}px;padding:8px"><div style="font-size:7px;color:${P.primaryColor};letter-spacing:.5px">LIVE RATE</div><div style="font-size:10px;color:${P.primaryColor};font-weight:700">Gold 24K</div><div style="font-size:11px;color:#fff;font-weight:700">${val(k['24K'])}</div></div><div style="flex:1;background:${P.accentColor};border-radius:${r * .6}px;padding:8px"><div style="font-size:7px;color:#cbd5e1">LIVE RATE</div><div style="font-size:10px;color:#e5e7eb;font-weight:700">Silver</div><div style="font-size:11px;color:#fff;font-weight:700">${val(cur.silver_buy || S.studio.price?.silver?.buy)}</div></div></div>`,
    karats: `<div style="background:#fff;border:1px solid ${P.primaryColor}55;border-radius:${r * .6}px;padding:7px 9px;font-size:9px">${['24K', '22K', '18K'].map((x) => `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:${P.secondaryColor}">${x}</span><b style="color:${P.accentColor}">${val(k[x])}</b></div>`).join('')}</div>`,
    sip: `<div style="background:${P.accentColor};border-radius:${r * .6}px;padding:8px;color:#fff;font-size:9px"><span style="color:${P.primaryColor};font-size:7px;letter-spacing:.6px">AUTO SIP</span><br><b>Save daily from ₹100</b></div>`,
    banners: `<div style="height:44px;border-radius:${r * .6}px;background:linear-gradient(120deg,${P.secondaryColor},${P.primaryColor});color:#fff;font-size:9px;padding:8px"><b>Festive offer</b><br>0% making on coins</div>`,
    buy: `<div style="background:#fff;border-radius:${r * .6}px;padding:8px;border:1px solid ${P.primaryColor}33"><div style="font-size:8px;color:#6b7280">Buy gold</div><div style="font-size:12px;font-weight:700;color:${P.textColor}">₹ 1,000</div><div style="margin-top:5px;background:${P.primaryColor};color:#fff;border-radius:${r * .5}px;text-align:center;font-size:9px;padding:5px;font-weight:700">Proceed to Buy →</div></div>`,
    categories: `<div style="display:flex;gap:5px">${['Rings', 'Bangles', 'Chains', 'Kadas'].map((c) => `<div style="flex:1;text-align:center"><div style="height:26px;border-radius:${r * .5}px;background:${P.backgroundColor};border:1px solid ${P.primaryColor}55"></div><div style="font-size:7px;margin-top:2px;color:${P.textColor}">${c}</div></div>`).join('')}</div>`,
    trending: `<div style="display:flex;gap:5px">${[1, 2].map(() => `<div style="flex:1;height:46px;border-radius:${r * .6}px;background:#fff;border:1px solid ${P.primaryColor}33"></div>`).join('')}</div>`,
    promos: `<div style="background:#fff;border-radius:${r * .6}px;padding:7px;font-size:9px;color:${P.textColor};border:1px solid ${P.primaryColor}33">Refer & Earn · FAQs</div>`,
  }[s] || '');
  const sections = small ? P.homeLayout.slice(0, 4) : P.homeLayout;
  return `<div class="phone ${small ? 'sm' : ''}" style="background:${P.backgroundColor}">
    <div style="display:flex;align-items:center;gap:6px;padding:10px 10px 8px;background:#fff;border-bottom:1px solid ${P.primaryColor}55">
      <div style="width:22px;height:22px;border-radius:${Math.max(4, r * .35)}px;background:linear-gradient(135deg,${P.primaryColor},${P.secondaryColor});color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;overflow:hidden">${logo}</div>
      <b style="font-size:11px;color:${P.textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</b></div>
    <div style="display:flex;flex-direction:column;gap:7px;padding:9px">${sections.map(block).join('')}</div></div>`;
}

function stepper(a) {
  const st = S.studio.statuses; const cur = st.findIndex((s) => s.key === a.app_status);
  return `<div class="stepper">${st.map((s, i) => `<div class="step ${i < cur ? 'done' : i === cur ? 'on' : ''}"><span>${i < cur ? '✓' : i + 1}</span><b>${s.label}</b></div>`).join('')}</div>`;
}

S.studioStep = S.studioStep || 1;
function setStudioStep(step) {
  S.studioStep = step;
  render();
}
async function studioSaveAndNext(nextStep) {
  const b = document.getElementById('studio-save'); if (b) b.disabled = true;
  try {
    const r = await api('/master/app-studio/' + S.studioSel, { method: 'PUT', body: S.draft });
    S.studio.apps = S.studio.apps.map((x) => x.id === r.id ? r : x);
    pickDraft();
    toast('Step details saved successfully!');
    if (nextStep) S.studioStep = nextStep;
    render();
  } catch (e) {
    toast(e.message, true);
    if (b) b.disabled = false;
  }
}

function vStudio() {
  const head = ph('App Studio — Multi-Tenant App Builder', 'Guided 5-step wizard to brand, configure, domain-link and compile native Android (.APK / .AAB) and iOS apps per jeweller.');
  const s = S.studio; if (!s) return head + loading;
  if (!s.apps.length) return head + '<div class="card"><div class="empty"><b>No shops yet. Go to Shops -> Onboard Shop to add your first jeweller.</b></div></div>';
  const a = s.apps.find((x) => x.id === S.studioSel); const d = S.draft;
  if (!a || !d) return head + '<div class="card"><div class="empty"><b>Select a shop to begin</b></div></div>';

  const label = Object.fromEntries(s.statuses.map((x) => [x.key, x.label]));
  const list = `<div class="card studio-list" style="margin-bottom:14px"><div style="padding:10px 14px;font-size:12px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0">SELECT JEWELLER STORE</div>${s.apps.map((x) => `<button class="studio-item ${x.id === S.studioSel ? 'on' : ''}" onclick="studioSelect('${x.id}')" data-testid="studio-shop-${x.id}">
      <div><b>${esc(x.app_name || x.business_name)}</b><div class="sub">${esc(x.business_name)}${x.city ? ' · ' + esc(x.city) : ''}</div></div>
      <span class="badge ${x.app_status === 'live' ? 'green' : x.app_status === 'details_pending' ? 'amber' : 'gold'}">${label[x.app_status] || x.app_status}</span></button>`).join('')}</div>`;

  const serverIp = window.location.hostname || '13.233.54.98';
  const appHostPart = (d.domain || '').split('.')[0] || 'gold';
  const adminHostPart = (d.admin_domain || '').split('.')[0] || 'shop';

  const wizardTabs = `<div style="display:flex;gap:6px;margin-bottom:14px;background:#f8fafc;padding:6px;border-radius:10px;border:1px solid #e2e8f0;overflow-x:auto">
    <button class="btn ${S.studioStep === 1 ? 'primary' : 'ghost'}" onclick="setStudioStep(1)" style="flex:1;min-width:130px;font-size:12px;padding:8px 10px">
      <b>1. Store Identity</b>
    </button>
    <button class="btn ${S.studioStep === 2 ? 'primary' : 'ghost'}" onclick="setStudioStep(2)" style="flex:1;min-width:130px;font-size:12px;padding:8px 10px">
      <b>2. Theme & Visuals</b>
    </button>
    <button class="btn ${S.studioStep === 3 ? 'primary' : 'ghost'}" onclick="setStudioStep(3)" style="flex:1;min-width:130px;font-size:12px;padding:8px 10px">
      <b>3. Rates & Margins</b>
    </button>
    <button class="btn ${S.studioStep === 4 ? 'primary' : 'ghost'}" onclick="setStudioStep(4)" style="flex:1;min-width:150px;font-size:12px;padding:8px 10px">
      <b>4. Custom Subdomain & Shop Panel</b>
    </button>
    <button class="btn ${S.studioStep === 5 ? 'primary' : 'ghost'}" onclick="setStudioStep(5)" style="flex:1;min-width:150px;font-size:12px;padding:8px 10px">
      <b>5. Cloud Build & Publish</b>
    </button>
  </div>`;

  let stepContent = '';

  if (S.studioStep === 1) {
    stepContent = `<div class="card pad">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 class="card-t" style="margin:0">Step 1: Store & App Identity</h3>
        <span class="badge">Basic Details</span>
      </div>
      <p class="sub" style="margin-top:0;margin-bottom:14px">Set the public app name, Play Store / App Store bundle ID, support contacts and store listing.</p>
      
      <div class="field"><label>App Name (shown under app icon on customer phone) *</label><input class="input" id="st_name" maxlength="30" value="${esc(d.app_name)}" oninput="dset('app_name',this.value)"></div>
      <div class="field"><label>App ID / Package Name *</label><input class="input" id="st_bundle" value="${esc(d.bundle_id)}" oninput="dset('bundle_id',this.value.toLowerCase())"><div class="hint">e.g. in.vaultra.${esc(a.business_name.split(' ')[0].toLowerCase())} • Used for Play Store and App Store publishing • cannot change after publish</div></div>
      
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:16px">
        <h4 style="margin:0 0 10px 0;font-size:13px;color:#0f172a;display:flex;align-items:center;gap:6px">
          <span>🎨 App Icon & Splash Screen Dimensions</span>
          <span class="badge blue">Store & Launcher Compliant</span>
        </h4>
        
        <div class="grid g2">
          <!-- App Icon Box -->
          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:12px;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <label style="font-weight:700;font-size:12px;color:#0f172a">App Icon (Adaptive Squircle & iOS)</label>
                <span class="badge gold" style="font-size:10px">1024 x 1024 px</span>
              </div>
              <div style="font-size:11px;color:#64748b;line-height:1.45;margin-bottom:10px">
                • <b>Exact Size:</b> 1024×1024 px (Square 1:1 PNG)<br>
                • <b>Safe Zone:</b> Keep main emblem & text inside central <b>60% (~620px circle)</b> so Samsung squircle, Pixel circle & iOS rounded corners never touch or clip the logo edges.<br>
                • <b>Style:</b> Full-bleed brand background or transparent emblem.
              </div>
            </div>
            <div>
              <input type="file" accept="image/png,image/jpeg,image/webp" onchange="studioUpload(this,'logo_url')" id="st_logo">
              ${d.logo_url ? `
                <div style="margin-top:10px;display:flex;align-items:center;gap:10px;background:#f1f5f9;padding:8px;border-radius:8px">
                  <div style="width:42px;height:42px;border-radius:11px;background:#1e293b;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.18);overflow:hidden">
                    <img src="${esc(d.logo_url)}" style="width:100%;height:100%;object-fit:cover">
                  </div>
                  <div>
                    <span class="badge green" style="font-size:10.5px">✓ 1024×1024 Icon Configured</span>
                    <div style="font-size:10px;color:#475569;margin-top:2px">Adaptive safe zone auto-scaled (never clipped)</div>
                  </div>
                </div>` : '<div class="hint" style="margin-top:6px">Fallback: Branded initial badge with luxury gradient</div>'}
            </div>
          </div>

          <!-- Splash Screen Box -->
          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:12px;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <label style="font-weight:700;font-size:12px;color:#0f172a">Launch Splash Screen</label>
                <span class="badge gold" style="font-size:10px">1080 x 1920 px poster</span>
              </div>
              <div style="font-size:11px;color:#64748b;line-height:1.45;margin-bottom:10px">
                • <b>Full-screen poster (recommended):</b> upload a 1080×1920 px (9:16) image. The app shows it edge to edge exactly like the preview on the right.<br>
                • Keep logo and text inside the middle area (about 15% margin from every edge) - different phones crop the edges slightly.<br>
                • Any splash image you upload is shown <b>full screen</b> - there is no small logo splash before it (the phone only shows the poster's background colour for a split second while the app starts).<br>
                • <b>Auto-Fallback:</b> If omitted, your App Icon is automatically used on luxury theme background.
              </div>
            </div>
            <div>
              <input type="file" accept="image/png,image/jpeg,image/webp" onchange="studioUpload(this,'splash_url')" id="st_splash">
              ${d.splash_url ? `
                <div style="margin-top:10px;display:flex;align-items:center;gap:10px;background:#f1f5f9;padding:8px;border-radius:8px">
                  <div style="width:36px;height:36px;border-radius:9px;background:#1e293b;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.18);overflow:hidden">
                    <img src="${esc(d.splash_url)}" style="width:100%;height:100%;object-fit:cover">
                  </div>
                  <div>
                    <span class="badge green" style="font-size:10.5px">✓ Splash Screen Configured</span>
                    <div style="font-size:10px;color:#475569;margin-top:2px">Seamless full-bleed launch display</div>
                  </div>
                </div>` : '<div class="hint" style="margin-top:6px">Fallback: Auto-generated luxury splash screen</div>'}
            </div>
          </div>
        </div>
      </div>
      
      <div class="grid g2">
        <div class="field"><label>App Release Version</label><input class="input" value="${esc(d.app_version)}" oninput="dset('app_version',this.value)"></div>
        <div class="field"><label>Customer Support Email *</label><input class="input" type="email" data-fmt="email" placeholder="support@yourstore.com" value="${esc(d.support_email)}" oninput="dset('support_email',this.value)"></div>
      </div>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0">
        <h4 style="margin:0 0 4px 0;font-size:13.5px">📍 Store Locator (shown in the app)</h4>
        <div class="sub" style="margin-bottom:10px">Address comes from the shop profile${S.studio.apps.find((x) => x.id === S.studioSel)?.address ? ': <b>' + esc(S.studio.apps.find((x) => x.id === S.studioSel).address) + '</b>' : ''}. Add map pin (optional) for exact directions.</div>
        <div class="grid g3">
          <div class="field"><label>Latitude</label><input class="input" id="st_lat" type="number" step="0.000001" value="${d.store_lat ?? ''}" placeholder="23.0225" oninput="dset('store_lat',this.value === '' ? null : Number(this.value))"></div>
          <div class="field"><label>Longitude</label><input class="input" id="st_lng" type="number" step="0.000001" value="${d.store_lng ?? ''}" placeholder="72.5714" oninput="dset('store_lng',this.value === '' ? null : Number(this.value))"></div>
          <div class="field"><label>Store Timings</label><input class="input" id="st_hours" maxlength="120" value="${esc(d.store_hours)}" placeholder="10:00 AM – 8:00 PM (Mon–Sat)" oninput="dset('store_hours',this.value)"></div>
        </div>
      </div>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0">
        <h4 style="margin:0 0 10px 0;font-size:13.5px">Store Listing (Google Play & Apple App Store)</h4>
        <div class="field"><label>Short Description (80 chars max for Play Store listing)</label><input class="input" maxlength="80" value="${esc(d.store_short)}" oninput="dset('store_short',this.value)"></div>
        <div class="field"><label>Full Store Description</label><textarea class="input" rows="5" oninput="dset('store_long',this.value)">${esc(d.store_long)}</textarea></div>
        <div class="field"><label>Search Keywords (comma-separated)</label><input class="input" maxlength="100" value="${esc(d.store_keywords)}" oninput="dset('store_keywords',this.value)"></div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0">
        <button class="btn primary" onclick="studioSaveAndNext(2)" id="studio-save">Save Details & Next: Theme & Visuals →</button>
      </div>
    </div>`;
  } else if (S.studioStep === 2) {
    const setPreset = (key) => {
      d.theme_preset = key;
      const curP = s.presets[key];
      if (curP) {
        d.primary_color = curP.primaryColor;
        d.secondary_color = curP.secondaryColor;
        d.accent_color = curP.accentColor;
      }
      render();
    };

    const themes = Object.entries(s.presets).map(([key, P]) => `<button class="theme-opt ${d.theme_preset === key ? 'on' : ''}" onclick="dset('theme_preset','${key}',false);dset('primary_color','${P.primaryColor}',false);dset('secondary_color','${P.secondaryColor}',false);dset('accent_color','${P.accentColor}',false);dset('background_color','${P.backgroundColor}',true)" data-testid="theme-${key}">
      <div class="sw">${[P.primaryColor, P.secondaryColor, P.accentColor, P.backgroundColor].map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${P.label}</b><span>Radius ${P.cardRadius} · ${P.homeLayout.slice(0, 3).map((x) => SECTION_LABEL[x]).join(' → ')}</span></button>`).join('');

    const activePrimary = d.primary_color || s.presets[d.theme_preset].primaryColor;
    const activeSecondary = d.secondary_color || s.presets[d.theme_preset].secondaryColor;
    const activeAccent = d.accent_color || s.presets[d.theme_preset].accentColor;
    const activeBg = d.background_color || s.presets[d.theme_preset].backgroundColor;
    const activeText = d.text_color || '#111827';
    const colorField = (key, label, val, hint) => `<div class="field"><label>${label}</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="color" value="${esc(val)}" onchange="dset('${key}',this.value,true)" style="width:40px;height:38px;padding:2px;border-radius:6px;cursor:pointer">
              <input class="input" id="st_hex_${key}" value="${esc(val)}" oninput="dset('${key}',this.value,true)" style="flex:1">
            </div>
            <div class="hint" style="font-size:10.5px;color:#64748b;margin-top:3px">${hint}</div>
          </div>`;

    stepContent = `<div class="card pad">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 class="card-t" style="margin:0">Step 2: Theme & Visual Customizer</h3>
        <span class="badge gold">Branding & Colors</span>
      </div>
      <p class="sub" style="margin-top:0;margin-bottom:14px">Choose a luxury jewellery preset or customize brand colors. The phone preview on the right updates instantly!</p>
      
      <div style="margin-bottom:16px"><label style="font-weight:700;font-size:12.5px;color:#334155">Curated Luxury Presets (Mandatory)</label>
        <div class="themes" style="margin-top:8px">${themes}</div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-top:14px">
        <h4 style="margin:0 0 10px 0;font-size:13px;color:#0f172a">🎨 Professional Custom Color Override (Optional)</h4>
        <div class="grid g3">
          ${colorField('primary_color', '1. Primary Brand / Gold Color', activePrimary, 'Buttons, active icons & badges')}
          ${colorField('secondary_color', '2. Secondary Accent Tone', activeSecondary, 'Banners, gradients & subtitles')}
          ${colorField('accent_color', '3. Deep Accent / Card Tone', activeAccent, 'Live rate cards, SIP & headers')}
          ${colorField('background_color', '4. App Background Color', activeBg, 'Screen background & soft tints')}
          ${colorField('text_color', '5. Font / Text Color', activeText, 'Headings, labels & body text')}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0">
        <button class="btn" onclick="setStudioStep(1)">← Back to Identity</button>
        <button class="btn primary" onclick="studioSaveAndNext(3)" id="studio-save">Save Theme & Next: Rates & Margins →</button>
      </div>
    </div>`;
  } else if (S.studioStep === 3) {
    stepContent = `<div class="card pad">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 class="card-t" style="margin:0">Step 3: Rates, Margins & Karat Controls</h3>
        <span class="badge green">Pricing Engine</span>
      </div>
      <p class="sub" style="margin-top:0;margin-bottom:14px">Configure this jeweller's custom margins on top of the live MT5 MCX feed. Customers will see these exact calibrated prices in the app.</p>
      
      <div class="grid g2">
        <div class="field">
          <label>24K Gold Buy Markup (+₹/gram)</label>
          <input class="input num" type="number" step="1" value="${esc(a.gold_buy_markup_pct || 0)}" id="st_m_gold_markup" placeholder="0">
          <div class="hint">Added to live base gold rate when customer buys</div>
        </div>
        <div class="field">
          <label>24K Gold Sell Spread Discount (%)</label>
          <input class="input num" type="number" step="0.5" value="${esc(a.gold_sell_discount_pct || 3.0)}" id="st_m_gold_spread" placeholder="3.0">
          <div class="hint">Spread deducted when customer sells back to vault (standard 3%)</div>
        </div>
      </div>

      <div class="grid g2" style="margin-top:8px">
        <div class="field">
          <label>22K Jewellery Rate Margin (+/- ₹/gram)</label>
          <input class="input num" type="number" min="0" step="1" value="${esc(Math.max(0, a.gold22_commission_per_g || 0))}" id="st_m_gold22" placeholder="0">
          <div class="hint">Adjusts live 22K (916 Hallmarked) rate for showroom shopping</div>
        </div>
        <div class="field">
          <label>18K Jewellery Rate Margin (+/- ₹/gram)</label>
          <input class="input num" type="number" min="0" step="1" value="${esc(Math.max(0, a.gold18_commission_per_g || 0))}" id="st_m_gold18" placeholder="0">
          <div class="hint">Adjusts live 18K (750 Diamond Jewellery) rate for showroom shopping</div>
        </div>
      </div>

      <div class="grid g2" style="margin-top:8px">
        <div class="field">
          <label>999 Silver Buy Markup (+₹/gram)</label>
          <input class="input num" type="number" step="0.5" value="${esc(a.silver_buy_markup_pct || 0)}" id="st_m_silver" placeholder="0">
          <div class="hint">Added to live silver base rate</div>
        </div>
        <div class="field">
          <label>Default Making Charge % (Catalogue)</label>
          <input class="input num" type="number" step="1" value="12" placeholder="12" readonly>
          <div class="hint">Applied when customers convert digital gold to physical ornaments</div>
        </div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-top:14px">
        <div style="font-weight:700;font-size:12px;color:#0f172a;margin-bottom:6px">📊 Live Preview of Customer App Rates (Calculated Right Now):</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px">
          <div>24K Gold: <b>₹${(a.karats?.['24K'] || S.studio?.karats?.['24K'] || 0).toLocaleString('en-IN')} /g</b></div>
          <div>22K Gold: <b>₹${(a.karats?.['22K'] || S.studio?.karats?.['22K'] || 0).toLocaleString('en-IN')} /g</b></div>
          <div>18K Gold: <b>₹${(a.karats?.['18K'] || S.studio?.karats?.['18K'] || 0).toLocaleString('en-IN')} /g</b></div>
          <div>Silver: <b>₹${(a.silver_buy || S.studio?.price?.silver?.buy || 0).toLocaleString('en-IN')} /g</b></div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0">
        <button class="btn" onclick="setStudioStep(2)">← Back to Theme</button>
        <button class="btn primary" onclick="saveMarginsAndNext(4)" id="studio-save">Save Margins & Next: Custom Domain →</button>
      </div>
    </div>`;
  } else if (S.studioStep === 4) {
    stepContent = `<div class="card pad">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 class="card-t" style="margin:0">Step 4: Custom Subdomain & Shop Admin Panel</h3>
        <span class="badge blue">Domain & DNS</span>
      </div>
      <p class="sub" style="margin-top:0;margin-bottom:14px">Connect the jeweller's website so that <code>shop.jewellerdomain.com</code> automatically loads their private Shop Admin panel with SSL.</p>
      
      <div class="grid g2">
        <div class="field">
          <label>Jeweller Admin Portal Domain *</label>
          <input class="input" id="st_admin_domain" placeholder="e.g. shop.sharmajewellers.in" value="${esc(d.admin_domain || '')}" oninput="dset('admin_domain',this.value)">
          <div class="hint">Private portal for jeweller orders, KYC approval & rate controls</div>
        </div>
        <div class="field">
          <label>Customer Web App Domain (PWA / Web Portal)</label>
          <input class="input" id="st_domain" placeholder="e.g. gold.sharmajewellers.in" value="${esc(d.domain || '')}" oninput="dset('domain',this.value)">
          <div class="hint">Online customer portal for live rates, SIP & catalogue</div>
        </div>
      </div>

      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin:16px 0">
        <div style="font-weight:700;color:#166534;font-size:13px;margin-bottom:6px">📋 Exact DNS Records to Give the Jeweller:</div>
        <div style="font-size:12px;color:#15803d;margin-bottom:10px">The jeweller opens their domain registrar (GoDaddy, Hostinger, Cloudflare, BigRock) and adds these 2 records:</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #86efac">
          <thead>
            <tr style="background:#dcfce7;text-align:left;color:#166534">
              <th style="padding:6px 10px">Type</th>
              <th style="padding:6px 10px">Host / Subdomain</th>
              <th style="padding:6px 10px">Points To / Target</th>
              <th style="padding:6px 10px">TTL</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:8px 10px;font-weight:700">CNAME</td>
              <td style="padding:8px 10px"><code>${esc(adminHostPart)}</code></td>
              <td style="padding:8px 10px"><code>master.vaultragold.com</code> (or A record to <code>${serverIp}</code>)</td>
              <td style="padding:8px 10px">Automatic / 3600</td>
            </tr>
            <tr>
              <td style="padding:8px 10px;font-weight:700">CNAME</td>
              <td style="padding:8px 10px"><code>${esc(appHostPart)}</code></td>
              <td style="padding:8px 10px"><code>master.vaultragold.com</code> (or A record to <code>${serverIp}</code>)</td>
              <td style="padding:8px 10px">Automatic / 3600</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0">
        <button class="btn primary" onclick="checkDomainDNS('${a.id}')" id="btn-check-dns">🔍 Live Verify DNS Connection</button>
        <button class="btn" onclick="openShopAdmin('${a.id}')" style="background:#16a34a;color:#fff">⚡ 1-Click Test Shop Admin ↗</button>
        <div id="dns-verify-result" style="font-size:12px;width:100%"></div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0">
        <button class="btn" onclick="setStudioStep(3)">← Back to Rates</button>
        <button class="btn primary" onclick="studioSaveAndNext(5)" id="studio-save">Save Domains & Next: Build Center →</button>
      </div>
    </div>`;
  } else if (S.studioStep === 5) {
    stepContent = `<div class="card pad">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 class="card-t" style="margin:0">Step 5: Cloud Build & Store Publishing Center</h3>
        <span class="badge gold">Production Compiles</span>
      </div>
      <p class="sub" style="margin-top:0;margin-bottom:14px">Compile real production Android (.APK / .AAB) and iOS binaries in the cloud. Once downloaded, upload directly to Google Play Console and Apple App Store!</p>

      <div id="studio-build-box">
        ${renderBuildCenter(a.id)}
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-top:16px">
        <h4 style="margin:0 0 8px 0;font-size:13.5px">📱 Instant Mobile Web App Preview (Live Link):</h4>
        <div style="font-size:12px;color:#475569;margin-bottom:8px">Test the jeweller's branded mobile interface directly in your browser or phone without downloading:</div>
        <div style="display:flex;gap:10px;align-items:center">
          <a href="https://master.vaultragold.com/api/admin/jeweller?token=preview" target="_blank" class="btn sm primary">🚀 Open Web App Preview ↗</a>
          <span class="sub">Pre-connected to Mumbai Server & Live Rates</span>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0">
        <button class="btn" onclick="setStudioStep(4)">← Back to Custom Domain</button>
        <button class="btn green" onclick="toast('Jeweller app and shop setup completed! You can build or download above.')">✓ Setup Complete</button>
      </div>
    </div>`;
  }

  return head + `<div class="studio">
    ${list}
    <div class="studio-main">
      <div class="card pad" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0 0 2px 0;font-size:16px">👑 ${esc(a.business_name)}</h3>
            <div class="sub">App Name: <b>${esc(d.app_name)}</b> • Package: <code>${esc(d.bundle_id)}</code></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn sm" onclick="openShopAdmin('${a.id}')" style="background:#16a34a;color:#fff">🏪 Open Shop Admin ↗</button>
            <select class="select" style="width:auto;font-size:12px" onchange="studioStatus('${a.id}',this.value)">${s.statuses.map((x) => `<option value="${x.key}" ${x.key === a.app_status ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
          </div>
        </div>
        <div style="margin-top:10px">${stepper(a)}</div>
      </div>

      ${wizardTabs}

      <div class="studio-grid">
        <div style="min-width:0">${stepContent}</div>
        <div class="studio-preview-col">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div class="sub" style="font-weight:700;margin:0">📱 Live Preview</div>
            <div style="display:flex;gap:3px">
              <button class="btn ${(S.phonePreviewTab || 'home') === 'home' ? 'primary' : 'ghost'} pv-tab-btn" data-tab="home" onclick="setPhoneTab('home')" style="font-size:10.5px;padding:3px 8px">Home</button>
              <button class="btn ${S.phonePreviewTab === 'icon' ? 'primary' : 'ghost'} pv-tab-btn" data-tab="icon" onclick="setPhoneTab('icon')" style="font-size:10.5px;padding:3px 8px">App Icon</button>
              <button class="btn ${S.phonePreviewTab === 'splash' ? 'primary' : 'ghost'} pv-tab-btn" data-tab="splash" onclick="setPhoneTab('splash')" style="font-size:10.5px;padding:3px 8px">Splash</button>
            </div>
          </div>
          <div id="studio-preview">${phone()}</div>
          <div class="sub" style="margin-top:10px">Connected to <code>https://master.vaultragold.com</code></div>
        </div>
      </div>
    </div>
  </div>`;
}

async function saveMarginsAndNext(nextStep) {
  const mMarkup = Number(document.getElementById('st_m_gold_markup')?.value || 0);
  const mSpread = Number(document.getElementById('st_m_gold_spread')?.value || 3);
  const m22 = Number(document.getElementById('st_m_gold22')?.value || 0);
  const m18 = Number(document.getElementById('st_m_gold18')?.value || 0);
  const mSilver = Number(document.getElementById('st_m_silver')?.value || 0);
  try {
    await api('/jeweller/settings/margins', {
      method: 'PUT',
      body: {
        gold_buy_markup_pct: mMarkup,
        gold_sell_discount_pct: mSpread,
        gold22_commission_per_g: m22,
        gold18_commission_per_g: m18,
        silver_buy_markup_pct: mSilver
      }
    });
    toast('Margins updated successfully');
  } catch (_) {}
  studioSaveAndNext(nextStep);
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
  try {
    const url = await uploadImage(f, 'master_token', '/master/v3/upload');
    S.draft[key] = url;
    if (key === 'logo_url') S.phonePreviewTab = 'icon';
    else if (key === 'splash_url') S.phonePreviewTab = 'splash';
    toast(key === 'logo_url' ? 'App Icon uploaded (1024x1024) · save to keep it' : 'Splash Screen uploaded (1080x1920) · save to keep it');
    render();
  } catch (e) {
    toast(e.message, true);
  } finally {
    try { inp.value = ''; } catch (_) {}
  }
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
    if (!tok) { if (typeof logout === 'function') logout(); throw new Error('Session expired — please sign in again'); }
    const r = await fetch(API + `/master/app-studio/${id}/download/${kind}`, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) {
      if (r.status === 401) { localStorage.removeItem('master_token'); if (typeof logout === 'function') logout(); throw new Error('Session expired — please sign in again'); }
      const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Download failed');
    }
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
    <div class="ctl-row"><div><b>Maximum purchase per order</b><div class="sub">Largest single buy a customer can place (gold & silver)</div></div><div class="prefix" style="width:160px"><span>₹</span><input class="input num" id="g_max" type="number" min="100" step="1000" value="${g.max_investment || 200000}"></div></div>
    <div class="ctl-row"><div><b>Daily purchase limit per customer</b><div class="sub">Total a customer can buy in one day across all orders</div></div><div class="prefix" style="width:160px"><span>₹</span><input class="input num" id="g_daily" type="number" min="100" step="1000" value="${g.daily_limit || 200000}"></div></div>
    <div style="margin-top:12px"><button class="btn primary" onclick="ctlSave()" id="ctl-save">Save controls</button></div></div>
    <div class="card section"><div class="card-h"><h3>Per shop <span class="sub" style="font-weight:400">only that shop's customers are affected</span></h3></div><div class="table-wrap"><table><thead><tr><th>Shop</th><th>Live rates</th><th>Booking</th><th>KYC needed to buy</th><th>Customers see</th></tr></thead><tbody>
    ${c.shops.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="sub">${statusBadge(s.status)}</div></td><td>${sw('r_' + s.id, s.rates, 'ctlSet()')}</td><td>${sw('b_' + s.id, s.booking, 'ctlSet()')}</td><td>${sw('k_' + s.id, s.kyc_buy !== false, 'ctlSet()')}${s.kyc_buy === false ? ' <span class="badge amber">Testing: no KYC</span>' : ''}</td>
      <td>${s.effective.rates ? '<span class="badge green">Rates on</span>' : '<span class="badge red">Rates hidden</span>'} ${s.effective.booking && s.effective.rates ? '<span class="badge green">Booking on</span>' : '<span class="badge red">Booking off</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function ctlSet() { const b = $('#ctl-save'); if (b) b.textContent = 'Save controls · unsaved changes'; }
async function ctlSave() {
  const shops = {}; S.ctl.shops.forEach((s) => { shops[s.id] = { rates: $('#r_' + s.id).checked, booking: $('#b_' + s.id).checked, kyc_buy: $('#k_' + s.id).checked }; });
  try { await api('/master/v3/controls', { method: 'PUT', body: { rates: $('#g_rates').checked, booking: $('#g_booking').checked, min_investment: Number($('#g_min').value || 500), max_investment: Number($('#g_max').value || 200000), daily_limit: Number($('#g_daily').value || 200000), shops } }); toast('Controls saved'); loadCtl(); } catch (e) { toast(e.message, true); }
}
