// Zámek appky: nastavení hesla, přihlášení na důvěryhodném a cizím zařízení, odhlášení
// všech zařízení, záchranný kód, změna hesla, hrubá síla a co zůstává veřejné.
const fs = require("fs");
const src = fs.readFileSync("src/index.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }

const kv = new Map();
const KV = {
  get: async (k) => (kv.has(k) ? kv.get(k) : null),
  getWithMetadata: async (k) => ({ value: kv.has(k) ? kv.get(k) : null }),
  put: async (k, v) => { kv.set(k, v); },
  delete: async (k) => { kv.delete(k); },
  list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
};
const mod = {};
new Function("mod", src.replace("export default {", "mod.worker = {"))(mod);
const env = { KV, ASSETS: { fetch: async () => new Response("") } };
async function call(path, { method = "GET", body, cookie } = {}) {
  const headers = {}; if (cookie) headers.cookie = "rz_s=" + cookie;
  const r = await mod.worker.fetch(new Request("https://r.dev" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = r.headers.get("set-cookie") || "", m = sc.match(/rz_s=([a-f0-9]*)/);
  let json = null; try { json = await r.clone().json(); } catch (e) {}
  return { status: r.status, json, setCookie: sc, tok: m ? m[1] : null, lock: r.headers.get("x-rz-lock") };
}
const k = (c) => c.repeat(64), salt = "a".repeat(32);
const sessOf = (tok) => [...kv.entries()].filter(([n]) => n.startsWith("sess:")).map(([, v]) => JSON.parse(v));

(async () => {
  // bez hesla je appka otevřená jako dřív
  let r = await call("/api/auth/status");
  t("bez hesla: status říká nenastaveno", r.json && r.json.set === false);
  t("bez hesla: data jdou načíst", (await call("/api/state")).status === 200);

  r = await call("/api/auth/setup", { method: "POST", body: { key: k("1"), salt, iter: 600000, rkey: k("2"), rsalt: salt, hint: " kočka ", kind: "t" } });
  t("nastavení: vrátí cookie důvěryhodného zařízení", r.status === 200 && r.tok && /HttpOnly/.test(r.setCookie) && /SameSite=Lax/.test(r.setCookie) && /Secure/.test(r.setCookie) && /Max-Age=31536000/.test(r.setCookie), r.setCookie);
  const trusted = r.tok, a = JSON.parse(kv.get("auth"));
  t("nastavení: server nemá klíč, jen jeho otisk", a.h && a.h !== k("1") && !kv.get("auth").includes(k("1")) && a.hint === "kočka");
  t("nastavení: podruhé nejde", (await call("/api/auth/setup", { method: "POST", body: { key: k("3"), salt, iter: 600000, rkey: k("4"), rsalt: salt } })).status === 409);
  t("nastavení: slabé iterace odmítne", (await (async () => { const s = kv.get("auth"); kv.delete("auth"); const x = await call("/api/auth/setup", { method: "POST", body: { key: k("1"), salt, iter: 1000, rkey: k("2"), rsalt: salt } }); kv.set("auth", s); return x.status; })()) === 400);

  // zamčeno
  r = await call("/api/state");
  t("zamčeno: data bez přihlášení ne a stránka pozná zámek", r.status === 401 && r.lock === "1");
  t("zamčeno: export a mazání taky ne", (await call("/api/export")).status === 401 && (await call("/api/wipe", { method: "POST" })).status === 401 && (await call("/api/img/abcd1234", { method: "DELETE" })).status === 401);
  t("zamčeno: zápis z telefonu a rozšíření jde dál", (await call("/api/capture", { method: "POST", body: { text: "z telefonu" } })).status === 200);
  t("zamčeno: sdílení a obrázky mají vlastní přístup", (await call("/api/share/view?token=x")).status !== 401 && (await call("/api/img/abcd1234")).status === 404);
  r = await call("/api/auth/status");
  t("zamčeno: status dá sůl a nápovědu, ne přihlášení", r.json.set && !r.json.ok && r.json.salt === salt && r.json.iter === 600000 && r.json.hint === "kočka" && !("h" in r.json));
  t("s cookie: data jdou", (await call("/api/state", { cookie: trusted })).status === 200);
  r = await call("/api/auth/status", { cookie: trusted });
  t("s cookie: status ok, důvěryhodné, prodlouží cookie", r.json.ok && r.json.kind === "t" && r.tok === trusted);

  // přihlášení
  t("přihlášení: špatné heslo", (await call("/api/auth/login", { method: "POST", body: { key: k("9") } })).status === 403);
  r = await call("/api/auth/login", { method: "POST", body: { key: k("1"), kind: "f" } });
  t("přihlášení: cizí zařízení dostane cookie bez Max-Age", r.status === 200 && r.tok && !/Max-Age/.test(r.setCookie), r.setCookie);
  const foreign = r.tok;
  t("přihlášení: špatný pokus se započítá", !kv.get("authfail") || JSON.parse(kv.get("authfail")).n === 1);
  kv.delete("authfail");

  // cizí zařízení: 20 minut nečinnosti
  const fk = [...kv.keys()].find((n) => n.startsWith("sess:") && JSON.parse(kv.get(n)).k === "f");
  const fs_ = JSON.parse(kv.get(fk)); fs_.s = Date.now() - 21 * 60000; kv.set(fk, JSON.stringify(fs_));
  t("cizí: po 20 min nečinnosti neplatí a smaže se", (await call("/api/state", { cookie: foreign })).status === 401 && !kv.has(fk));
  r = await call("/api/auth/login", { method: "POST", body: { key: k("1"), kind: "f" } });
  const f2 = r.tok, fk2 = [...kv.keys()].find((n) => n.startsWith("sess:") && JSON.parse(kv.get(n)).k === "f");
  const s2 = JSON.parse(kv.get(fk2)); s2.s = Date.now() - 5 * 60000; kv.set(fk2, JSON.stringify(s2));
  await call("/api/state", { cookie: f2 });
  t("cizí: činnost prodlouží", Date.now() - JSON.parse(kv.get(fk2)).s < 5000);

  // odhlášení
  r = await call("/api/auth/logout", { method: "POST", cookie: f2 });
  t("odhlášení: smaže sezení a cookie", r.status === 200 && /Max-Age=0/.test(r.setCookie) && !kv.has(fk2) && (await call("/api/state", { cookie: f2 })).status === 401);

  // odhlásit ostatní
  const other = (await call("/api/auth/login", { method: "POST", body: { key: k("1") } })).tok;
  t("odhlásit ostatní: bez přihlášení ne", (await call("/api/auth/logout-all", { method: "POST" })).status === 401);
  r = await call("/api/auth/logout-all", { method: "POST", cookie: trusted });
  const mine = r.tok;
  t("odhlásit ostatní: staré cookie neplatí, tohle zařízení dostane nové", r.status === 200 && mine && (await call("/api/state", { cookie: other })).status === 401 && (await call("/api/state", { cookie: trusted })).status === 401 && (await call("/api/state", { cookie: mine })).status === 200);
  t("odhlásit ostatní: zůstalo jen jedno sezení", sessOf().length === 1);

  // změna hesla chce současné heslo
  t("změna: špatné současné heslo", (await call("/api/auth/change", { method: "POST", cookie: mine, body: { old: k("9"), key: k("5"), salt, iter: 600000 } })).status === 403);
  r = await call("/api/auth/change", { method: "POST", cookie: mine, body: { old: k("1"), key: k("5"), salt: "b".repeat(32), iter: 600000, hint: "" } });
  t("změna: nové heslo platí, staré ne, nápověda smazaná", r.status === 200 && (await call("/api/auth/login", { method: "POST", body: { key: k("1") } })).status === 403 && (await call("/api/auth/login", { method: "POST", body: { key: k("5") } })).status === 200 && JSON.parse(kv.get("auth")).hint === "");
  kv.delete("authfail");

  // záchranný kód
  t("záchrana: sůl kódu jde bez přihlášení", (await call("/api/auth/recover-salt", { method: "POST" })).json.rsalt === salt);
  t("záchrana: špatný kód", (await call("/api/auth/recover", { method: "POST", body: { rkey: k("7"), key: k("6"), salt, iter: 600000 } })).status === 403);
  r = await call("/api/auth/recover", { method: "POST", body: { rkey: k("2"), key: k("6"), salt, iter: 600000, kind: "t" } });
  t("záchrana: nové heslo, ostatní odhlášeni", r.status === 200 && r.tok && (await call("/api/state", { cookie: mine })).status === 401 && (await call("/api/auth/login", { method: "POST", body: { key: k("6") } })).status === 200);
  const rec = r.tok;
  r = await call("/api/auth/recovery-new", { method: "POST", cookie: rec, body: { old: k("6"), rkey: k("8"), rsalt: "c".repeat(32) } });
  t("nový kód: starý přestane platit", r.status === 200 && (await call("/api/auth/recover", { method: "POST", body: { rkey: k("2"), key: k("6"), salt, iter: 600000 } })).status === 403);
  kv.delete("authfail");

  // hrubá síla
  for (let i = 0; i < 10; i++) await call("/api/auth/login", { method: "POST", body: { key: k("0") } });
  t("hrubá síla: po 10 pokusech 15 minut stop i pro správné heslo", (await call("/api/auth/login", { method: "POST", body: { key: k("6") } })).status === 429);
  kv.delete("authfail");
  t("nesmysl místo klíče", (await call("/api/auth/login", { method: "POST", body: { key: "x" } })).status === 403);

  // stránka
  t("stránka: heslo se nikam neposílá, jen klíč z PBKDF2", /deriveBits\(\{name:"PBKDF2"/.test(html) && !/body:JSON\.stringify\(\{[^}]*pass[:,]/.test(html));
  t("stránka: start čeká na zámek", /async function start\(\)\{\s*if\(!\(await lkGate\(\)\)\)return;/.test(html));
  t("stránka: zamčené API stránku zamkne", html.includes('r.status===401&&r.headers.get("x-rz-lock")'));
  t("stránka: heslo aspoň 12 znaků", html.includes("p.length<12"));

  console.log("ok=" + ok + " chyb=" + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("  CHYBA výjimka " + e.stack); console.log("ok=" + ok + " chyb=" + (bad + 1)); process.exit(1); });
