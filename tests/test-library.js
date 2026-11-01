// Knihovna: duplicity (stejné na serveru i ve stránce), uložené články, kontrola
// odkazů po dávkách, záloha a obnova, import záložek a CSV.
const fs = require("fs");
const src = fs.readFileSync("src/index.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }

// ---- server jako modul, s falešným KV a fetch ----
const kvStore = new Map();
const KV = {
  get: async (k, type) => { const v = kvStore.get(k); if (v === undefined) return null; return type === "arrayBuffer" ? v.value : typeof v.value === "string" ? v.value : v.value; },
  getWithMetadata: async (k) => { const v = kvStore.get(k); return v ? { value: v.value, metadata: v.metadata } : { value: null }; },
  put: async (k, value, o) => { kvStore.set(k, { value, metadata: o && o.metadata }); },
  delete: async (k) => { kvStore.delete(k); },
  list: async ({ prefix }) => ({ keys: [...kvStore.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: kvStore.get(name).metadata })) }),
};
const pages = {};
let fetched = 0;
global.fetch = async (u) => {
  fetched++;
  const body = pages[u];
  if (body === undefined) return new Response("nic", { status: 404 });
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
};
const mod = {};
new Function("mod", src.replace("export default {", "mod.worker = {") + "\nmod.dupKey = dupKey; mod.extractArticle = extractArticle; mod.checkBoard = checkBoard; mod.saveArticle = saveArticle; mod.artBackfill = artBackfill; mod.gcArticles = gcArticles; mod.artKey = artKey;")(mod);
const env = { KV, ASSETS: { fetch: async () => new Response("") } };
const call = async (path, method, body) => { const r = await mod.worker.fetch(new Request("https://r.dev" + path, { method: method || "GET", body: body ? JSON.stringify(body) : undefined }), env, { waitUntil: () => {} }); return { status: r.status, headers: r.headers, json: await r.json().catch(() => null) }; };

// ---- stránka: dupKey a import ----
const pg = {};
new Function("pg", html.slice(html.indexOf("const nrm="), html.indexOf("const isImgUrl=")) + html.slice(html.indexOf("function libCsvRows("), html.indexOf("function libPlan(")).replace("function libParseHtml(", "function libParseHtml_(") + "\nfunction libParseHtml(){return [{html:1}];}\npg.dupKey = dupKey; pg.libParse = libParse; pg.libParseCsv = libParseCsv; pg.nrm = nrm;")(pg);

(async () => {
  const urls = ["https://www.Example.com/a/?utm_source=x&b=2&a=1#top", "http://example.com/a?a=1&b=2", "https://youtu.be/abc123?si=zz", "https://m.youtube.com/watch?v=abc123&t=1", "example.com/x/", "https://shop.cz/p?id=5&fbclid=1", "ftp://x.cz/a", "nesmysl"];
  t("duplicity: server a stránka dávají totéž", urls.every((u) => mod.dupKey(u) === pg.dupKey(u)), urls.map((u) => [mod.dupKey(u), pg.dupKey(u)]));
  t("duplicity: www, http, utm, pořadí, # a lomítko", mod.dupKey(urls[0]) === mod.dupKey(urls[1]));
  t("duplicity: youtu.be = youtube.com bez času", mod.dupKey(urls[2]) === mod.dupKey(urls[3]));
  t("duplicity: jiný parametr je jiný odkaz", mod.dupKey("https://shop.cz/p?id=5") !== mod.dupKey("https://shop.cz/p?id=6") && mod.dupKey(urls[5]) === "shop.cz/p?id=5");
  t("duplicity: nesmysl a ftp nic", mod.dupKey("ftp://x.cz/a") === "" && mod.dupKey("nesmysl") === "");

  const art = mod.extractArticle("<html><head><title>Ahoj &amp; svět</title><script>var x='menu'</script></head><body><nav>menu</nav><article><h1>Nadpis</h1><p>" + "Text článku. ".repeat(50) + "</p><ul><li>jedna</li></ul></article><footer>pata</footer></body></html>");
  t("článek: název, text bez menu a skriptu, odrážky", art.title === "Ahoj & svět" && art.text.startsWith("Nadpis\nText článku.") && !/menu|pata|var x/.test(art.text) && art.text.includes("• jedna"));
  const noArt = mod.extractArticle("<body><div>" + "Odstavec bez článku. ".repeat(40) + "</div></body>");
  t("článek: bez <article> vezme body", noArt.text.startsWith("Odstavec bez článku."));

  // články: uložení, výtah pro hledání, neúspěch
  pages["https://blog.cz/a"] = "<title>Recept</title><article>" + "<p>Svíčková na smetaně, knedlík.</p>".repeat(20) + "</article>";
  const rec = await mod.saveArticle(env, "https://blog.cz/a");
  const idx = JSON.parse(kvStore.get("artidx").value), k = await mod.artKey("https://blog.cz/a");
  t("článek: uložený text a výtah bez diakritiky", rec && rec.text.includes("Svíčková") && idx[k].s === "recept svickova smetane knedlik", idx[k]);
  await mod.saveArticle(env, "https://mrtvy.cz/x");
  const idx2 = JSON.parse(kvStore.get("artidx").value);
  t("článek: neúspěch se zapíše (f)", idx2[await mod.artKey("https://mrtvy.cz/x")].f > 0);
  let r = await call("/api/articles");
  t("api/articles vrátí jen uložené", r.json.items.length === 1 && r.json.items[0].u === "https://blog.cz/a");
  r = await call("/api/article", "POST", { url: "https://www.blog.cz/a/?utm_source=x" });
  t("api/article najde uložený text i přes jiný zápis adresy", r.status === 200 && r.json.title === "Recept");
  r = await call("/api/article", "POST", { url: "https://x.cz/api/img/abc123" });
  t("api/article odmítne obrázek", r.status === 400);

  // cron: články po pár kusech, staré neúspěchy znovu
  const board = { areas: [{ type: "links", links: [1, 2, 3, 4, 5, 6].map((i) => ({ id: "l" + i, url: "https://n.cz/" + i })) }, { type: "text", links: [{ text: "x" }] }], trash: [] };
  fetched = 0;
  t("cron: nejvýš 4 články za běh", (await mod.artBackfill(env, board, 4)) === 4 && fetched === 4);
  t("cron: další běh vezme zbytek", (await mod.artBackfill(env, board, 4)) === 2);
  t("cron: neúspěch se 30 dní nezkouší", (await mod.artBackfill(env, board, 4)) === 0);

  // úklid článků k odkazům, které už nikde nejsou
  const kept = { areas: [{ type: "links", links: [{ url: "https://blog.cz/a" }] }], trash: [{ payload: { item: { url: "https://n.cz/1" } } }] };
  const gone = await mod.gcArticles(env, kept, [{ url: "https://n.cz/2" }]);
  const idx3 = JSON.parse(kvStore.get("artidx").value);
  t("úklid: smaže články k odkazům, které nikde nejsou", gone > 0 && idx3[k] && idx3[await mod.artKey("https://n.cz/1")] && idx3[await mod.artKey("https://n.cz/2")] && !idx3[await mod.artKey("https://n.cz/3")] && !kvStore.has("art:" + (await mod.artKey("https://n.cz/3"))));

  // kontrola odkazů po dávkách
  const big = { areas: [{ type: "links", links: Array.from({ length: 95 }, (_, i) => ({ url: "https://c.cz/" + i, lastChecked: i === 0 ? Date.now() + 1000 : 0 })) }] };
  const since = Date.now();
  fetched = 0;
  const left1 = await mod.checkBoard(big, 40, since);
  t("kontrola: 40 na běh, vrátí zbytek", left1 === 54 && fetched === 40, [left1, fetched]);
  t("kontrola: přeskočí nedávno zkontrolovaný", big.areas[0].links[0].lastChecked > since);
  await mod.checkBoard(big, 40, since); const left3 = await mod.checkBoard(big, 40, since);
  t("kontrola: po třech bězích hotovo a zapíše lastCheckedAll", left3 === 0 && big.meta && big.meta.lastCheckedAll > 0);
  t("kontrola: obrázky z appky se nekontrolují", (await mod.checkBoard({ areas: [{ type: "links", links: [{ url: "https://r.dev/api/img/abc123" }] }] }, 40, Date.now())) === 0);
  t("denní úklid už nekontroluje všechno naráz", !/await checkBoard\(board\);/.test(src));
  t("cron kontroluje po 12 a ukládá 4 články", src.includes("await checkBoard(board, 12, Date.now() - 20 * 3600000)") && src.includes("await artBackfill(env, board, 4)"));

  // záloha a obnova
  kvStore.set("board", { value: JSON.stringify({ areas: [{ id: "a", name: "A", type: "links", links: [{ url: "https://r.dev/api/img/img0001" }] }], settings: {} }) });
  kvStore.set("inbox", { value: JSON.stringify([{ id: "i", type: "image", img: "img0002" }]) });
  kvStore.set("img:img0001", { value: new Uint8Array([1, 2, 3]).buffer, metadata: { type: "image/webp" } });
  kvStore.set("img:img0002", { value: new Uint8Array([4, 5]).buffer, metadata: { type: "image/png" } });
  r = await call("/api/export");
  t("záloha: deska, inbox a oba obrázky", r.json.app === "rozcestnik" && r.json.board.areas[0].name === "A" && r.json.inbox.length === 1 && r.json.images.img0001 === "data:image/webp;base64,AQID" && r.json.images.img0002 === "data:image/png;base64,BAU=");
  t("záloha: stáhne se jako soubor", /attachment; filename="rozcestnik-\d{4}-\d\d-\d\d\.json"/.test(r.headers.get("content-disposition")));
  const backup = r.json;
  kvStore.delete("img:img0001");
  kvStore.set("board", { value: JSON.stringify({ areas: [{ id: "b", name: "Nová", links: [] }] }) });
  r = await call("/api/restore", "POST", { app: "jiná", board: {} });
  t("obnova: odmítne cizí soubor", r.status === 400 && JSON.parse(kvStore.get("board").value).areas[0].name === "Nová");
  r = await call("/api/restore", "POST", backup);
  t("obnova: vrátí desku, inbox a obrázky", r.json.ok && r.json.images === 2 && JSON.parse(kvStore.get("board").value).areas[0].name === "A" && kvStore.has("img:img0001"));
  t("obnova: předchozí deska je uschovaná", JSON.parse(kvStore.get("board_prev").value).areas[0].name === "Nová");

  // import ve stránce
  const csv = 'title,url,time_added,tags,status\n"Recept, dobrý",https://a.cz/1,1,,unread\nBez,https://b.cz/2,2,,read\nŠpatný,není adresa,3,,\n';
  const p1 = pg.libParse("pocket.csv", csv);
  t("import: CSV z Pocketu (čárka v uvozovkách, bez adresy pryč)", p1.items.length === 2 && p1.items[0].title === "Recept, dobrý" && p1.items[0].url === "https://a.cz/1", p1);
  const p2 = pg.libParse("raindrop.csv", "id,title,note,excerpt,url,folder,tags\n1,Kniha,,,https://k.cz,Čtení,\n");
  t("import: CSV z Raindropu se složkou", p2.items[0].folder === "Čtení" && p2.items[0].title === "Kniha");
  t("import: obyčejný seznam adres", pg.libParse("x.txt", "https://a.cz\nnějaký text https://b.cz/x, další").items.map((i) => i.url).join() === "https://a.cz,https://b.cz/x");
  t("import: záloha Rozcestníku se pozná", !!pg.libParse("z.json", JSON.stringify(backup)).backup);
  t("import: HTML jde do parseru záložek", pg.libParse("bookmarks.html", '<DL><DT><A HREF="https://a.cz">A</A></DL>').items[0].html === 1);
  const late = await mod.saveArticle(env, (pages["https://dlouhy.cz"] = "<article>" + "<p>Úvodní věta o ničem.</p>".repeat(300) + "<p>Na konci teče Vltava.</p></article>", "https://dlouhy.cz"));
  const li = JSON.parse(kvStore.get("artidx").value)[await mod.artKey("https://dlouhy.cz")];
  t("článek: výtah má i slovo z konce dlouhého článku", late && li.s.includes("vltava") && li.s.length < 7000, li.s.length);
  t("hledání nehledí na diakritiku", pg.nrm("Svíčková ŘÍZEK") === "svickova rizek");
  const libHas = eval(html.match(/const libHas=([^\n]*);/)[1]);
  t("hledání: víc slov v libovolném pořadí", libHas("faktura za elektrinu 2026", "elektrinu faktura") && !libHas("faktura za plyn", "elektrinu faktura"));
  t("smazání všech dat maže i články a uschovanou desku", /"artidx", "board_prev", "inbox_prev"/.test(src) && src.includes('env.KV.list({ prefix: "art:"'));

  console.log("ok=" + ok + " chyb=" + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("  CHYBA výjimka " + e.stack); process.exit(1); });
