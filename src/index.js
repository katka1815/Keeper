/* Rozcestník – backend (Cloudflare Worker). Bez hesla, jednouživatelský.
 * Data v KV (klíče "board", "inbox"). Cron běží hodinově a v 6:00 místního času
 * (dle settings.tz) provede denní úklid, promazání "Hotovo", kontrolu odkazů a úklid koše.
 */
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...h } });
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
// Obrázky (screenshoty z rozšíření): R2, když je nastavené, jinak KV. Každý má vlastní klíč,
// do JSONu desky ani inboxu se nevkládají, aby /api/state zůstal rychlý.
const IMG_MAX = 4 * 1024 * 1024;
function parseDataUrl(d) {
  const m = /^data:(image\/(?:webp|jpeg|png|gif));base64,([A-Za-z0-9+/=]+)$/.exec(d || "");
  if (!m) return null;
  const bin = atob(m[2]); if (bin.length > IMG_MAX) return null;
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1], bytes };
}
// img.e = bajty jsou zamčené veřejným klíčem (šifrování obsahu); type je typ obrázku uvnitř.
async function putImg(env, id, img) {
  if (env.BOOKS) await env.BOOKS.put("img/" + id, img.bytes, { httpMetadata: { contentType: img.type }, customMetadata: img.e ? { e: "1" } : {} });
  else await env.KV.put("img:" + id, img.bytes, { metadata: { type: img.type, t: Date.now(), ...(img.e ? { e: 1 } : {}) } });
}
// Obrázek z telefonu nebo rozšíření se se zapnutým šifrováním hned zamkne.
async function putImgSealed(env, id, img) {
  const seal = await sealer(env);
  if (seal) img = { type: img.type, bytes: await seal.bytes(img.bytes), e: 1 };
  await putImg(env, id, img);
}
// Obrázky ve sdílení, kde si uživatelka zvolila „čitelné obrázky“: ty se nezamykají.
async function publicImgIds(env) {
  const ids = new Set(); let board = null;
  for (const s of await getShareIndex(env)) {
    const rec = await getShare(env, s.token);
    if (!rec || !rec.images || shareExpired(rec)) continue;
    board = board || (await getBoard(env));
    const txt = JSON.stringify((board.areas || []).filter((a) => (rec.areas || []).includes(a.id)));
    for (const m of txt.match(/\/api\/img\/[a-z0-9-]{4,40}/gi) || []) ids.add(m.slice(9));
  }
  return ids;
}
// Zamkne obrázky, které ještě zamčené nejsou (po zapnutí šifrování, po zrušení sdílení).
async function sealImages(env, max) {
  const seal = await sealer(env); if (!seal) return 0;
  const pub = await publicImgIds(env), todo = [];
  if (env.BOOKS) { const l = await env.BOOKS.list({ prefix: "img/", limit: 1000, include: ["customMetadata"] }); for (const o of l.objects) { const id = o.key.slice(4); if (!(o.customMetadata && o.customMetadata.e) && !pub.has(id)) todo.push(id); } }
  else { const k = await env.KV.list({ prefix: "img:", limit: 1000 }); for (const o of k.keys) { const id = o.name.slice(4); if (!(o.metadata && o.metadata.e) && !pub.has(id)) todo.push(id); } }
  for (const id of todo.slice(0, max)) {
    const img = await getImg(env, id); if (!img || img.e) continue;
    const buf = img.body instanceof ArrayBuffer ? img.body : await new Response(img.body).arrayBuffer();
    await putImg(env, id, { type: img.type, bytes: await seal.bytes(new Uint8Array(buf)), e: 1 });
  }
  return Math.max(0, todo.length - max);
}
// Osiřelé obrázky: položka s obrázkem se zařadí do oblasti (adresa /api/img/<id>),
// pak se smaže a po 30 dnech vypadne z Koše, ale obrázek v úložišti zůstane.
// Jednou denně z cronu se smažou obrázky, jejichž id není nikde v desce (včetně
// Koše) ani v Ke zpracování. Nové obrázky mají dva dny lhůtu (zápis desky ze
// stránky může přijít až po nahrání) a smaže se nejvýš 25 za běh kvůli limitu.
async function gcImages(env, board, inbox) {
  // Se šifrováním odkazy na obrázky v textu nejsou vidět: stránka je vypisuje do meta.imgRefs.
  // Bez toho seznamu se nesmaže nic.
  if (JSON.stringify(board).includes("enc1.") && !Array.isArray(board.meta && board.meta.imgRefs)) return 0;
  const refs = JSON.stringify(board) + JSON.stringify(inbox) + JSON.stringify((board.meta && board.meta.imgRefs) || []), old = Date.now() - 2 * DAY, gone = new Set();
  if (env.BOOKS) { const l = await env.BOOKS.list({ prefix: "img/", limit: 1000 }); for (const o of l.objects) { const id = o.key.slice(4); if (id && !refs.includes(id) && +new Date(o.uploaded) < old) gone.add(id); } }
  const k = await env.KV.list({ prefix: "img:", limit: 1000 }); for (const o of k.keys) { const id = o.name.slice(4); if (id && !refs.includes(id) && !(o.metadata && o.metadata.t > old)) gone.add(id); }
  const del = [...gone].slice(0, 25); for (const id of del) await delImg(env, id);
  return del.length;
}
async function getImg(env, id) {
  if (env.BOOKS) { const o = await env.BOOKS.get("img/" + id); if (o) return { body: o.body, type: (o.httpMetadata && o.httpMetadata.contentType) || "image/webp", e: !!(o.customMetadata && o.customMetadata.e) }; }
  const r = await env.KV.getWithMetadata("img:" + id, "arrayBuffer");
  return r && r.value ? { body: r.value, type: (r.metadata && r.metadata.type) || "image/webp", e: !!(r.metadata && r.metadata.e) } : null;
}
// ---- ikonky webů bez Googlu ----
// Server si ikonku stáhne přímo z toho webu (<link rel="icon"> na hlavní stránce, jinak
// /favicon.ico) a drží ji 30 dní v KV (fav:<doména>); nenalezenou taky, jako prázdnou.
const FAV_UA = "Mozilla/5.0 (compatible; RozcestnikBot/1.0)", FAV_MAX = 100000;
async function favicon(env, domain) {
  domain = String(domain || "").toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain) || domain.length > 253) return null;
  const key = "fav:" + domain, hit = await env.KV.getWithMetadata(key, "arrayBuffer");
  if (hit && hit.value) return hit.value.byteLength ? { body: hit.value, type: (hit.metadata && hit.metadata.type) || "image/x-icon" } : null;
  const cands = [];
  try {
    const r = await fetch("https://" + domain + "/", { redirect: "follow", signal: AbortSignal.timeout(6000), headers: { "user-agent": FAV_UA, accept: "text/html" } });
    if (r.ok && /html/i.test(r.headers.get("content-type") || "")) {
      const head = (await r.text()).slice(0, 300000).split(/<\/head>/i)[0];
      for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
        if (!/\brel=["']?[^"'>]*\bicon\b/i.test(m[0])) continue;
        const h = m[0].match(/\bhref=["']([^"']+)["']/i);
        if (h) { try { cands.push(new URL(decodeEnt(h[1]), r.url || "https://" + domain + "/").href); } catch (e) {} }
      }
    }
  } catch (e) {}
  cands.push("https://" + domain + "/favicon.ico");
  let found = null;
  for (const u of cands.slice(0, 4)) {
    if (!/^https?:\/\//i.test(u)) continue;
    try {
      const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(5000), headers: { "user-agent": FAV_UA } });
      const t = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!r.ok || !(/^image\//.test(t) || /\.ico(\?|$)/i.test(u))) continue;
      const b = await r.arrayBuffer();
      if (!b.byteLength || b.byteLength > FAV_MAX) continue;
      found = { body: b, type: /^image\//.test(t) ? t : "image/x-icon" }; break;
    } catch (e) {}
  }
  await env.KV.put(key, found ? found.body : new Uint8Array(0), { expirationTtl: 30 * 86400, metadata: { type: found ? found.type : "" } });
  return found;
}
// Náhled odkazu pro Pořádek: z hlavičky stránky vytáhne og:image, název a popis.
// Žádná cizí služba, jen jeden fetch Workeru; výsledek se drží týden v KV.
function metaContent(head, keys) {
  for (const k of keys) {
    const re = new RegExp("<meta[^>]+(?:property|name)=[\"']" + k.replace(/[:.]/g, "\\$&") + "[\"'][^>]*>", "i");
    const tag = head.match(re);
    if (tag) { const m = tag[0].match(/content=["']([^"']*)["']/i); if (m && m[1].trim()) return m[1].trim(); }
  }
  return "";
}
function decodeEnt(t) {
  return (t || "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function parsePreview(html, base) {
  const head = html.slice(0, 200000);
  const abs = (u) => { try { return u ? new URL(decodeEnt(u), base).href : ""; } catch (e) { return ""; } };
  const t = head.match(/<title[^>]*>([^<]*)<\/title>/i);
  return {
    title: decodeEnt(metaContent(head, ["og:title", "twitter:title"]) || (t ? t[1].trim() : "")).slice(0, 300),
    description: decodeEnt(metaContent(head, ["og:description", "twitter:description", "description"])).slice(0, 500),
    image: abs(metaContent(head, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"])),
    site: decodeEnt(metaContent(head, ["og:site_name"])).slice(0, 100),
  };
}
async function linkPreview(env, u) {
  let url; try { url = new URL(u); } catch (e) { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  // YouTube v EU přesměruje na souhlas s cookies, náhled videa je ale na pevné adrese.
  const yt = /(?:^|\.)youtube\.com$/.test(url.hostname) ? url.searchParams.get("v") || (url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/) || [])[1] : url.hostname === "youtu.be" ? url.pathname.slice(1) : "";
  if (yt && /^[\w-]{6,}$/.test(yt)) return { title: "", description: "", image: "https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg", site: "YouTube" };
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url.href));
  const key = "pv:" + [...new Uint8Array(dig)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hit = await env.KV.get(key); if (hit) return JSON.parse(hit);
  let out = { title: "", description: "", image: "", site: "" };
  try {
    const r = await fetch(url.href, { redirect: "follow", signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 (compatible; RozcestnikBot/1.0)", accept: "text/html" } });
    if (r.ok && /html/i.test(r.headers.get("content-type") || "")) {
      // Stačí začátek stránky, meta značky jsou v hlavičce.
      const rd = r.body.getReader(), dec = new TextDecoder(); let html = "";
      while (html.length < 300000) { const { done, value } = await rd.read(); if (done) break; html += dec.decode(value, { stream: true }); if (/<\/head>/i.test(html)) break; }
      try { rd.cancel(); } catch (e) {}
      out = parsePreview(html, r.url || url.href);
    }
  } catch (e) {}
  await env.KV.put(key, JSON.stringify(out), { expirationTtl: 7 * 86400 });
  return out;
}
async function delImg(env, id) { if (env.BOOKS) await env.BOOKS.delete("img/" + id); await env.KV.delete("img:" + id); }

// ---- duplicity: tentýž odkaz zapsaný jinak (www, http, utm_…, # nebo lomítko na konci) ----
// Stejná funkce je i ve stránce (dupKey v index.html), test hlídá, že dávají totéž.
const TRACK_RE = /^(utm_|fbclid$|gclid$|dclid$|mc_cid$|mc_eid$|igshid$|si$|spm$|_hs)/i;
function dupKey(u) {
  let x; try { x = new URL(/^[a-z]+:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "https://" + String(u || "").trim()); } catch (e) { return ""; }
  if (!/^https?:$/.test(x.protocol) || !x.hostname.includes(".")) return "";
  let h = x.hostname.toLowerCase().replace(/^(www|m)\./, ""), p = x.pathname.replace(/\/+$/, "");
  if (h === "youtu.be" && p.length > 1) { x.searchParams.set("v", p.slice(1)); h = "youtube.com"; p = "/watch"; }
  const yt = h === "youtube.com", q = [...x.searchParams].filter(([k]) => !TRACK_RE.test(k) && !(yt && /^(t|feature|pp|ab_channel|list|index)$/.test(k))).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return h + p + (q.length ? "?" + new URLSearchParams(q).toString() : "");
}

// ---- uložené články: text stránky zůstane, i když web zmizí nebo článek smažou ----
// Celý text je v art:<klíč>. Pro hledání je v jednom klíči artidx výtah: různá slova
// celého článku bez diakritiky (do ART_SNIP znaků), takže se najde i slovo z konce
// článku a stránka si celý výtah stáhne jednou, až začneš hledat. Když se stránka
// stáhnout nedá, zapíše se to taky (f), ať to cron nezkouší pořád; po 30 dnech znovu.
const ART_MAX = 200000, ART_SNIP = 6000;
function artWords(t) {
  const seen = new Set(), out = []; let n = 0;
  for (const x of normText(t).split(/[^\p{L}\p{N}]+/u)) { if (x.length < 3 || seen.has(x)) continue; seen.add(x); out.push(x); n += x.length + 1; if (n > ART_SNIP) break; }
  return out.join(" ");
}
async function artKey(u) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dupKey(u) || u));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function extractArticle(html) {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const body = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|template|button)\b[\s\S]*?<\/\1>/gi, " ");
  const pick = (tag) => { const m = body.match(new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*)<\\/" + tag + ">", "i")); return m ? m[1] : ""; };
  let core = pick("article"); if (stripHtml(core).length < 400) core = pick("main"); if (stripHtml(core).length < 400) core = pick("body") || body;
  const text = decodeEnt(core.replace(/<(br|\/p|\/h[1-6]|\/li|\/div|\/tr|\/blockquote|\/section|\/pre)\b[^>]*>/gi, "\n").replace(/<li\b[^>]*>/gi, "• ").replace(/<[^>]+>/g, " "))
    .split("\n").map((s) => s.replace(/[ \t\u00a0]+/g, " ").trim()).filter(Boolean).join("\n");
  return { title: decodeEnt((t ? t[1] : "").replace(/\s+/g, " ").trim()).slice(0, 300), text: text.slice(0, ART_MAX) };
}
async function getArtIdx(env) { const r = await env.KV.get("artidx"); return r ? JSON.parse(r) : {}; }
async function fetchArticleHtml(u) {
  try {
    const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "user-agent": "Mozilla/5.0 (compatible; RozcestnikBot/1.0)", accept: "text/html" } });
    if (!r.ok || !/html|text\/plain/i.test(r.headers.get("content-type") || "")) return null;
    const rd = r.body.getReader(), dec = new TextDecoder(); let html = "";
    while (html.length < 3000000) { const { done, value } = await rd.read(); if (done) break; html += dec.decode(value, { stream: true }); }
    try { rd.cancel(); } catch (e) {}
    return html;
  } catch (e) { return null; }
}
// idx předaný zvenku si volající uloží sám (cron jich ukládá víc najednou)
async function saveArticle(env, u, idx) {
  const own = !idx; idx = idx || (await getArtIdx(env));
  const k = await artKey(u), html = await fetchArticleHtml(u);
  let rec = null;
  if (html) { const a = extractArticle(html); if (a.text.length >= 200) rec = { u, title: a.title, text: a.text, saved: Date.now() }; }
  if (rec) {
    const seal = await sealer(env), words = artWords(rec.title + " " + rec.text), out = { ...rec };
    await sealFields(seal, out, ["title", "text"]);
    await env.KV.put("art:" + k, JSON.stringify(out));
    idx[k] = { u, s: seal ? await seal(words) : words, t: rec.saved };
    rec = out;
  }
  else idx[k] = { u, f: Date.now() };
  if (own) await env.KV.put("artidx", JSON.stringify(idx));
  return rec;
}
const artable = (u) => /^https?:\/\//i.test(u || "") && !/\/api\/img\//.test(u);
// Cron doplňuje články k odkazům v oblastech, po pár kusech, kvůli limitu stažení na běh.
async function artBackfill(env, board, max) {
  const idx = await getArtIdx(env); let n = 0;
  for (const a of board.areas || []) {
    if (a.type === "text") continue;
    for (const l of a.links || []) {
      if (n >= max) break;
      if (!artable(l.url)) continue;
      const e = idx[await artKey(l.url)];
      if (e && (!e.f || Date.now() - e.f < 30 * DAY)) continue;
      n++; await saveArticle(env, l.url, idx);
    }
  }
  if (n) await env.KV.put("artidx", JSON.stringify(idx));
  return n;
}
// Články k odkazům, které už nikde nejsou (ani v Koši), se jednou denně smažou.
async function gcArticles(env, board, inbox) {
  const idx = await getArtIdx(env), live = new Set();
  const add = (u) => { if (u) live.add(dupKey(u) || u); };
  for (const a of board.areas || []) for (const l of a.links || []) add(l.url);
  for (const i of inbox || []) add(i.url);
  for (const t of board.trash || []) { const it = t.payload && t.payload.item; if (it) add(it.url); }
  let n = 0;
  for (const k of Object.keys(idx)) { if (n >= 25) break; if (!live.has(dupKey(idx[k].u) || idx[k].u)) { await env.KV.delete("art:" + k); delete idx[k]; n++; } }
  if (n) await env.KV.put("artidx", JSON.stringify(idx));
  return n;
}

// ---- záloha: celá deska, Ke zpracování a obrázky v jednom souboru JSON ----
function b64(buf) { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
async function exportAll(env) {
  const board = await getBoard(env), inbox = await getInbox(env), images = {}, imagesEnc = {};
  const ids = new Set((JSON.stringify(board) + JSON.stringify(inbox)).match(/\/api\/img\/[a-z0-9-]{4,40}/gi) || []);
  // se šifrováním jsou odkazy v textu zašifrované, seznam drží stránka v meta.imgRefs
  const all = [...ids].map((s) => s.slice(9)).concat(inbox.filter((i) => i && i.img).map((i) => i.img), (board.meta && board.meta.imgRefs) || []);
  for (const id of new Set(all)) {
    const img = await getImg(env, id); if (!img) continue;
    const buf = img.body instanceof ArrayBuffer ? img.body : await new Response(img.body).arrayBuffer();
    if (img.e) imagesEnc[id] = { type: img.type, d: b64(buf) }; else images[id] = "data:" + img.type + ";base64," + b64(buf);
  }
  // Cyklus jde do zálohy jen zašifrovaný (bez hesla k cyklu je k ničemu).
  const ce = await env.KV.get("cycle_enc");
  const au = await getAuth(env);
  return { app: "rozcestnik", v: 1, exportedAt: Date.now(), board, inbox, images, imagesEnc, ...(ce ? { cycleEnc: JSON.parse(ce) } : {}), ...(au && au.kid ? { kid: au.kid } : {}) };
}

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
// Bezplatný Cloudflare dovolí jen 50 stažení na jeden běh, takže se kontroluje po
// dávkách: nejdřív odkazy, které se nekontrolovaly nejdéle. Vrací, kolik jich
// zkontrolovaných dřív než "since" ještě zbývá.
async function checkBoard(board, max, since) {
  const all = [];
  for (const a of board.areas) { if (a.type === "text") continue; for (const l of a.links) if (artable(l.url)) all.push(l); }
  const due = all.filter((l) => (l.lastChecked || 0) < since).sort((x, y) => (x.lastChecked || 0) - (y.lastChecked || 0));
  const todo = due.slice(0, max);
  for (const l of todo) { const r = await checkOne(l.url); l.status = r.status; l.code = r.code; l.lastChecked = Date.now(); }
  const left = due.length - todo.length;
  if (!left) { board.meta = board.meta || {}; board.meta.lastCheckedAll = Date.now(); }
  return left;
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

async function notifyHit(w, hit, env, to, quiet) {
  const origin = (await env.KV.get("app_origin")) || "";
  if (quiet) {
    const msg = "Hlidac nasel shodu." + (origin ? "\n" + origin : "");
    if (env.NTFY_TOPIC) { try { await fetch("https://ntfy.sh/" + env.NTFY_TOPIC, { method: "POST", headers: { Title: "Rozcestnik" }, body: msg }); } catch (e) {} }
    await sendEmail(env, to, "Rozcestnik: Hlidac nasel shodu", msg);
    return;
  }
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
      const seal = await sealer(env);
      // Se šifrováním jde ven (ntfy, e-mail) jen obecná zpráva bez obsahu.
      await notifyHit(w, rec, env, s.watchEmail || "", !!seal);
      await sealFields(seal, rec, ["name", "snippet"]);
      board.watchHits.unshift(rec);
      found++;
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
    // 3) kontrola odkazů jede po dávkách v hodinovém cronu (checkBoard)
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
// Co je právě sdílené (oblasti, bloky, úkoly): stránka to nešifruje, ať to příjemce přečte.
async function sharedScope(env) {
  const out = { areas: [], blocks: [], tasks: false };
  for (const s of await getShareIndex(env)) {
    const rec = await getShare(env, s.token);
    if (!rec || shareExpired(rec)) continue;
    out.areas.push(...(rec.areas || [])); out.blocks.push(...(rec.blocks || [])); if (rec.includeTasks) out.tasks = true;
  }
  return out;
}
async function getShareIndex(env) { const r = await env.KV.get("shares_index"); return r ? JSON.parse(r) : []; }
// Cyklus: KV cycle_enc = { salt, iter, iv, ct, hint }; AES-GCM, klíč z hesla k cyklu vzniká jen ve stránce.
// Starý nešifrovaný klíč "cycle" se smaže při prvním uložení šifrovaného.
function cycleRecOk(b) {
  return HEX32.test(b.salt || "") && Number.isInteger(b.iter) && b.iter >= 100000 && b.iter <= 5000000
    && /^[a-f0-9]{24}$/.test(b.iv || "") && typeof b.ct === "string" && b.ct.length > 0 && b.ct.length <= 400000 && /^[A-Za-z0-9+/=]+$/.test(b.ct);
}
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

// ---- Zámek appky: heslo a sezení (důvěryhodné / cizí zařízení) ----
// Heslo server nikdy nedostane: stránka z něj PBKDF2 vyrobí 512 bitů, první polovinu pošle
// jako přihlašovací klíč a druhá zůstane ve stránce na šifrování. Server ukládá jen SHA-256
// přihlašovacího klíče. Dokud heslo není nastavené, appka je otevřená jako dřív.
const FOREIGN_IDLE = 20 * 60000, TRUSTED_TTL = 365 * DAY, AUTH_FAILS = 10, AUTH_BLOCK = 15 * 60000;
const HEX64 = /^[a-f0-9]{64}$/, HEX32 = /^[a-f0-9]{32}$/;
async function sha256hex(s) { return bufToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
async function getAuth(env) { const r = await env.KV.get("auth"); return r ? JSON.parse(r) : null; }
const putAuth = (env, a) => env.KV.put("auth", JSON.stringify(a));
const sessTtl = (k) => Math.round((k === "f" ? FOREIGN_IDLE : TRUSTED_TTL) / 1000);
function cookieTok(request) { const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)rz_s=([a-f0-9]{64})/); return m ? m[1] : ""; }
function sessCookie(url, tok, kind) {
  const base = "rz_s=" + tok + "; Path=/; HttpOnly; SameSite=Lax" + (url.protocol === "https:" ? "; Secure" : "");
  if (!tok) return base + "; Max-Age=0";
  return kind === "t" ? base + "; Max-Age=" + sessTtl("t") : base; // cizí zařízení: cookie zmizí se zavřením prohlížeče
}
async function newSession(env, kind) {
  const tok = bufToHex(crypto.getRandomValues(new Uint8Array(32))), now = Date.now();
  await env.KV.put("sess:" + await sha256hex(tok), JSON.stringify({ k: kind, c: now, s: now }), { expirationTtl: sessTtl(kind) });
  return tok;
}
// Platné sezení, nebo null. Prodlužuje se nejvýš jednou za minutu (cizí) / týden (důvěryhodné),
// aby se nepálily zápisy do KV (bezplatný plán jich má 1000 denně).
async function getSession(request, env, auth) {
  const tok = cookieTok(request); if (!tok) return null;
  const key = "sess:" + await sha256hex(tok), r = await env.KV.get(key); if (!r) return null;
  const s = JSON.parse(r), now = Date.now();
  if (s.c < (auth.since || 0) || (s.k === "f" && now - s.s > FOREIGN_IDLE)) { await env.KV.delete(key); return null; }
  if (now - s.s > (s.k === "f" ? 60000 : 7 * DAY)) { s.s = now; await env.KV.put(key, JSON.stringify(s), { expirationTtl: sessTtl(s.k) }); }
  return { ...s, key, tok };
}
async function dropSessions(env) {
  const l = await env.KV.list({ prefix: "sess:", limit: 1000 });
  await Promise.all(l.keys.map((k) => env.KV.delete(k.name)));
}
// Hrubá síla: po 10 špatných pokusech 15 minut nic.
async function authBlocked(env) { const r = await env.KV.get("authfail"); const f = r ? JSON.parse(r) : null; return !!(f && f.until > Date.now()); }
async function authFail(env) {
  const r = await env.KV.get("authfail"), f = r ? JSON.parse(r) : { n: 0 };
  f.n = (f.n || 0) + 1; if (f.n >= AUTH_FAILS) { f.n = 0; f.until = Date.now() + AUTH_BLOCK; }
  await env.KV.put("authfail", JSON.stringify(f), { expirationTtl: 86400 });
}
async function keyOk(key, hash) { return HEX64.test(key || "") && timingSafeEqual(await sha256hex(key), hash || ""); }
function cleanHint(h) { return String(h || "").trim().slice(0, 120); }
function validCreds(b) { return HEX64.test(b.key || "") && HEX32.test(b.salt || "") && Number.isInteger(b.iter) && b.iter >= 100000 && b.iter <= 5000000; }
// ---- Šifrování obsahu (krok 3) ----
// Stránka šifruje obsah datovým klíčem (tokeny enc1.…), který server nikdy nedostane:
// v auth leží jen zabalený heslem (wdk) a záchranným kódem (rwdk). Server má veřejný
// klíč (pub, ECDH P-256) a obsah, který vyrobí sám (věci z telefonu, text stránek,
// nálezy hlídače), jím zamkne do tokenu pk1.<efemérní klíč>.<iv>.<šifra>. Odemknout
// ho umí jen stránka soukromým klíčem (wpriv, zabalený datovým klíčem).
const B64U = /^[A-Za-z0-9_-]+$/, TOKEN_RE = /^(?:enc1|pk1)\./;
const b64u = (u8) => b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function wrapOk(w) { return !!w && typeof w === "object" && B64U.test(w.iv || "") && B64U.test(w.ct || "") && w.ct.length <= 20000; }
function keysOk(b) {
  return /^[a-f0-9]{16}$/.test(b.kid || "") && wrapOk(b.wdk) && wrapOk(b.wpriv) && !!b.pub && b.pub.kty === "EC" && b.pub.crv === "P-256" && B64U.test(b.pub.x || "") && B64U.test(b.pub.y || "");
}
const keyFields = (b) => ({ kid: b.kid, pub: { kty: "EC", crv: "P-256", x: b.pub.x, y: b.pub.y }, wdk: { iv: b.wdk.iv, ct: b.wdk.ct }, wpriv: { iv: b.wpriv.iv, ct: b.wpriv.ct } });
// Zamykač veřejným klíčem: vrátí funkci, která řetězec zamkne (už zamčený nechá být).
// Bez zapnutého šifrování vrací řetězec beze změny.
async function sealer(env) {
  const a = await getAuth(env);
  if (!a || !a.pub) return null;
  const pub = await crypto.subtle.importKey("jwk", { ...a.pub, ext: true }, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const core = async (data) => {
    const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const epk = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256));
    const raw = await crypto.subtle.digest("SHA-256", new Uint8Array([...shared, ...epk]));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return { epk, iv, ct: new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)) };
  };
  const seal = async (s) => {
    if (typeof s !== "string" || !s || TOKEN_RE.test(s)) return s;
    const { epk, iv, ct } = await core(new TextEncoder().encode(s));
    return "pk1." + b64u(epk) + "." + b64u(iv) + "." + b64u(ct);
  };
  // Obrázek: bajty = efemérní klíč (65) + iv (12) + šifra.
  seal.bytes = async (u8) => { const { epk, iv, ct } = await core(u8); const out = new Uint8Array(77 + ct.length); out.set(epk); out.set(iv, 65); out.set(ct, 77); return out; };
  return seal;
}
async function sealFields(seal, o, keys) { if (seal && o) for (const k of keys) if (typeof o[k] === "string" && o[k]) o[k] = await seal(o[k]); return o; }
// Po zapnutí šifrování zamkne už uložené články a výtah pro hledání (po dávkách).
async function sealArticles(env, max) {
  const seal = await sealer(env); if (!seal) return 0;
  const idx = await getArtIdx(env); let n = 0, left = 0;
  for (const [k, e] of Object.entries(idx)) {
    if (!e.s || TOKEN_RE.test(e.s)) continue;
    if (n >= max) { left++; continue; }
    const r = await env.KV.get("art:" + k);
    if (r) { const rec = JSON.parse(r); await sealFields(seal, rec, ["title", "text"]); await env.KV.put("art:" + k, JSON.stringify(rec)); }
    e.s = await seal(e.s); n++;
  }
  if (n) await env.KV.put("artidx", JSON.stringify(idx));
  return left;
}
// API, které jde i bez přihlášení: zámek sám, sdílení (má vlastní token), zápis z telefonu
// a rozšíření (jen přidává, nic nevrací), kurzy a obrázky (id je náhodné UUID, potřebuje je sdílení).
function apiPublic(path, method) {
  return path.startsWith("/api/auth/") || path === "/api/cal/callback" || path === "/api/share/view" || path === "/api/share/edit"
    || path === "/api/capture" || path === "/api/fx" || (path.startsWith("/api/img/") && method === "GET");
}
async function authRoute(request, env, url, path, auth) {
  const m = request.method, b = m === "POST" ? await request.json().catch(() => ({})) : {};
  const kind = b.kind === "f" ? "f" : "t";
  const withSess = async (body, k) => { const tok = await newSession(env, k); return json(body, 200, { "set-cookie": sessCookie(url, tok, k) }); };
  if (path === "/api/auth/status") {
    if (!auth) return json({ set: false });
    const s = await getSession(request, env, auth);
    const out = { set: true, ok: !!s, kind: s ? s.k : null, salt: auth.salt, iter: auth.iter, hint: auth.hint || "", kid: auth.kid || null };
    // zabalené klíče jen přihlášenému; bez hesla jsou k ničemu, ale nemusí se rozdávat
    if (s && auth.kid) out.keys = { kid: auth.kid, pub: auth.pub, wdk: auth.wdk, wpriv: auth.wpriv };
    return s && s.k === "t" ? json(out, 200, { "set-cookie": sessCookie(url, s.tok, "t") }) : json(out);
  }
  if (m !== "POST") return json({ error: "not found" }, 404);
  if (path === "/api/auth/setup") {
    if (auth) return json({ error: "already" }, 409);
    if (!validCreds(b) || !HEX64.test(b.rkey || "") || !HEX32.test(b.rsalt || "")) return json({ error: "bad" }, 400);
    const now = Date.now();
    const a = { v: 1, salt: b.salt, iter: b.iter, h: await sha256hex(b.key), rsalt: b.rsalt, rh: await sha256hex(b.rkey), hint: cleanHint(b.hint), since: now, created: now };
    if (keysOk(b) && wrapOk(b.rwdk)) Object.assign(a, keyFields(b), { rwdk: { iv: b.rwdk.iv, ct: b.rwdk.ct } });
    await putAuth(env, a);
    return withSess({ ok: true }, kind);
  }
  if (!auth) return json({ error: "noauth" }, 400);
  if (path === "/api/auth/logout") {
    const s = await getSession(request, env, auth); if (s) await env.KV.delete(s.key);
    return json({ ok: true }, 200, { "set-cookie": sessCookie(url, "", "t") });
  }
  if (path === "/api/auth/recover-salt") return json({ rsalt: auth.rsalt, iter: auth.iter });
  if (await authBlocked(env)) return json({ error: "blocked" }, 429);
  if (path === "/api/auth/login") {
    if (!(await keyOk(b.key, auth.h))) { await authFail(env); return json({ error: "wrong" }, 403); }
    return withSess({ ok: true }, kind);
  }
  // Záchranný kód: nejdřív vydá datový klíč zabalený kódem (stránka ho přebalí novým heslem),
  // pak nové heslo a všechna ostatní zařízení se odhlásí.
  if (path === "/api/auth/recover-keys") {
    if (!(await keyOk(b.rkey, auth.rh))) { await authFail(env); return json({ error: "wrong" }, 403); }
    return json(auth.kid ? { kid: auth.kid, rwdk: auth.rwdk } : {});
  }
  if (path === "/api/auth/recover") {
    if (!(await keyOk(b.rkey, auth.rh))) { await authFail(env); return json({ error: "wrong" }, 403); }
    if (!validCreds(b) || (auth.kid && !wrapOk(b.wdk))) return json({ error: "bad" }, 400);
    Object.assign(auth, { salt: b.salt, iter: b.iter, h: await sha256hex(b.key), since: Date.now() });
    if (auth.kid) auth.wdk = { iv: b.wdk.iv, ct: b.wdk.ct };
    if ("hint" in b) auth.hint = cleanHint(b.hint);
    await putAuth(env, auth); await dropSessions(env);
    return withSess({ ok: true }, kind);
  }
  const s = await getSession(request, env, auth);
  if (!s) return json({ error: "auth" }, 401, { "x-rz-lock": "1" });
  if (path === "/api/auth/logout-all") {
    auth.since = Date.now(); await putAuth(env, auth); await dropSessions(env);
    return withSess({ ok: true }, s.k);
  }
  // Změna hesla a nový záchranný kód chtějí i současné heslo.
  if (!(await keyOk(b.old, auth.h))) { await authFail(env); return json({ error: "wrong" }, 403); }
  // Se šifrováním musí přijít i datový klíč přebalený novým heslem / kódem, jinak by se ztratil.
  if (path === "/api/auth/change") {
    if (!validCreds(b) || (auth.kid && !wrapOk(b.wdk))) return json({ error: "bad" }, 400);
    Object.assign(auth, { salt: b.salt, iter: b.iter, h: await sha256hex(b.key), hint: cleanHint(b.hint) });
    if (auth.kid) auth.wdk = { iv: b.wdk.iv, ct: b.wdk.ct };
    await putAuth(env, auth); return json({ ok: true });
  }
  if (path === "/api/auth/recovery-new") {
    if (!HEX64.test(b.rkey || "") || !HEX32.test(b.rsalt || "") || (auth.kid && !wrapOk(b.rwdk))) return json({ error: "bad" }, 400);
    Object.assign(auth, { rsalt: b.rsalt, rh: await sha256hex(b.rkey) });
    if (auth.kid) auth.rwdk = { iv: b.rwdk.iv, ct: b.rwdk.ct };
    await putAuth(env, auth); return json({ ok: true });
  }
  // Zapnutí šifrování u appky, která už heslo má: klíče + nový záchranný kód (starý kód
  // datový klíč neumí odemknout). Staré čitelné kopie z obnovy se smažou.
  if (path === "/api/auth/keys") {
    if (auth.kid) return json({ error: "already" }, 409);
    if (!keysOk(b) || !wrapOk(b.rwdk) || !HEX64.test(b.rkey || "") || !HEX32.test(b.rsalt || "")) return json({ error: "bad" }, 400);
    Object.assign(auth, keyFields(b), { rwdk: { iv: b.rwdk.iv, ct: b.rwdk.ct }, rsalt: b.rsalt, rh: await sha256hex(b.rkey) });
    await putAuth(env, auth);
    await Promise.all(["board_prev", "inbox_prev"].map((k) => env.KV.delete(k)));
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname;
    if (path.startsWith("/api/")) {
      const auth = await getAuth(env);
      if (path.startsWith("/api/auth/")) return authRoute(request, env, url, path, auth);
      if (auth && !apiPublic(path, request.method) && !(await getSession(request, env, auth))) return json({ error: "auth" }, 401, { "x-rz-lock": "1" });
    }

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
      if (path.startsWith("/api/img/")) {
        const id = path.slice("/api/img/".length);
        if (!/^[a-z0-9-]{4,40}$/i.test(id)) return new Response("nenalezeno", { status: 404 });
        if (request.method === "DELETE") { await delImg(env, id); return json({ ok: true }); }
        // Čitelná kopie pro sdílení: stránka obrázek odemkne a nahraje ho sem (jen přihlášená).
        if (request.method === "PUT") {
          // x-rz-enc: 1 = stránka obrázek už zamkla (vlastní fotka do záhlaví), type je typ uvnitř
          const type = (request.headers.get("content-type") || "").split(";")[0], sealed = request.headers.get("x-rz-enc") === "1";
          const bytes = new Uint8Array(await request.arrayBuffer());
          if (!/^image\/(webp|jpeg|png|gif)$/.test(type) || !bytes.length || bytes.length > IMG_MAX + (sealed ? 200 : 0)) return json({ error: "bad-image" }, 400);
          await putImg(env, id, { type, bytes, ...(sealed ? { e: 1 } : {}) });
          return json({ ok: true });
        }
        const img = await getImg(env, id);
        if (!img) return new Response("nenalezeno", { status: 404 });
        // Zamčený obrázek: prohlížeč ho jako obrázek neukáže, stránka ho odemkne (x-rz-type = co je uvnitř).
        if (img.e) return new Response(img.body, { headers: { "content-type": "application/octet-stream", "x-rz-enc": "1", "x-rz-type": img.type, "cache-control": "private, max-age=31536000, immutable" } });
        return new Response(img.body, { headers: { "content-type": img.type, "cache-control": "private, max-age=31536000, immutable" } });
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
            return json({ ...resolveShare(await getBoard(env), rec), images: !!rec.images });
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
            const rec = { token: rid() + rid().slice(0, 8), label: (b.label || "").slice(0, 80), areas, blocks, includeTasks, images: !!b.images, mode, access, createdAt: Date.now(), expiresAt: expFrom(b), notify: !!b.notify, notifyAheadH: Number(b.notifyAheadH) || 48, lastNotifiedFor: 0 };
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
          await Promise.all(["board", "inbox", "shares_index", "app_origin", "gcal_state", "artidx", "board_prev", "inbox_prev"].map((k) => env.KV.delete(k)));
          // uložené články (art:<klíč>) jsou taky obsah desky
          const arts = await env.KV.list({ prefix: "art:", limit: 1000 });
          await Promise.all(arts.keys.map((k) => env.KV.delete(k.name)));
          await Promise.all(["cycle", "cycle_enc"].map((k) => env.KV.delete(k)));
          if (pinOk(request, env)) await env.KV.delete("gcal");
          return json({ ok: true });
        }
        // ---- Cyklus: jen zašifrovaný blok, klíč z hesla k cyklu zná jen stránka ----
        if (path === "/api/cycle/blob") {
          if (request.method === "GET") {
            const e = await env.KV.get("cycle_enc");
            // Starý nešifrovaný cyklus vydá jen přihlášenému (zámek) nebo s PINem, aby ho stránka zašifrovala.
            const old = (await getAuth(env)) || pinOk(request, env) ? await env.KV.get("cycle") : null;
            return json({ enc: e ? JSON.parse(e) : null, legacy: old ? (JSON.parse(old).periods || []) : null });
          }
          if (request.method === "PUT") {
            const b = await request.json().catch(() => ({}));
            if (!cycleRecOk(b)) return json({ error: "bad" }, 400);
            await env.KV.put("cycle_enc", JSON.stringify({ v: 1, salt: b.salt, iter: b.iter, iv: b.iv, ct: b.ct, hint: cleanHint(b.hint), updatedAt: Date.now() }));
            await env.KV.delete("cycle");
            return json({ ok: true });
          }
          if (request.method === "DELETE") { await Promise.all(["cycle_enc", "cycle"].map((k) => env.KV.delete(k))); return json({ ok: true }); }
        }
        if (path === "/api/favicon" && request.method === "GET") {
          const f = await favicon(env, url.searchParams.get("d"));
          if (!f) return new Response("", { status: 404, headers: { "cache-control": "private, max-age=86400" } });
          // SVG ikonka by otevřená napřímo mohla spustit skript: sandbox a nosniff to zarazí
          return new Response(f.body, { headers: { "content-type": f.type, "cache-control": "private, max-age=604800", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
        }
        if (path === "/api/preview" && request.method === "GET") {
          const p = await linkPreview(env, url.searchParams.get("url") || "");
          return p ? json(p) : json({ error: "bad-url" }, 400);
        }
        if (path === "/api/fx" && request.method === "GET") {
          const fx = await getFx(env);
          return fx ? json(fx) : json({ error: "fx-unavailable" }, 502);
        }
        if (path === "/api/capture" && request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          const text = (b.text || "").trim(), link = (b.url || "").trim(), note = (b.note || "").trim().slice(0, 2000);
          const id = rid(), item = { id, type: b.type || (link ? "link" : "point"), text, url: link, created: Date.now() };
          if (note) item.note = note;
          if (b.imageSealed) {
            // stránka obrázek zamkla sama, server ho čitelně vůbec neviděl
            const type = String(b.imageType || ""), bin = /^[A-Za-z0-9+/=]+$/.test(b.imageSealed) ? atob(b.imageSealed) : "";
            if (!/^image\/(webp|jpeg|png|gif)$/.test(type) || bin.length < 78 || bin.length > IMG_MAX + 200) return json({ error: "bad-image" }, 400);
            await putImg(env, id, { type, bytes: Uint8Array.from(bin, (c) => c.charCodeAt(0)), e: 1 });
            item.type = "image"; item.img = id;
          } else if (b.image) {
            const img = parseDataUrl(b.image);
            if (!img) return json({ error: "bad-image" }, 400);
            await putImgSealed(env, id, img);
            item.type = "image"; item.img = id;
          } else if (!text && !link) return json({ error: "empty" }, 400);
          if (b.src) item.src = String(b.src).slice(0, 2000);
          await sealFields(await sealer(env), item, ["text", "note", "src"]);
          const inbox = await getInbox(env);
          inbox.unshift(item);
          await putInbox(env, inbox);
          if (!item.img && artable(link) && ctx) ctx.waitUntil(saveArticle(env, link).catch(() => {}));
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
          return json({ board, inbox: await getInbox(env), r2: !!env.BOOKS, shared: await sharedScope(env) });
        }
        if (path === "/api/state" && request.method === "PUT") {
          const b = await request.json();
          if (b.board) await putBoard(env, b.board);
          if (Array.isArray(b.inbox)) {
            // Položky, které mezitím přišly přes /api/capture a klient je ještě nezná, zůstanou.
            let inbox = b.inbox;
            if (Array.isArray(b.inboxKnown)) {
              const known = new Set(b.inboxKnown);
              inbox = (await getInbox(env)).filter((i) => i && !known.has(i.id)).concat(inbox);
            }
            await putInbox(env, inbox);
          }
          return json({ ok: true });
        }
        if (path === "/api/check" && request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          const board = await getBoard(env), left = await checkBoard(board, 40, Number(b.since) || Date.now()); await putBoard(env, board);
          return json({ board, left });
        }
        if (path === "/api/e2e/seal-images" && request.method === "POST") return json({ left: await sealImages(env, 10) });
        if (path === "/api/e2e/seal-articles" && request.method === "POST") return json({ left: await sealArticles(env, 40) });
        if (path === "/api/articles" && request.method === "GET") {
          const idx = await getArtIdx(env);
          return json({ items: Object.values(idx).filter((e) => e.s).map((e) => ({ u: e.u, s: e.s })) });
        }
        if (path === "/api/article" && request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          if (!artable(b.url)) return json({ error: "bad-url" }, 400);
          const k = await artKey(b.url), hit = !b.refresh && (await env.KV.get("art:" + k));
          if (hit) return json(JSON.parse(hit));
          const rec = await saveArticle(env, b.url);
          return rec ? json(rec) : json({ error: "nothing" }, 404);
        }
        if (path === "/api/export" && request.method === "GET") {
          const day = new Date().toISOString().slice(0, 10);
          return new Response(JSON.stringify(await exportAll(env)), { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="rozcestnik-' + day + '.json"' } });
        }
        if (path === "/api/restore" && request.method === "POST") {
          const b = await request.json().catch(() => null);
          if (!b || b.app !== "rozcestnik" || !b.board || !Array.isArray(b.board.areas)) return json({ error: "not-backup" }, 400);
          // Co bylo před obnovou, zůstane 30 dní v KV (board_prev, inbox_prev).
          const ttl = { expirationTtl: 30 * 86400 };
          await env.KV.put("board_prev", JSON.stringify(await getBoard(env)), ttl);
          await env.KV.put("inbox_prev", JSON.stringify(await getInbox(env)), ttl);
          let imgs = 0;
          for (const [id, d] of Object.entries(b.images || {})) { if (!/^[a-z0-9-]{4,40}$/i.test(id)) continue; const img = parseDataUrl(d); if (img) { await putImg(env, id, img); imgs++; } }
          for (const [id, x] of Object.entries(b.imagesEnc || {})) {
            if (!/^[a-z0-9-]{4,40}$/i.test(id) || !x || !/^image\/(webp|jpeg|png|gif)$/.test(x.type || "")) continue;
            try { await putImg(env, id, { type: x.type, bytes: Uint8Array.from(atob(x.d), (c) => c.charCodeAt(0)), e: 1 }); imgs++; } catch (e) {}
          }
          await putBoard(env, b.board);
          await putInbox(env, Array.isArray(b.inbox) ? b.inbox : []);
          if (b.cycleEnc && cycleRecOk(b.cycleEnc)) { const c = b.cycleEnc; await env.KV.put("cycle_enc", JSON.stringify({ v: 1, salt: c.salt, iter: c.iter, iv: c.iv, ct: c.ct, hint: cleanHint(c.hint), updatedAt: Date.now() })); }
          return json({ ok: true, images: imgs });
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
      const s = board.settings || (board.settings = {}), today = Math.floor(Date.now() / DAY);
      if (s.lastImgGc !== today) { try { const ib = await getInbox(env); await gcImages(env, board, ib); await gcArticles(env, board, ib); s.lastImgGc = today; } catch (e) {} }
      // Hlídač má až 25 stažení, kontrola odkazů 12 a články 4, aby se běh vešel do limitu 50.
      try { await checkBoard(board, 12, Date.now() - 20 * 3600000); } catch (e) {}
      try { await artBackfill(env, board, 4); } catch (e) {}
      try { await sealArticles(env, 40); } catch (e) {}
      try { await sealImages(env, 5); } catch (e) {}
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
