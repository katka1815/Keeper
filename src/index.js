/* Rozcestník – backend (Cloudflare Worker). Bez hesla, jednouživatelský.
 * Data v KV (klíče "board", "inbox"). Cron běží hodinově a v 6:00 místního času
 * (dle settings.tz) provede denní úklid, promazání "Hotovo", kontrolu odkazů a úklid koše.
 */
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8" } });
const rid = () => crypto.randomUUID();
const DAY = 86400000;

function defaultBoard() {
  const now = Date.now();
  return {
    areas: [
      { id: rid(), name: "Číst později", type: "links", links: [] },
      { id: rid(), name: "Nástroje", type: "links", links: [] },
      { id: rid(), name: "Knihy", type: "text", links: [] },
    ],
    tasks: [],
    blocks: [{ id: rid(), name: "Tento týden", kind: "cycle", cycleN: 1, cycleUnit: "week", anchor: now, doneRetention: "week", color: "#246A63", goals: [], done: [] }],
    quotes: [],
    loans: { out: [], in: [] },
    debts: [],
    watches: [],
    watchHits: [],
    trash: [],
    settings: { tz: "Europe/Prague", lang: "cs", dailyCleanup: "move", doneRetention: "week", quoteSep: "|", lastDailyKey: 0 },
    meta: { lastCheckedAll: null },
  };
}

async function getBoard(env) { const r = await env.KV.get("board"); return r ? JSON.parse(r) : defaultBoard(); }
const putBoard = (env, b) => env.KV.put("board", JSON.stringify(b));
async function getInbox(env) { const r = await env.KV.get("inbox"); return r ? JSON.parse(r) : []; }
const putInbox = (env, x) => env.KV.put("inbox", JSON.stringify(x));

// ---- směnné kurzy (denní, základ EUR) ----
async function fetchRates() {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=CZK,USD,GBP,PLN");
    if (r.ok) { const d = await r.json(); if (d && d.rates) return Object.assign({ EUR: 1 }, d.rates); }
  } catch (e) {}
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/EUR");
    if (r.ok) { const d = await r.json(); if (d && d.rates) { const o = { EUR: 1 }; ["CZK", "USD", "GBP", "PLN"].forEach((c) => { if (d.rates[c]) o[c] = d.rates[c]; }); return o; } }
  } catch (e) {}
  return null;
}
async function getFx(env) {
  const today = new Date().toISOString().slice(0, 10);
  let fx = null;
  try { const raw = await env.KV.get("fx"); if (raw) fx = JSON.parse(raw); } catch (e) {}
  if (!fx || fx.day !== today || !fx.rates) {
    const rates = await fetchRates();
    if (rates) { fx = { day: today, base: "EUR", rates, fetchedAt: Date.now() }; await env.KV.put("fx", JSON.stringify(fx)); }
  }
  return fx;
}

// ---- místní čas dle tz ----
function local(ts, tz) {
  let p = {};
  try {
    const dtf = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "long" });
    for (const x of dtf.formatToParts(new Date(ts))) p[x.type] = x.value;
  } catch { const d = new Date(ts); p = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), weekday: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()] }; }
  const y = +p.year, m = +p.month, d = +p.day, h = (+p.hour) % 24;
  const wd = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }[p.weekday];
  const dayIndex = Math.floor(Date.UTC(y, m - 1, d) / DAY);
  return { y, m, d, h, wd, dayIndex, weekIndex: Math.floor((dayIndex - wd) / 7), monthIndex: y * 12 + (m - 1) };
}

function toTrash(board, kind, label, payload) {
  board.trash = board.trash || [];
  board.trash.unshift({ id: rid(), kind, label, payload, deletedAt: Date.now() });
}
function pruneTrash(board) {
  if (!board.trash) return;
  const cut = Date.now() - 30 * DAY;
  board.trash = board.trash.filter((t) => t.deletedAt > cut);
}

async function checkOne(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
  try { const r = await fetch(url, { method: "GET", redirect: "follow", signal: c.signal, headers: { "user-agent": "RozcestnikBot/1.0" } }); clearTimeout(t); return { status: r.status < 400 ? "ok" : "broken", code: r.status }; }
  catch (e) { clearTimeout(t); return { status: e.name === "AbortError" ? "unknown" : "broken", code: 0 }; }
}
async function checkBoard(board) {
  for (const a of board.areas) {
    if (a.type === "text") continue;
    for (const l of a.links) { if (!l.url) continue; const r = await checkOne(l.url); l.status = r.status; l.code = r.code; l.lastChecked = Date.now(); }
  }
  board.meta = board.meta || {}; board.meta.lastCheckedAll = Date.now();
}

// ---- hlídač: sleduje frázi na zadaných stránkách ----
const WATCH_BUDGET = 25;                 // nejvýš tolik stažení na jeden běh cronu
const WATCH_UA = "Rozcestnik-Watcher/1.0";
const DEEP_RE = /program|repertoar|repertoire|hraje|predstaveni|inscenace/;

function stripHtml(html) {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ").trim();
}
// bez diakritiky a malými písmeny, ale s mapou zpět do původního textu,
// aby se dal vypsat úryvek tak, jak je na stránce napsaný
function normMap(s, dropSpace) {
  let out = ""; const idx = [];
  for (let i = 0; i < s.length; i++) {
    if (dropSpace && /\s/.test(s[i])) continue;
    const ch = s[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (let k = 0; k < ch.length; k++) { out += ch[k]; idx.push(i); }
  }
  return { out, idx };
}
const normPhrase = (s, dropSpace) => normMap(String(s || "").replace(/\s+/g, " ").trim(), dropSpace).out;
const normText = (s) => normPhrase(s, false);

function findPhrase(text, phrase) {
  // 1. kolo: normálně. 2. kolo: bez mezer, aby se našel i název rozsekaný
  // značkami (<b>Mary</b>ša), po kterých stripHtml nechá mezeru navíc.
  for (const dropSpace of [false, true]) {
    const p = normPhrase(phrase, dropSpace);
    if (!p) return null;
    const nm = normMap(text, dropSpace);
    const i = nm.out.indexOf(p);
    if (i < 0) continue;
    const a = nm.idx[i], b = nm.idx[Math.min(nm.out.length - 1, i + p.length - 1)] + 1;
    return {
      snippet: text.slice(Math.max(0, a - 90), Math.min(text.length, b + 90)).trim(),
      wide: text.slice(Math.max(0, a - 1200), Math.min(text.length, b + 1200)),
    };
  }
  return null;
}

// ---- termíny a odkaz na vstupenky u nálezu ----
const CZ_MONTHS = {
  ledna: 1, leden: 1, unora: 2, unor: 2, brezna: 3, brezen: 3, dubna: 4, duben: 4,
  kvetna: 5, kveten: 5, cervna: 6, cerven: 6, cervence: 7, cervenec: 7,
  srpna: 8, srpen: 8, zari: 9, rijna: 10, rijen: 10, listopadu: 11, listopad: 11,
  prosince: 12, prosinec: 12,
};
const TICKET_RE = /vstupenk|koupit|rezerv|ticket|goout|colosseum|ticketportal|enigoo|smsticket|plusquest/;
const TICKET_HOST_RE = /goout\.net|colosseum\.eu|ticketportal|enigoo|smsticket|plusquest|ticketstream|vstupenkyonline/;

const pad2 = (n) => String(n).padStart(2, "0");

// Rok chybí? Vezmi letošek, a pokud už termín dávno minul, ber příští rok.
function guessYear(m, d, tz) {
  const L = local(Date.now(), tz || "Europe/Prague");
  let y = L.y;
  const cand = Date.UTC(y, m - 1, d), now = Date.UTC(L.y, L.m - 1, L.d);
  if (cand < now - 30 * DAY) y += 1;
  return y;
}

function extractDates(text, tz) {
  const out = [], seen = new Set();
  const push = (y, m, d, hh, mm) => {
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return;
    if (hh != null && !(hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)) { hh = null; mm = null; }
    const key = y + "-" + pad2(m) + "-" + pad2(d) + (hh != null ? "T" + pad2(hh) + ":" + pad2(mm) : "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ y, m, d, hh: hh == null ? null : hh, mm: hh == null ? null : mm, key });
  };

  // 3.10.2026 17:30 · 3. 10. · čas smí následovat, ale nesmí to být další datum
  const num = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(20\d\d)?(?:[^\d\n]{0,12}?(\d{1,2})[:.](\d{2})(?!\s*[.\d]))?/g;
  let m;
  while ((m = num.exec(text))) {
    const d = +m[1], mo = +m[2];
    const y = m[3] ? +m[3] : guessYear(mo, d, tz);
    push(y, mo, d, m[4] != null ? +m[4] : null, m[5] != null ? +m[5] : null);
  }

  // 3. října 2026 17:30
  const names = Object.keys(CZ_MONTHS).join("|");
  const nam = new RegExp("(\\d{1,2})\\s*\\.?\\s*(" + names + ")\\s*(20\\d\\d)?(?:[^\\d\\n]{0,12}?(\\d{1,2})[:.](\\d{2})(?!\\s*[.\\d]))?", "gi");
  const flat = normText(text);
  while ((m = nam.exec(flat))) {
    const d = +m[1], mo = CZ_MONTHS[m[2].toLowerCase()];
    const y = m[3] ? +m[3] : guessYear(mo, d, tz);
    push(y, mo, d, m[4] != null ? +m[4] : null, m[5] != null ? +m[5] : null);
  }

  // Stejný den se na stránce často objeví dvakrát: jednou jako holé datum
  // a jednou s časem. Když čas známe, tu bezčasou variantu zahodíme.
  const withTime = new Set(out.filter((x) => x.hh != null).map((x) => x.y + "-" + x.m + "-" + x.d));
  const merged = out.filter((x) => x.hh != null || !withTime.has(x.y + "-" + x.m + "-" + x.d));
  merged.sort((a, b) => a.key.localeCompare(b.key));
  return merged.slice(0, 6);
}

// Nejlepší odkaz do prodeje: cizí prodejna > kotva na téže stránce > cesta na témže webu
function findTicketUrl(html, pageUrl) {
  let base; try { base = new URL(pageUrl); } catch (e) { return ""; }
  const cands = { ext: "", anchor: "", same: "" };
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = (m[1] || "").trim();
    if (!href || href === "#" || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    const label = stripHtml(m[2] || "");
    if (!TICKET_RE.test(normText(href + " " + label))) continue;
    if (href.startsWith("#")) { if (!cands.anchor) cands.anchor = base.origin + base.pathname + href; continue; }
    let u; try { u = new URL(href, pageUrl); } catch (e) { continue; }
    if (TICKET_HOST_RE.test(u.hostname) && !cands.ext) cands.ext = u.toString();
    else if (u.origin === base.origin && !cands.same) cands.same = u.toString();
  }
  return cands.ext || cands.anchor || cands.same || "";
}

async function fetchPage(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
  try {
    const r = await fetch(url, { redirect: "follow", signal: c.signal, headers: { "user-agent": WATCH_UA } });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (ct && !/text\/html|text\/plain|application\/xhtml/i.test(ct)) return null;
    return await r.text();
  } catch (e) { clearTimeout(t); return null; }
}

async function robotsDisallow(origin, env) {
  const key = "robots:" + origin;
  try { const raw = await env.KV.get(key); if (raw) { const o = JSON.parse(raw); if (Date.now() - o.at < 7 * DAY) return o.dis; } } catch (e) {}
  const dis = [];
  const txt = await fetchPage(origin + "/robots.txt");
  if (txt) {
    let active = false;
    for (const line of txt.split(/\r?\n/)) {
      const l = line.split("#")[0].trim(); if (!l) continue;
      const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") active = v === "*";
      else if (active && k === "disallow" && v) dis.push(v);
    }
  }
  try { await env.KV.put(key, JSON.stringify({ at: Date.now(), dis })); } catch (e) {}
  return dis;
}
async function robotsAllows(url, env) {
  try { const u = new URL(url); const dis = await robotsDisallow(u.origin, env); return !dis.some((d) => u.pathname.startsWith(d)); }
  catch (e) { return false; }
}

function collectDeepLinks(html, baseUrl, max) {
  const out = []; const seen = new Set();
  let base; try { base = new URL(baseUrl); } catch (e) { return out; }
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < max) {
    const href = m[1];
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let u; try { u = new URL(href, baseUrl); } catch (e) { continue; }
    if (u.origin !== base.origin) continue;
    u.hash = "";
    const s = u.toString();
    if (seen.has(s) || s === baseUrl) continue;
    if (!DEEP_RE.test(normText(u.pathname + " " + stripHtml(m[2])))) continue;
    seen.add(s); out.push(s);
  }
  return out;
}

const ymdTime = (k) => Date.UTC(Math.floor(k / 10000), (Math.floor(k / 100) % 100) - 1, k % 100);
const daysSince = (a, b) => (a ? Math.round((ymdTime(b) - ymdTime(a)) / DAY) : 99999);

async function sendEmail(env, to, subject, text) {
  if (!env.RESEND_KEY || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + env.RESEND_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM || "onboarding@resend.dev", to: [to], subject, text }),
    });
    return r.ok;
  } catch (e) { return false; }
}

async function notifyHit(w, hit, env, to) {
  const origin = (await env.KV.get("app_origin")) || "";
  const name = w.name || w.phrase || "";
  const when = (hit.dates || []).map((d) => d.d + ". " + d.m + ". " + d.y + (d.hh == null ? "" : " " + d.hh + ":" + String(d.mm).padStart(2, "0"))).join(", ");
  const body = name + "\n" + hit.url
    + (when ? "\n" + when : "")
    + (hit.ticketUrl ? "\n" + hit.ticketUrl : "")
    + "\n\n" + (hit.snippet || "") + (origin ? "\n\n" + origin : "");
  if (env.NTFY_TOPIC) { try { await fetch("https://ntfy.sh/" + env.NTFY_TOPIC, { method: "POST", headers: { Title: "Rozcestnik" }, body }); } catch (e) {} }
  await sendEmail(env, to, "Rozcestnik: " + name, body);
}


// Na stránce s programem stojí datum i čas představení PŘED jeho názvem a mezi
// nimi bývá desítky znaků výplně ("Úterý Detail představení"). Ke každému
// výskytu fráze proto bereme nejbližší datum před ním, ne všechno v okolí —
// jinak si inscenace přivlastní termíny sousedních kusů v programu.
const DATE_G = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(20\d\d)?/g;
const TIME_G = /\b(\d{1,2})[:.](\d{2})\b(?!\s*[.\d])/g;
const BACK_WINDOW = 600;

function allMatches(text, phrase) {
  const out = [];
  const p = normPhrase(phrase, false);
  if (!p) return out;
  const nm = normMap(text, false);
  let from = 0, i;
  while ((i = nm.out.indexOf(p, from)) >= 0) { out.push(nm.idx[i]); from = i + p.length; }
  return out;
}

function datesForPhrase(text, phrase, tz) {
  const out = [], seen = new Set();
  for (const at of allMatches(text, phrase)) {
    const back = text.slice(Math.max(0, at - BACK_WINDOW), at);
    let last = null, m;
    DATE_G.lastIndex = 0;
    while ((m = DATE_G.exec(back))) last = m;
    if (!last) continue;
    const d = +last[1], mo = +last[2];
    if (!(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) continue;
    const y = last[3] ? +last[3] : guessYear(mo, d, tz);
    // čas patřící tomuhle představení leží mezi jeho datem a názvem
    let hh = null, mm = null, tm;
    const between = back.slice(last.index + last[0].length);
    TIME_G.lastIndex = 0;
    while ((tm = TIME_G.exec(between))) {
      const H = +tm[1], M = +tm[2];
      if (H >= 0 && H <= 23 && M >= 0 && M <= 59) { hh = H; mm = M; }
    }
    // Druhé rozložení: "3.10.2026 NÁZEV 3. 10. 2026 17:30". Čas je až za názvem,
    // tak ho tam dohledáme — ale jen dokud nenarazíme na JINÉ datum, aby si
    // představení nevzalo čas toho následujícího.
    if (hh == null) {
      const fwd = text.slice(at, at + 150);
      let stop = null, g;
      DATE_G.lastIndex = 0;
      while ((g = DATE_G.exec(fwd))) {
        if (+g[1] !== d || +g[2] !== mo) { stop = g.index; break; }
      }
      TIME_G.lastIndex = 0;
      const ft = TIME_G.exec(stop == null ? fwd : fwd.slice(0, stop));
      if (ft) {
        const H = +ft[1], M = +ft[2];
        if (H >= 0 && H <= 23 && M >= 0 && M <= 59) { hh = H; mm = M; }
      }
    }
    const key = y + "-" + pad2(mo) + "-" + pad2(d) + (hh == null ? "" : "T" + pad2(hh) + ":" + pad2(mm));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ y, m: mo, d, hh, mm, key });
  }
  if (!out.length) return extractDates(text, tz);  // stránka jedné inscenace: termíny jsou až za názvem
  const withTime = new Set(out.filter((x) => x.hh != null).map((x) => x.y + "-" + x.m + "-" + x.d));
  const merged = out.filter((x) => x.hh != null || !withTime.has(x.y + "-" + x.m + "-" + x.d));
  merged.sort((a, b) => a.key.localeCompare(b.key));
  return merged.slice(0, 8);
}

// only = id jednoho hlídání (ruční spuštění; obejde interval i ranní okno)
async function runWatches(board, env, only) {
  board.watches = Array.isArray(board.watches) ? board.watches : [];
  board.watchHits = Array.isArray(board.watchHits) ? board.watchHits : [];
  const s = board.settings || (board.settings = {});
  const L = local(Date.now(), s.tz || "Europe/Prague");
  const today = L.y * 10000 + L.m * 100 + L.d;
  let budget = WATCH_BUDGET, found = 0;
  if (only) board.watchHits = board.watchHits.filter((h) => h.watchId !== only);

  const due = board.watches
    .filter((w) => {
      if (only) return w.id === only;
      if (w.paused) return false;
      if (board.watchHits.some((h) => h.watchId === w.id)) return false;  // čeká na potvrzení, neotravuj
      if (L.h < 6) return false;
      return daysSince(w.lastRunDay || 0, today) >= Math.max(1, w.intervalDays || 7);
    })
    .sort((a, b) => (a.lastRunDay || 0) - (b.lastRunDay || 0));

  for (const w of due) {
    if (budget <= 0) break;
    const rejected = w.rejected || [];
    let pages = 0, hit = null;
    for (const url of w.urls || []) {
      if (budget <= 0 || hit) break;
      budget--;
      if (!(await robotsAllows(url, env))) continue;
      if (budget <= 0) break;
      budget--; pages++;
      const html = await fetchPage(url);
      if (!html) continue;
      const text = stripHtml(html);
      const found = findPhrase(text, w.phrase);
      if (found && !rejected.includes(url)) { hit = { url, html, text, found }; break; }
      if (w.deep) {
        for (const d of collectDeepLinks(html, url, 12)) {
          if (budget <= 0) break;
          budget--; pages++;
          const h2 = await fetchPage(d);
          if (!h2) continue;
          const t2 = stripHtml(h2);
          const f2 = findPhrase(t2, w.phrase);
          if (f2 && !rejected.includes(d)) { hit = { url: d, html: h2, text: t2, found: f2 }; break; }
        }
      }
    }
    w.lastRunDay = today; w.lastPages = pages;
    if (hit) {
      const rec = {
        id: rid(), watchId: w.id, name: w.name || w.phrase, url: hit.url,
        snippet: hit.found.snippet, foundAt: Date.now(),
        dates: datesForPhrase(hit.text, w.phrase, s.tz),
        ticketUrl: findTicketUrl(hit.html, hit.url),
      };
      board.watchHits.unshift(rec);
      found++;
      await notifyHit(w, rec, env, s.watchEmail || "");
    }
  }
  return found;
}

// denní rutina – spustí se po 6:00 místního času, jednou za den
async function maybeDaily(board) {
  const s = board.settings || (board.settings = {});
  const L = local(Date.now(), s.tz || "Europe/Prague");
  const key = L.y * 10000 + L.m * 100 + L.d;
  pruneTrash(board);
  if (L.h >= 6 && s.lastDailyKey !== key) {
    // 1) denní úklid hotových úkolů
    const doneT = board.tasks.filter((t) => t.done);
    board.tasks = board.tasks.filter((t) => !t.done);
    if (s.dailyCleanup === "move" && board.blocks[0]) { for (const t of doneT) board.blocks[0].done.unshift({ id: rid(), text: t.text, doneAt: Date.now() }); }
    else { for (const t of doneT) toTrash(board, "task", t.text, { list: "tasks", item: { ...t, done: false } }); }
    // 2) promazání "Hotovo" dle kadence každého bloku
    for (const b of board.blocks) {
      const r = b.doneRetention || "never";
      const boundary = r === "week" ? L.wd === 0 : r === "month" ? L.d === 1 : false;
      if (boundary && b.done.length) { for (const it of b.done) toTrash(board, "done", it.text, { block: b.id, item: it }); b.done = []; }
    }
    // 3) kontrola odkazů
    await checkBoard(board);
    // 4) vrácené věci a vyrovnané dluhy do koše
    board.loans = board.loans || { out: [], in: [] };
    for (const dir of ["out", "in"]) {
      const arr = board.loans[dir] || [], keep = [];
      for (const it of arr) { if (it.returned) toTrash(board, "loan-" + dir, (it.who || "") + " · " + (it.item || ""), { dir, item: it }); else keep.push(it); }
      board.loans[dir] = keep;
    }
    board.debts = Array.isArray(board.debts) ? board.debts : [];
    const keepD = [];
    for (const d of board.debts) { if (d.settled) toTrash(board, "debt", (d.who || "") + " · " + (d.amount || "") + " " + (d.cur || ""), { item: d }); else keepD.push(d); }
    board.debts = keepD;
    // 5) položky v oblastech, kterým prošel termín zapsaný Hlídačem
    for (const a of board.areas || []) {
      const arr = a.links || [], keepL = [];
      for (const it of arr) {
        if (it.expiresDay && key > it.expiresDay) {
          toTrash(board, a.type === "text" ? "txt" : "link", it.title || it.text || it.url || "", { area: a.id, item: it });
        } else keepL.push(it);
      }
      a.links = keepL;
    }
    s.lastDailyKey = key;
    return true;
  }
  return false;
}

async function fetchJson(u) { try { const r = await fetch(u, { headers: { "user-agent": "Rozcestnik/1.0" } }); if (!r.ok) return null; return await r.json(); } catch { return null; } }
const OL_LANG = { en: "eng", cs: "cze", sk: "slo", de: "ger", fr: "fre", es: "spa", ru: "rus", it: "ita" };
function fmtMime(f) { return f === "epub" ? "application/epub+zip" : f === "pdf" ? "application/pdf" : f === "txt" ? "text/plain" : f === "html" ? "text/html" : f === "mobi" ? "application/x-mobipocket-ebook" : ""; }

async function bookSearch(q) {
  const title = (q.title || "").trim(), author = (q.author || "").trim(), lang = (q.lang || "").trim(), fmt = (q.fmt || "epub").trim();
  const out = [];
  // Project Gutenberg (public domain, přímé soubory) přes Gutendex
  let gu = "https://gutendex.com/books?search=" + encodeURIComponent((title + " " + author).trim());
  if (lang) gu += "&languages=" + encodeURIComponent(lang);
  const g = await fetchJson(gu);
  if (g && g.results) for (const b of g.results.slice(0, 8)) {
    const fmts = b.formats || {}, want = fmtMime(fmt);
    let fileUrl = "";
    for (const k in fmts) { if (want && k.indexOf(want) === 0 && !/\.zip$/i.test(fmts[k])) { fileUrl = fmts[k]; break; } }
    out.push({ title: b.title, author: (b.authors || []).map(a => a.name).join(", "), lang: (b.languages || []).join(","), source: "Project Gutenberg", publicDomain: true, fileUrl, infoUrl: "https://www.gutenberg.org/ebooks/" + b.id, borrowUrl: "" });
  }
  // Wikisource (cs/sk/en) – volná díla s exportem do EPUB (řeší i slovenské tituly)
  const wls = lang ? (["cs", "sk", "en"].includes(lang) ? [lang] : []) : ["sk", "cs", "en"];
  for (const wl of wls) {
    const s = await fetchJson("https://" + wl + ".wikisource.org/w/api.php?action=query&list=search&srlimit=4&format=json&srsearch=" + encodeURIComponent((title + " " + author).trim()));
    if (s && s.query && s.query.search) for (const h of s.query.search) {
      const pg = h.title, enc = encodeURIComponent(pg.replace(/ /g, "_"));
      out.push({ title: pg, author, lang: wl, source: "Wikisource (" + wl + ")", publicDomain: true,
        fileUrl: "https://ws-export.wmcloud.org/?lang=" + wl + "&format=epub&page=" + enc,
        infoUrl: "https://" + wl + ".wikisource.org/wiki/" + enc, borrowUrl: "" });
    }
  }
  // Open Library (široká metadata + půjčování)
  let ol = "https://openlibrary.org/search.json?fields=title,author_name,language,ebook_access,ia,key&limit=8";
  if (title) ol += "&title=" + encodeURIComponent(title);
  if (author) ol += "&author=" + encodeURIComponent(author);
  if (lang && OL_LANG[lang]) ol += "&language=" + OL_LANG[lang];
  const o = await fetchJson(ol);
  if (o && o.docs) for (const d of o.docs) {
    const pd = d.ebook_access === "public", ia = (d.ia && d.ia[0]) || "";
    out.push({
      title: d.title, author: (d.author_name || []).join(", "), lang: (d.language || []).join(","), source: "Open Library",
      publicDomain: pd, fileUrl: "",
      infoUrl: pd && ia ? "https://archive.org/details/" + ia : "https://openlibrary.org" + d.key,
      borrowUrl: d.ebook_access === "borrowable" ? "https://openlibrary.org" + d.key : "",
    });
  }
  const res = out.slice(0, 18);
  const term = encodeURIComponent((title + " " + author).trim());
  res.push({ title: "Městská knihovna v Praze", author: "", lang: "cs", source: "hledat v knihovně", publicDomain: false, searchLink: true, fileUrl: "", infoUrl: "https://www.google.com/search?q=" + encodeURIComponent("site:mlp.cz ") + term, borrowUrl: "" });
  res.push({ title: "Zlatý fond SME", author: "", lang: "sk", source: "hledat v knihovně", publicDomain: false, searchLink: true, fileUrl: "", infoUrl: "https://www.google.com/search?q=" + encodeURIComponent("site:zlatyfond.sme.sk ") + term, borrowUrl: "" });
  return res;
}

// ---- Google Kalendář (obousměrný, za PINem) ----
function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function pinOk(request, env) {
  if (!env.CAL_PIN) return false;            // funkce je vypnutá, dokud není PIN
  return timingSafeEqual(request.headers.get("x-cal-pin") || "", env.CAL_PIN);
}
async function getGcal(env) { const r = await env.KV.get("gcal"); return r ? JSON.parse(r) : null; }
const putGcal = (env, o) => env.KV.put("gcal", JSON.stringify(o));

async function gcalToken(env) {
  const g = await getGcal(env);
  if (!g || !g.refresh_token) return null;
  if (g.access_token && g.expiry && Date.now() < g.expiry - 60000) return g.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: g.refresh_token, grant_type: "refresh_token" }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  g.access_token = j.access_token; g.expiry = Date.now() + (j.expires_in || 3600) * 1000;
  await putGcal(env, g); return g.access_token;
}
async function gcalApi(env, path, opts = {}) {
  const tok = await gcalToken(env);
  if (!tok) return { status: 401, json: async () => ({}), text: async () => "" };
  return fetch("https://www.googleapis.com/calendar/v3" + path, { ...opts, headers: { authorization: "Bearer " + tok, "content-type": "application/json", ...(opts.headers || {}) } });
}
function normDT(s) { return /T\d\d:\d\d$/.test(s) ? s + ":00" : s; }
function addDay(d) { const dt = new Date(d + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() + 1); return dt.toISOString().slice(0, 10); }
function buildEvent(b) {
  const summary = (b.summary || "").trim(); if (!summary) return null;
  const ev = { summary }; ev.description = String(b.description || "");
  if (b.colorId) ev.colorId = String(b.colorId);
  if (b.allDay) { if (!b.date) return null; ev.start = { date: b.date }; ev.end = { date: addDay(b.endDate || b.date) }; }
  else { if (!b.start || !b.end) return null; ev.start = { dateTime: normDT(b.start), timeZone: b.tz || undefined }; ev.end = { dateTime: normDT(b.end), timeZone: b.tz || undefined }; }
  return ev;
}

// ---- Sdílení výřezů desky (jen ke čtení, přes odkaz) ----
function bufToHex(b) { return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function hashPass(pass, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
  return bufToHex(bits);
}
async function getShareIndex(env) { const r = await env.KV.get("shares_index"); return r ? JSON.parse(r) : []; }
async function getCycle(env) { const r = await env.KV.get("cycle"); return r ? JSON.parse(r) : { periods: [] }; }
const putCycle = (env, o) => env.KV.put("cycle", JSON.stringify(o));
const putShareIndex = (env, x) => env.KV.put("shares_index", JSON.stringify(x));
async function getShare(env, t) { const r = await env.KV.get("share:" + t); return r ? JSON.parse(r) : null; }
const putShare = (env, rec) => env.KV.put("share:" + rec.token, JSON.stringify(rec));
function shareExpired(rec) { return rec.expiresAt && Date.now() > rec.expiresAt; }
function expFrom(b) { const h = Number(b.expiresInH); return (!h || h <= 0) ? null : Date.now() + h * 3600000; }
function resolveShare(board, rec) {
  const out = { label: rec.label || "", access: rec.access || "read", includeTasks: !!rec.includeTasks, areas: [], blocks: [], tasks: null, expiresAt: rec.expiresAt || null };
  const aset = new Set(rec.areas || []), bset = new Set(rec.blocks || []);
  for (const a of (board.areas || [])) if (aset.has(a.id)) out.areas.push({ id: a.id, name: a.name, type: a.type, links: (a.links || []).map((l) => a.type === "text" ? { id: l.id, text: l.text || l.title || "" } : { id: l.id, title: l.title || l.url, url: l.url, status: l.status || "unknown" }) });
  for (const b of (board.blocks || [])) if (bset.has(b.id)) out.blocks.push({ id: b.id, name: b.name, goals: (b.goals || []).map((g) => ({ id: g.id, text: g.text })), done: (b.done || []).map((d) => ({ id: d.id, text: d.text })) });
  if (rec.includeTasks) out.tasks = (board.tasks || []).map((t) => ({ id: t.id, text: t.text, done: !!t.done }));
  return out;
}
// úprava výřezu od příjemce – povolené jen na sdílené položky
function applyShareEdit(board, rec, b) {
  const aset = new Set(rec.areas || []), bset = new Set(rec.blocks || []), op = b.op;
  const area = (id) => board.areas.find((a) => a.id === id && aset.has(a.id));
  const block = (id) => board.blocks.find((x) => x.id === id && bset.has(x.id));
  if (op === "area.add") { const a = area(b.areaId); if (!a) return { error: "scope" }; if (a.type === "text") { const t = (b.text || "").trim(); if (!t) return { error: "empty" }; a.links.unshift({ id: rid(), text: t }); } else { const u = (b.url || "").trim(); if (!u) return { error: "empty" }; a.links.unshift({ id: rid(), title: (b.title || "").trim() || u, url: u, note: "", status: "unknown", lastChecked: null, code: 0 }); } return { ok: true }; }
  if (op === "area.edit") { const a = area(b.areaId); if (!a) return { error: "scope" }; const it = (a.links || []).find((l) => l.id === b.itemId); if (!it) return { error: "notfound" }; if (a.type === "text") it.text = (b.text || "").trim(); else { if (b.title != null) it.title = (b.title || "").trim() || it.url; if (b.url != null) { it.url = (b.url || "").trim(); it.status = "unknown"; } } return { ok: true }; }
  if (op === "area.del") { const a = area(b.areaId); if (!a) return { error: "scope" }; a.links = (a.links || []).filter((l) => l.id !== b.itemId); return { ok: true }; }
  if (op === "block.add") { const x = block(b.blockId); if (!x) return { error: "scope" }; const t = (b.text || "").trim(); if (!t) return { error: "empty" }; x.goals = x.goals || []; x.goals.push({ id: rid(), text: t }); return { ok: true }; }
  if (op === "block.edit") { const x = block(b.blockId); if (!x) return { error: "scope" }; const g = (x.goals || []).find((g) => g.id === b.goalId); if (!g) return { error: "notfound" }; g.text = (b.text || "").trim(); return { ok: true }; }
  if (op === "block.del") { const x = block(b.blockId); if (!x) return { error: "scope" }; x.goals = (x.goals || []).filter((g) => g.id !== b.goalId); return { ok: true }; }
  if (op === "block.done") { const x = block(b.blockId); if (!x) return { error: "scope" }; const i = (x.goals || []).findIndex((g) => g.id === b.goalId); if (i < 0) return { error: "notfound" }; const g = x.goals.splice(i, 1)[0]; x.done = x.done || []; x.done.unshift({ id: rid(), text: g.text, doneAt: Date.now() }); return { ok: true }; }
  if (rec.includeTasks) {
    if (op === "task.add") { const t = (b.text || "").trim(); if (!t) return { error: "empty" }; board.tasks = board.tasks || []; board.tasks.push({ id: rid(), text: t, done: false }); return { ok: true }; }
    if (op === "task.edit") { const t = (board.tasks || []).find((t) => t.id === b.taskId); if (!t) return { error: "notfound" }; t.text = (b.text || "").trim(); return { ok: true }; }
    if (op === "task.del") { board.tasks = (board.tasks || []).filter((t) => t.id !== b.taskId); return { ok: true }; }
    if (op === "task.toggle") { const t = (board.tasks || []).find((t) => t.id === b.taskId); if (!t) return { error: "notfound" }; t.done = !t.done; return { ok: true }; }
  }
  return { error: "badop" };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;

    // OAuth start: ověř PIN, pak přesměruj na Google (PIN v query, jde o navigaci)
    if (path === "/api/cal/auth") {
      if (!env.CAL_PIN) return new Response("Kalendář není nastaven (chybí CAL_PIN).", { status: 403 });
      if (!timingSafeEqual(url.searchParams.get("pin") || "", env.CAL_PIN)) return new Response("Špatný PIN.", { status: 403 });
      if (!env.GOOGLE_CLIENT_ID) return new Response("Chybí GOOGLE_CLIENT_ID (viz README).", { status: 500 });
      const stateTok = rid();
      await env.KV.put("gcal_state", stateTok, { expirationTtl: 600 });
      const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, redirect_uri: url.origin + "/api/cal/callback", response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar", access_type: "offline", prompt: "consent", state: stateTok,
      });
      return Response.redirect(auth, 302);
    }
    // OAuth callback: vyměň kód za tokeny, ulož refresh token do KV
    if (path === "/api/cal/callback") {
      const code = url.searchParams.get("code"), st = url.searchParams.get("state"), saved = await env.KV.get("gcal_state");
      if (!code || !st || !saved || st !== saved) return new Response("Neplatný stav přihlášení. Zkus to prosím znovu.", { status: 400 });
      await env.KV.delete("gcal_state");
      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: url.origin + "/api/cal/callback", grant_type: "authorization_code" }),
      });
      if (!tr.ok) return new Response("Výměna tokenu selhala: " + (await tr.text()), { status: 502 });
      const j = await tr.json(), g = (await getGcal(env)) || {};
      if (j.refresh_token) g.refresh_token = j.refresh_token;
      g.access_token = j.access_token; g.expiry = Date.now() + (j.expires_in || 3600) * 1000; g.connectedAt = Date.now();
      await putGcal(env, g);
      return new Response("<!doctype html><meta charset=utf-8><body style='font-family:system-ui;padding:40px;color:#20262B'><h2>Kalendář propojen ✓</h2><p>Můžeš zavřít toto okno – vrátíme tě do appky.</p><script>setTimeout(function(){location.href='/?cal=1'},1400)</script>", { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (path.startsWith("/api/")) {
      // Servírování uloženého souboru z R2 (binární, mimo JSON větev)
      if (path.startsWith("/api/book/file/")) {
        if (!env.BOOKS) return new Response("R2 nenastaveno", { status: 404 });
        const key = decodeURIComponent(path.slice("/api/book/file/".length));
        const obj = await env.BOOKS.get(key);
        if (!obj) return new Response("nenalezeno", { status: 404 });
        const h = new Headers();
        h.set("content-type", (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream");
        return new Response(obj.body, { headers: h });
      }
      try {
        // ---- Kalendář: datové endpointy, všechny za PINem ----
        if (path.startsWith("/api/cal/")) {
          if (!pinOk(request, env)) return json({ error: "pin" }, 401);
          if (path === "/api/cal/status") { const g = await getGcal(env); return json({ connected: !!(g && g.refresh_token) }); }
          if (path === "/api/cal/disconnect" && request.method === "POST") { await env.KV.delete("gcal"); return json({ ok: true }); }
          if (path === "/api/cal/events" && request.method === "GET") {
            const timeMin = url.searchParams.get("from") || new Date().toISOString();
            const timeMax = url.searchParams.get("to") || new Date(Date.now() + 14 * DAY).toISOString();
            const r = await gcalApi(env, "/calendars/primary/events?" + new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" }));
            if (r.status === 401) return json({ error: "reauth" }, 401);
            if (!r.ok) return json({ error: await r.text() }, 502);
            const j = await r.json();
            const items = (j.items || []).map((e) => ({ id: e.id, summary: e.summary || "(bez názvu)", description: e.description || "", start: (e.start && (e.start.dateTime || e.start.date)) || null, end: (e.end && (e.end.dateTime || e.end.date)) || null, allDay: !!(e.start && e.start.date && !e.start.dateTime), htmlLink: e.htmlLink || "" }));
            return json({ items });
          }
          if (path === "/api/cal/create" && request.method === "POST") {
            const ev = buildEvent(await request.json().catch(() => ({}))); if (!ev) return json({ error: "bad" }, 400);
            const r = await gcalApi(env, "/calendars/primary/events", { method: "POST", body: JSON.stringify(ev) });
            if (r.status === 401) return json({ error: "reauth" }, 401);
            if (!r.ok) return json({ error: await r.text() }, 502);
            const cj = await r.json().catch(() => ({}));
            return json({ ok: true, id: cj.id || "" });
          }
          if (path === "/api/cal/update" && request.method === "POST") {
            const b = await request.json().catch(() => ({})); if (!b.id) return json({ error: "no-id" }, 400);
            const ev = buildEvent(b); if (!ev) return json({ error: "bad" }, 400);
            const r = await gcalApi(env, "/calendars/primary/events/" + encodeURIComponent(b.id), { method: "PATCH", body: JSON.stringify(ev) });
            if (r.status === 401) return json({ error: "reauth" }, 401);
            if (!r.ok) return json({ error: await r.text() }, 502);
            return json({ ok: true });
          }
          if (path === "/api/cal/delete" && request.method === "POST") {
            const b = await request.json().catch(() => ({})); if (!b.id) return json({ error: "no-id" }, 400);
            const r = await gcalApi(env, "/calendars/primary/events/" + encodeURIComponent(b.id), { method: "DELETE" });
            if (r.status === 401) return json({ error: "reauth" }, 401);
            if (!r.ok && r.status !== 410) return json({ error: await r.text() }, 502);
            return json({ ok: true });
          }
          return json({ error: "not found" }, 404);
        }
        // ---- Sdílení výřezů ----
        if (path.startsWith("/api/share/")) {
          if (path === "/api/share/view" && request.method === "GET") {
            const rec = await getShare(env, url.searchParams.get("token") || "");
            if (!rec) return json({ error: "notfound" }, 404);
            if (shareExpired(rec)) return json({ error: "expired" }, 410);
            if (rec.mode === "private") {
              const pass = request.headers.get("x-share-pass") || url.searchParams.get("p") || "";
              if (!pass) return json({ needPassword: true, label: rec.label || "" }, 401);
              const h = await hashPass(pass, rec.salt);
              if (!timingSafeEqual(h, rec.passHash)) return json({ needPassword: true, label: rec.label || "", bad: true }, 401);
            }
            return json(resolveShare(await getBoard(env), rec));
          }
          if (path === "/api/share/list" && request.method === "GET") {
            const idx = await getShareIndex(env);
            return json({ shares: idx.map((s) => ({ token: s.token, label: s.label, mode: s.mode, access: s.access || "read", expiresAt: s.expiresAt || null, areas: s.areas || [], blocks: s.blocks || [], includeTasks: !!s.includeTasks, notify: !!s.notify })) });
          }
          if (path === "/api/share/edit" && request.method === "POST") {
            const b = await request.json().catch(() => ({}));
            const rec = await getShare(env, b.token || "");
            if (!rec) return json({ error: "notfound" }, 404);
            if (shareExpired(rec)) return json({ error: "expired" }, 410);
            if ((rec.access || "read") !== "edit") return json({ error: "readonly" }, 403);
            if (rec.mode === "private") {
              const pass = request.headers.get("x-share-pass") || "";
              if (!pass) return json({ error: "password" }, 401);
              if (!timingSafeEqual(await hashPass(pass, rec.salt), rec.passHash)) return json({ error: "password" }, 401);
            }
            const board = await getBoard(env);
            const res = applyShareEdit(board, rec, b);
            if (!res.ok) return json({ error: res.error }, 400);
            await putBoard(env, board);
            return json({ ok: true });
          }
          if (path === "/api/share/create" && request.method === "POST") {
            const b = await request.json().catch(() => ({}));
            const areas = Array.isArray(b.areas) ? b.areas : [], blocks = Array.isArray(b.blocks) ? b.blocks : [], includeTasks = !!b.includeTasks;
            if (!areas.length && !blocks.length && !includeTasks) return json({ error: "empty" }, 400);
            const mode = b.mode === "private" ? "private" : "obscure";
            const access = b.access === "edit" ? "edit" : "read";
            const rec = { token: rid() + rid().slice(0, 8), label: (b.label || "").slice(0, 80), areas, blocks, includeTasks, mode, access, createdAt: Date.now(), expiresAt: expFrom(b), notify: !!b.notify, notifyAheadH: Number(b.notifyAheadH) || 48, lastNotifiedFor: 0 };
            if (mode === "private") { const pass = (b.password || "").trim(); if (!pass) return json({ error: "nopass" }, 400); rec.salt = rid(); rec.passHash = await hashPass(pass, rec.salt); }
            await putShare(env, rec);
            const idx = await getShareIndex(env);
            idx.unshift({ token: rec.token, label: rec.label, mode, access, expiresAt: rec.expiresAt, areas, blocks, includeTasks, notify: rec.notify });
            await putShareIndex(env, idx);
            await env.KV.put("app_origin", url.origin);
            return json({ ok: true, token: rec.token, url: url.origin + "/s/" + rec.token, mode, access });
          }
          if (path === "/api/share/revoke" && request.method === "POST") {
            const token = (await request.json().catch(() => ({}))).token || "";
            await env.KV.delete("share:" + token);
            await putShareIndex(env, (await getShareIndex(env)).filter((s) => s.token !== token));
            return json({ ok: true });
          }
          if (path === "/api/share/extend" && request.method === "POST") {
            const b = await request.json().catch(() => ({})), token = b.token || "";
            const rec = await getShare(env, token); if (!rec) return json({ error: "notfound" }, 404);
            rec.expiresAt = expFrom(b); rec.lastNotifiedFor = 0; await putShare(env, rec);
            await putShareIndex(env, (await getShareIndex(env)).map((s) => s.token === token ? { ...s, expiresAt: rec.expiresAt } : s));
            return json({ ok: true, expiresAt: rec.expiresAt });
          }
          return json({ error: "not found" }, 404);
        }
        // ---- Cyklus (citlivá data, za PINem, mimo otevřenou desku) ----
        // ---- Trvalé smazání všech dat ----
        if (path === "/api/wipe" && request.method === "POST") {
          const idx = await getShareIndex(env);
          await Promise.all((idx || []).map((t) => env.KV.delete("share:" + t)));
          await Promise.all(["board", "inbox", "shares_index", "app_origin", "gcal_state"].map((k) => env.KV.delete(k)));
          if (pinOk(request, env)) await Promise.all(["cycle", "gcal"].map((k) => env.KV.delete(k)));
          return json({ ok: true });
        }
        if (path.startsWith("/api/cycle/")) {
          if (!pinOk(request, env)) return json({ error: "pin" }, 401);
          if (path === "/api/cycle/get") return json(await getCycle(env));
          if (path === "/api/cycle/save" && request.method === "POST") {
            const b = await request.json().catch(() => ({}));
            const periods = Array.isArray(b.periods) ? b.periods.filter((p) => p && p.start).map((p) => ({ id: String(p.id || rid()), start: String(p.start).slice(0, 10), end: p.end ? String(p.end).slice(0, 10) : null, skip: !!p.skip })) : [];
            await putCycle(env, { periods, updatedAt: Date.now() });
            return json({ ok: true });
          }
          return json({ error: "not found" }, 404);
        }
        if (path === "/api/fx" && request.method === "GET") {
          const fx = await getFx(env);
          return fx ? json(fx) : json({ error: "fx-unavailable" }, 502);
        }
        if (path === "/api/capture" && request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          const text = (b.text || "").trim(), link = (b.url || "").trim();
          if (!text && !link) return json({ error: "empty" }, 400);
          const inbox = await getInbox(env);
          inbox.unshift({ id: rid(), type: b.type || (link ? "link" : "point"), text, url: link, created: Date.now() });
          await putInbox(env, inbox);
          return json({ ok: true });
        }
        if (path === "/api/watch/run" && request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          const board = await getBoard(env);
          const found = await runWatches(board, env, b.id || null);
          await putBoard(env, board);
          return json({ board, found });
        }
        if (path === "/api/state" && request.method === "GET") {
          const board = await getBoard(env);
          const changed = await maybeDaily(board);
          if (changed) await putBoard(env, board);
          return json({ board, inbox: await getInbox(env), r2: !!env.BOOKS });
        }
        if (path === "/api/state" && request.method === "PUT") {
          const b = await request.json();
          if (b.board) await putBoard(env, b.board);
          if (Array.isArray(b.inbox)) await putInbox(env, b.inbox);
          return json({ ok: true });
        }
        if (path === "/api/check" && request.method === "POST") {
          const board = await getBoard(env); await checkBoard(board); await putBoard(env, board);
          return json({ board });
        }
        if (path === "/api/book/search" && request.method === "GET") {
          return json({ results: await bookSearch(Object.fromEntries(url.searchParams)) });
        }
        if (path === "/api/book/save" && request.method === "POST") {
          if (!env.BOOKS) return json({ error: "r2-off" }, 400);
          const b = await request.json().catch(() => ({}));
          if (!b.url) return json({ error: "no-url" }, 400);
          const resp = await fetch(b.url, { redirect: "follow", headers: { "user-agent": "Rozcestnik/1.0" } });
          if (!resp.ok) return json({ error: "fetch " + resp.status }, 502);
          const ext = ((b.url.split("?")[0].split(".").pop()) || "bin").slice(0, 5).replace(/[^a-z0-9]/gi, "");
          const key = "books/" + rid() + "." + ext;
          await env.BOOKS.put(key, resp.body, { httpMetadata: { contentType: resp.headers.get("content-type") || "application/octet-stream" } });
          return json({ key, url: "/api/book/file/" + key });
        }
      } catch (e) { return json({ error: String(e) }, 500); }
      return json({ error: "not found" }, 404);
    }
    if (path === "/s" || path.startsWith("/s/")) {
      return env.ASSETS.fetch(new Request(new URL("/share", url).toString(), request));
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const board = await getBoard(env);
      await maybeDaily(board);
      try { await runWatches(board, env, null); } catch (e) {}
      await putBoard(env, board);
      try { await getFx(env); } catch (e) {}
      const broken = board.areas.flatMap((a) => (a.type === "text" ? [] : a.links)).filter((l) => l.status === "broken");
      if (broken.length && env.NTFY_TOPIC) await fetch("https://ntfy.sh/" + env.NTFY_TOPIC, { method: "POST", headers: { Title: "Rozcestnik" }, body: broken.length + " rozbitych odkazu." });
      // sdílení: upozornit před vypršením + uklidit dávno prošlá
      const sidx = await getShareIndex(env);
      if (sidx.length) {
        const origin = (await env.KV.get("app_origin")) || "";
        let changed = false; const keep = [];
        for (const s of sidx) {
          const rec = await getShare(env, s.token);
          if (!rec) { changed = true; continue; }
          if (rec.expiresAt && Date.now() > rec.expiresAt + 7 * DAY) { await env.KV.delete("share:" + rec.token); changed = true; continue; }
          if (rec.notify && rec.expiresAt && env.NTFY_TOPIC) {
            const ahead = (rec.notifyAheadH || 48) * 3600000;
            if (Date.now() >= rec.expiresAt - ahead && Date.now() < rec.expiresAt && rec.lastNotifiedFor !== rec.expiresAt) {
              await fetch("https://ntfy.sh/" + env.NTFY_TOPIC, { method: "POST", headers: { Title: "Rozcestnik - sdileni" }, body: "Sdileni '" + (rec.label || rec.token.slice(0, 6)) + "' brzy vyprsi. Prodlouzit: " + origin + "/?shares=1" });
              rec.lastNotifiedFor = rec.expiresAt; await putShare(env, rec);
            }
          }
          keep.push(s);
        }
        if (changed) await putShareIndex(env, keep);
      }
    })());
  },
};
