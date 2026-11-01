// Úklid osiřelých obrázků z cronu: maže jen obrázky, na které nic neodkazuje,
// nechává nové (dva dny) a nesmaže víc než 25 za běh.
const fs = require("fs");
const src = fs.readFileSync("src/index.js", "utf8");
const i0 = src.indexOf("async function gcImages("), i1 = src.indexOf("\n}\n", i0);
if (i0 < 0 || i1 < 0) throw new Error("gcImages nenalezeno");
const DAY = 86400000;
const deleted = [];
const delImg = async (env, id) => { deleted.push(id); };
eval(src.slice(i0, i1 + 2).replace("async function gcImages(", "var gcImages = async function ("));

let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }
const kv = (keys) => ({ list: async ({ prefix }) => ({ keys: keys.filter((k) => k.name.startsWith(prefix)) }) });
const old = Date.now() - 5 * DAY, fresh = Date.now() - 3600000;

(async () => {
  const board = { areas: [{ links: [{ url: "https://x.workers.dev/api/img/in-area" }] }], trash: [{ payload: { item: { url: "/api/img/in-trash" } } }] };
  const inbox = [{ id: "z", type: "image", img: "in-inbox" }];
  const env = { KV: kv([{ name: "img:in-area" }, { name: "img:in-trash" }, { name: "img:in-inbox" }, { name: "img:orphan", metadata: { t: old } }, { name: "img:legacy" }, { name: "img:new", metadata: { t: fresh } }, { name: "inbox" }]) };
  const n = await gcImages(env, board, inbox);
  t("smaže jen osiřelé a staré", n === 2 && deleted.sort().join() === "legacy,orphan", deleted);

  deleted.length = 0;
  const many = Array.from({ length: 40 }, (_, i) => ({ name: "img:o" + i }));
  t("nejvýš 25 za běh", (await gcImages({ KV: kv(many) }, { areas: [] }, [])) === 25 && deleted.length === 25);

  deleted.length = 0;
  const r2 = { list: async () => ({ objects: [{ key: "img/r-old", uploaded: new Date(old) }, { key: "img/r-new", uploaded: new Date(fresh) }, { key: "img/in-inbox", uploaded: new Date(old) }] }) };
  await gcImages({ KV: kv([]), BOOKS: r2 }, { areas: [] }, inbox);
  t("R2: smaže jen starý osiřelý", deleted.join() === "r-old", deleted);

  t("cron to volá jednou denně", /if \(s\.lastImgGc !== today\) \{ try \{ const ib = await getInbox\(env\); await gcImages\(env, board, ib\)/.test(src));
  t("nové obrázky v KV mají čas nahrání", /metadata: \{ type: img\.type, t: Date\.now\(\)/.test(src));
  console.log("ok=" + ok + " chyb=" + bad);
  process.exit(bad ? 1 : 0);
})();
