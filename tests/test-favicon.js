// Ikonky webů ze svého serveru: <link rel="icon"> nebo /favicon.ico, uložené v KV,
// nenalezené taky (ať se to nezkouší pořád), a stránka už nesahá na Google.
const fs = require("fs");
const src = fs.readFileSync("src/index.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }

const kv = new Map(), meta = new Map();
const KV = { get: async (k) => (kv.has(k) ? kv.get(k) : null), getWithMetadata: async (k) => ({ value: kv.has(k) ? kv.get(k) : null, metadata: meta.get(k) || null }), put: async (k, v, o) => { kv.set(k, v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v); meta.set(k, (o && o.metadata) || null); }, delete: async (k) => { kv.delete(k); }, list: async () => ({ keys: [] }) };
const fetched = [];
const ico = new Uint8Array([0, 0, 1, 0, 1, 0]), png = new Uint8Array([137, 80, 78, 71]);
global.fetch = async (u) => {
  fetched.push(u);
  if (u === "https://web.cz/") return new Response('<html><head><link rel="shortcut icon" href="/img/ikona.png"></head><body>x</body></html>', { headers: { "content-type": "text/html" } });
  if (u === "https://web.cz/img/ikona.png") return new Response(png, { headers: { "content-type": "image/png" } });
  if (u === "https://jen-ico.cz/") return new Response("<html><head></head></html>", { headers: { "content-type": "text/html" } });
  if (u === "https://jen-ico.cz/favicon.ico") return new Response(ico, { headers: { "content-type": "application/octet-stream" } });
  return new Response("nic", { status: 404 });
};
const mod = {};
new Function("mod", src.replace("export default {", "mod.worker = {"))(mod);
const env = { KV, ASSETS: { fetch: async () => new Response("") } };
const get = (d) => mod.worker.fetch(new Request("https://r.dev/api/favicon?d=" + encodeURIComponent(d)), env, { waitUntil() {} });

(async () => {
  let r = await get("www.web.cz");
  t("ikonka z <link rel=icon>", r.status === 200 && r.headers.get("content-type") === "image/png" && Buffer.from(await r.arrayBuffer()).equals(Buffer.from(png)));
  t("SVG a spol. otevřené napřímo nic nespustí", /sandbox/.test(r.headers.get("content-security-policy") || "") && r.headers.get("x-content-type-options") === "nosniff");
  const n = fetched.length; r = await get("web.cz");
  t("podruhé z KV, bez stahování", r.status === 200 && fetched.length === n);
  r = await get("jen-ico.cz");
  t("jinak /favicon.ico", r.status === 200 && r.headers.get("content-type") === "image/x-icon");
  r = await get("nic.cz");
  const m = fetched.length;
  t("nenalezená: 404 a zapamatuje se", r.status === 404 && kv.has("fav:nic.cz") && (await get("nic.cz")).status === 404 && fetched.length === m);
  t("nesmysl a IP adresa se nestahují", (await get("localhost")).status === 404 && (await get("127.0.0.1")).status === 404 && (await get("a b.cz")).status === 404);
  t("stránka už ikonky od Googlu nebere", !html.includes("s2/favicons") && (html.match(/src="\/api\/favicon\?d=\$\{encodeURIComponent\(h\)\}"/g) || []).length === 4);
  console.log("ok=" + ok + " chyb=" + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("  CHYBA výjimka " + e.stack); console.log("ok=" + ok + " chyb=" + (bad + 1)); process.exit(1); });
