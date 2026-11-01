// Cyklus je šifrovaný v prohlížeči (AES-GCM, klíč z vlastního hesla), server má jen šifru.
// Šifrování se ověřuje doopravdy přes WebCrypto v Node, server proti falešnému KV.
// Druhá část: oblasti v mřížce z Pořádku jdou zase roztahovat (po celých sloupcích).
const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");
const src = fs.readFileSync("src/index.js", "utf8");
let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }

// šifrovací funkce ze stránky
const pick = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const pg = {};
new Function("pg", "const lkHex=b=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');" + pick("const cyU8=", "function cyIdb(") + "pg.cyDerive=cyDerive;pg.cySeal=cySeal;pg.cyOpen=cyOpen;")(pg);

const kv = new Map();
const KV = { get: async (k) => (kv.has(k) ? kv.get(k) : null), getWithMetadata: async (k) => ({ value: kv.get(k) || null }), put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) };
const mod = {};
new Function("mod", src.replace("export default {", "mod.worker = {"))(mod);
const env = { KV, ASSETS: { fetch: async () => new Response("") } };
const call = async (path, method, body) => { const r = await mod.worker.fetch(new Request("https://r.dev" + path, { method: method || "GET", body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, json: j }; };

(async () => {
  const salt = "ab".repeat(16), key = await pg.cyDerive("tajne-heslo-cyklu", salt, 100000);
  const periods = [{ id: "p1", start: "2026-10-01", end: "2026-10-05" }];
  const sealed = await pg.cySeal(key, { periods });
  t("šifra neobsahuje data", !sealed.ct.includes("2026") && !Buffer.from(sealed.ct, "base64").toString("latin1").includes("2026") && /^[a-f0-9]{24}$/.test(sealed.iv));
  const back = await pg.cyOpen(key, sealed);
  t("rozšifruje se zpátky", back.periods[0].start === "2026-10-01");
  let wrong = false; try { await pg.cyOpen(await pg.cyDerive("jine-heslo-cyklu", salt, 100000), sealed); } catch (e) { wrong = true; }
  t("špatné heslo neprojde", wrong);

  kv.set("cycle", JSON.stringify({ periods: [{ id: "old", start: "2025-01-01" }] }));
  let r = await call("/api/cycle/blob");
  t("bez zámku a PINu starý nešifrovaný cyklus nevydá", r.status === 200 && r.json.enc === null && r.json.legacy === null);
  kv.set("auth", JSON.stringify({ salt: "a".repeat(32), iter: 600000, h: "x", since: 0 }));
  t("se zámkem bez přihlášení nic", (await call("/api/cycle/blob")).status === 401);
  kv.delete("auth");
  t("odmítne nešifrovaný nesmysl", (await call("/api/cycle/blob", "PUT", { periods })).status === 400);
  r = await call("/api/cycle/blob", "PUT", { salt, iter: 100000, hint: " kočka ", ...sealed });
  const stored = JSON.parse(kv.get("cycle_enc"));
  t("uloží jen šifru a smaže starý nešifrovaný cyklus", r.status === 200 && stored.ct === sealed.ct && stored.hint === "kočka" && !kv.get("cycle_enc").includes("2026-10") && !kv.has("cycle"));
  r = await call("/api/cycle/blob");
  t("vrátí šifru, kterou stránka otevře", (await pg.cyOpen(key, r.json.enc)).periods.length === 1);
  t("staré PIN endpointy jsou pryč", (await call("/api/cycle/get")).status === 404 && (await call("/api/cycle/save", "POST", { periods })).status === 404);
  r = await call("/api/export");
  t("záloha nese cyklus jen zašifrovaný", r.json.cycleEnc && r.json.cycleEnc.ct === sealed.ct && !JSON.stringify(r.json).includes("2026-10-01"));
  kv.delete("cycle_enc");
  await call("/api/restore", "POST", r.json);
  t("obnova vrátí šifrovaný cyklus", JSON.parse(kv.get("cycle_enc")).ct === sealed.ct);
  await call("/api/wipe", "POST");
  t("smazat všechna data smaže i cyklus", !kv.has("cycle_enc") && !kv.has("cycle"));
  kv.set("cycle_enc", "{}"); await call("/api/cycle/blob", "DELETE");
  t("zapomenuté heslo: cyklus jde smazat", !kv.has("cycle_enc"));

  // stránka
  t("heslo k cyklu aspoň 12 znaků", html.includes("if(p1.length<12){cycleState.err=T.short;"));
  t("pamatovat se na cizím zařízení nenabízí", html.includes('function cycRemHtml(){return cyForeign()?"":'));
  t("zapamatovaný klíč je nevyexportovatelný", /deriveKey\(\{name:"PBKDF2"[^\n]*,false,\["encrypt","decrypt"\]\)/.test(html));
  t("Zamknout zapomene klíč i na zařízení", html.includes('act==="cyc-lock"){cycLock();cyIdbDel();'));
  t("odhlášení z appky zapomene klíč k cyklu", html.includes('act==="lk-logout"){await lkPost("/api/auth/logout");await cyIdbDel();'));
  t("zavření panelu cyklus zamkne", /close-panel"\)\{[^\n]*cyclePanel"\)\{cycLock\(\)/.test(html));
  t("kalendář ukazuje cyklus jen z odemčeného cyklu", html.includes("cycleOverlayOn()&&cycleState.unlocked"));
  t("pole s heslem cyklu není předvyplněné", /id="cycPin"[^>]*autocomplete="off"/.test(html) && !/id="cycPin"[^>]*value=/.test(html));
  t("nápověda k PINu kalendáře se escapuje", /function cycHint\(\)\{[^\n]*esc\(h\)/.test(html));
  t("cyklus nikam neposílá PIN", !html.includes("cycHeaders") && !html.includes("cycleState.pin"));
  rest();
})().catch((e) => { console.log("  CHYBA výjimka " + e.stack); bad++; rest(); });

function rest() {

t("v mřížce je úchyt šířky vidět", !html.includes(".board.gridded .area-rz-x{display:none}"));
t("šířka v mřížce = sloupce, i necelé (a.span)", html.includes("${cols&&a.span?gridW(a.span,cols):\"\"}") && html.includes("`calc((100% + 18px) * ${"));
t("v mřížce se přichytí na celé sloupce (16 px)", html.includes("snap=Math.abs(raw-(n*st-rz.gap))<16;rz.span=snap?n:"));
t("v mřížce se nepoužije volné a.w", html.includes("(a.w&&!cols)"));
t("na mobilu se span ruší", html.includes(".board.gridded .area{grid-column:auto!important;width:auto!important}"));
t("puštění v mřížce ukládá span, ne a.w", /if\(g\.cols\)\{[^\n]*a\.span=g\.span/.test(html));
t("Obnovit velikost maže i span", html.includes("delete a.w;delete a.h;delete a.span;"));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
}
