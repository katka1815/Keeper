// Šifrování obsahu: klíče ze stránky, tokeny enc1 (stránka) a pk1 (server veřejným klíčem),
// co se šifruje a co zůstává čitelné, a serverové cesty se zabalenými klíči. Skutečná
// kryptografie přes WebCrypto v Node, server proti falešnému KV.
const fs = require("fs");
const src = fs.readFileSync("src/index.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }

// ---- stránka ----
const pick = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error("nenalezeno: " + a); return html.slice(i, j); };
const pg = {};
const idb = new Map();
const MutationObserver = function () { this.observe = () => {}; };
const document = { addEventListener: () => {}, documentElement: {} };
new Function("pg", "idb", "MutationObserver", "document", `
  var e2e=null,e2eShared={areas:[],blocks:[],tasks:false};
  const lkHex=b=>[...b].map(x=>x.toString(16).padStart(2,"0")).join(""),lkRand=n=>lkHex(crypto.getRandomValues(new Uint8Array(n)));
  const cyIdb=async(mode,fn)=>{const st={get:k=>({result:idb.get(k)}),put:(v,k)=>{idb.set(k,v);return {};},delete:k=>{idb.delete(k);return {};}};const r=fn(st);return r&&r.result;};
  const sessionStorage={m:new Map(),getItem(k){return this.m.has(k)?this.m.get(k):null;},setItem(k,v){this.m.set(k,String(v));},removeItem(k){this.m.delete(k);}};
  ${pick("async function lkDerive(", "function lkNewCode(")}
  ${pick("const E2E_SENS=", "// Zapnutí šifrování u appky")}
  pg.set=(v)=>{e2e=v;};pg.get=()=>e2e;pg.shared=(v)=>{e2eShared=v;};pg.ss=sessionStorage;
  Object.assign(pg,{lkDerive,e2eNewKeys,e2eWrap,e2eUnwrapRaw,e2eFromRaw,e2eStore,e2eLoad,e2eForget,e2eEnc,e2eDecTok,e2eOpen,e2eSealState,e2eOpenBytes,e2eSealBytes});
`)(pg, idb, MutationObserver, document);

// ---- server ----
const kv = new Map();
const meta = new Map();
const KV = { get: async (k) => (kv.has(k) ? kv.get(k) : null), getWithMetadata: async (k) => ({ value: kv.has(k) ? kv.get(k) : null, metadata: meta.get(k) || null }), put: async (k, v, o) => { kv.set(k, v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v); meta.set(k, (o && o.metadata) || null); }, delete: async (k) => { kv.delete(k); meta.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: meta.get(name) || null })) }) };
const mod = {};
new Function("mod", src.replace("export default {", "mod.worker = {") + "\nmod.sealer = sealer; mod.sealArticles = sealArticles; mod.gcImages = gcImages; mod.runWatchesSrc = String(runWatches);")(mod);
const env = { KV, ASSETS: { fetch: async () => new Response("") } };
let cookie = "";
async function call(path, method, body) {
  const headers = cookie ? { cookie: "rz_s=" + cookie } : {};
  const r = await mod.worker.fetch(new Request("https://r.dev" + path, { method: method || "GET", headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const m = (r.headers.get("set-cookie") || "").match(/rz_s=([a-f0-9]+)/); if (m) cookie = m[1];
  let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, json: j };
}

(async () => {
  // klíče jako při nastavení hesla
  const salt = "a".repeat(32), rsalt = "b".repeat(32);
  const a = await pg.lkDerive("modry-kocour-pije-caj", salt, 100000), r = await pg.lkDerive("KZ42YXYWMCZH9WKFMAQ0", rsalt, 100000);
  const n = await pg.e2eNewKeys(), wdk = await pg.e2eWrap(a.enc, n.dkRaw), rwdk = await pg.e2eWrap(r.enc, n.dkRaw);
  t("klíče: soukromý klíč odchází jen zašifrovaný", !JSON.stringify(n.keys).includes("\"d\"") && n.keys.pub.kty === "EC" && /^[a-f0-9]{16}$/.test(n.keys.kid));
  let res = await call("/api/auth/setup", "POST", { key: a.key, salt, iter: 100000, rkey: r.key, rsalt, kind: "t", ...n.keys, wdk, rwdk });
  const au = JSON.parse(kv.get("auth"));
  t("nastavení: server uloží zabalené klíče, ne klíč z hesla", res.status === 200 && au.kid === n.keys.kid && au.wdk.ct === wdk.ct && au.rwdk && !kv.get("auth").includes(a.key));
  res = await call("/api/auth/status");
  t("status dá zabalené klíče jen přihlášenému", res.json.keys && res.json.keys.wdk.ct === wdk.ct);
  const c0 = cookie; cookie = ""; res = await call("/api/auth/status"); cookie = c0;
  t("nepřihlášený vidí jen kid", res.json.kid === n.keys.kid && !res.json.keys);

  // odemčení heslem i kódem dá tentýž datový klíč
  const dk1 = await pg.e2eUnwrapRaw(a.enc, au.wdk), dk2 = await pg.e2eUnwrapRaw(r.enc, au.rwdk);
  t("heslo i záchranný kód odemknou stejný klíč", Buffer.from(dk1).equals(Buffer.from(n.dkRaw)) && Buffer.from(dk2).equals(Buffer.from(n.dkRaw)));
  let badPass = false; try { await pg.e2eUnwrapRaw((await pg.lkDerive("spatne-heslo-xx", salt, 100000)).enc, au.wdk); } catch (e) { badPass = true; }
  t("špatné heslo klíč neodemkne", badPass);

  // důvěryhodné zařízení: nevyexportovatelné klíče v IndexedDB
  await pg.e2eStore("t", au.kid, dk1, au);
  t("důvěryhodné: v IndexedDB jen CryptoKey, žádné bajty", idb.get("e2e") && idb.get("e2e").dk.extractable === false && idb.get("e2e").priv.extractable === false);
  t("načtení klíčů podle kid", (await pg.e2eLoad({ kid: "0".repeat(16) })) === false && await pg.e2eLoad(au) && pg.get().kid === au.kid);
  await pg.e2eForget();
  t("zapomenutí smaže klíče", !idb.has("e2e") && pg.get() === null);
  await pg.e2eStore("f", au.kid, dk1, au);
  t("cizí zařízení: klíče jen v sessionStorage", !idb.has("e2e") && pg.ss.getItem("rozc_k") && await pg.e2eLoad(au));

  // tokeny
  const tok = await pg.e2eEnc("Svíčková na smetaně");
  t("enc1 token neobsahuje text a opakuje se pro stejný text", /^enc1\./.test(tok) && !tok.includes("Svíčková") && (await pg.e2eEnc("Svíčková na smetaně")) === tok);
  const seal = await mod.sealer(env), ptok = await seal("Z telefonu: recept");
  t("server zamkne veřejným klíčem, stránka odemkne", /^pk1\./.test(ptok) && (await pg.e2eDecTok(ptok)) === "Z telefonu: recept");
  t("tokeny uvnitř spojeného textu (Koš)", (await pg.e2eOpen(tok + " · " + ptok)) === "Svíčková na smetaně · Z telefonu: recept");
  t("cizí nebo poškozený token zůstane", (await pg.e2eOpen("enc1.AAAA.BBBB")) === "enc1.AAAA.BBBB");

  // co se šifruje
  const st = { board: {
    settings: { title: "Moje", watchEmail: "a@b.cz" }, meta: {},
    areas: [{ id: "A", name: "Recepty", type: "links", links: [{ id: "l1", title: "Svíčková", url: "https://recepty.cz/s", note: "babička", status: "ok" }] },
      { id: "P", name: "Tajné", type: "links", private: true, links: [{ id: "l2", title: "Klinika", url: "https://klinika.cz/x", status: "ok" }] },
      { id: "S", name: "Sdílená", type: "text", links: [{ id: "l3", text: "Pro Janu" }] },
      { id: "T", name: "Texty", type: "text", links: [{ id: "l4", text: "obrázek https://r.dev/api/img/abcd1234" }] }],
    tasks: [{ id: "t1", text: "Zavolat doktorce", done: false }],
    blocks: [{ id: "B", name: "Týden", goals: [{ id: "g", text: "Běhat" }], done: [] }],
    watches: [{ id: "w", name: "Hamlet", phrase: "Hamlet", urls: ["https://divadlo.cz"] }],
    debts: [{ id: "d", who: "Jana", amount: 500, cur: "CZK" }],
    trash: [{ id: "x", label: "Klinika", payload: { area: "P", item: { url: "https://klinika.cz/y", title: "Klinika 2" } } }],
  }, inbox: [{ id: "i", type: "link", url: "https://zpravy.cz/a", text: "Článek", img: "ef567890" }], inboxKnown: ["i"] };
  pg.shared({ areas: ["S"], blocks: [], tasks: false });
  const sealed = await pg.e2eSealState(JSON.parse(JSON.stringify(st)));
  const B = sealed.board, J = JSON.stringify(sealed);
  t("šifruje názvy, texty, poznámky, úkoly, cíle, Ke zpracování", ["Recepty", "Svíčková", "babička", "Zavolat", "Běhat", "Článek", "Jana", "Hamlet\",\"phrase"].every((w) => !J.includes(w)), J.slice(0, 300));
  t("adresy, fráze hlídače, čísla a nastavení zůstanou", B.areas[0].links[0].url === "https://recepty.cz/s" && B.watches[0].phrase === "Hamlet" && B.watches[0].urls[0] === "https://divadlo.cz" && B.debts[0].amount === 500 && B.settings.title === "Moje" && B.areas[0].links[0].status === "ok" && sealed.inbox[0].url === "https://zpravy.cz/a");
  t("soukromá oblast šifruje i adresy (i v Koši)", /^enc1\./.test(B.areas[1].links[0].url) && /^enc1\./.test(B.trash[0].payload.item.url) && !J.includes("klinika"));
  t("sdílená oblast zůstane čitelná", B.areas[2].name === "Sdílená" && B.areas[2].links[0].text === "Pro Janu");
  t("odkazy na obrázky jdou do meta.imgRefs", B.meta.imgRefs.includes("abcd1234") && B.meta.imgRefs.length === 1);
  const opened = await pg.e2eOpen(JSON.parse(J));
  t("odšifruje se zpátky celé", JSON.stringify(opened.board.areas) === JSON.stringify(st.board.areas) && opened.board.tasks[0].text === "Zavolat doktorce" && opened.inbox[0].text === "Článek");

  // server se šifrovanou deskou
  kv.set("board", JSON.stringify(B));
  res = await call("/api/capture", "POST", { text: "Recept z telefonu", url: "https://x.cz/r", note: "na neděli" });
  const ib = JSON.parse(kv.get("inbox"));
  t("Ke zpracování z telefonu se zamkne veřejným klíčem", res.status === 200 && /^pk1\./.test(ib[0].text) && /^pk1\./.test(ib[0].note) && ib[0].url === "https://x.cz/r" && !kv.get("inbox").includes("Recept"));
  res = await call("/api/state");
  t("stav nese sdílené oblasti", res.json.shared && Array.isArray(res.json.shared.areas));
  const st2 = await pg.e2eOpen(res.json);
  t("stránka přečte i věci zamčené serverem", st2.inbox[0].text === "Recept z telefonu" && st2.board.areas[0].name === "Recepty");

  // obrázky: bez meta.imgRefs se šifrovaná deska nesmí uklízet
  kv.set("img:abcd1234", "x"); kv.set("img:zzzz9999", "x");
  const bNo = JSON.parse(JSON.stringify(B)); delete bNo.meta.imgRefs;
  t("úklid obrázků bez seznamu nesmaže nic", (await mod.gcImages(env, bNo, [])) === 0 && kv.has("img:abcd1234"));
  await mod.gcImages(env, B, []);
  t("úklid obrázků podle meta.imgRefs", kv.has("img:abcd1234") && !kv.has("img:zzzz9999"));

  // články: zamčené při uložení i dodatečně
  kv.set("art:k1", JSON.stringify({ u: "https://z.cz/a", title: "Starý článek", text: "text starého článku", saved: 1 }));
  kv.set("artidx", JSON.stringify({ k1: { u: "https://z.cz/a", s: "stary clanek text", t: 1 } }));
  t("staré články se dodatečně zamknou", (await mod.sealArticles(env, 40)) === 0 && /^pk1\./.test(JSON.parse(kv.get("art:k1")).text) && /^pk1\./.test(JSON.parse(kv.get("artidx")).k1.s));
  res = await call("/api/articles");
  t("výtah pro hledání stránka odemkne", (await pg.e2eOpen(res.json)).items[0].s === "stary clanek text");
  t("hlídač posílá ven jen obecnou zprávu", src.includes("await notifyHit(w, rec, env, s.watchEmail || \"\", !!seal);") && src.includes('"Hlidac nasel shodu."'));

  // obrázky
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5, 6, 7, 8]), dataUrl = "data:image/png;base64," + Buffer.from(png).toString("base64");
  const sb = await seal.bytes(png);
  t("obrázek: server zamkne bajty, stránka je odemkne", sb.length === 77 + png.length + 16 && Buffer.from(await pg.e2eOpenBytes(sb)).equals(Buffer.from(png)));
  const pubAuth = JSON.parse(kv.get("auth")).pub, ps = await pg.e2eSealBytes(pubAuth, png);
  t("obrázek: stránka zamkne sama (Ctrl+V)", Buffer.from(await pg.e2eOpenBytes(ps)).equals(Buffer.from(png)));
  const imgReq = async (path, opt) => mod.worker.fetch(new Request("https://r.dev" + path, opt), env, { waitUntil() {} });
  res = await call("/api/capture", "POST", { image: dataUrl });
  const capId = JSON.parse(kv.get("inbox"))[0].img;
  let ir = await imgReq("/api/img/" + capId);
  const capBytes = new Uint8Array(await ir.arrayBuffer());
  t("obrázek z telefonu leží zamčený, vydá se s x-rz-enc", ir.headers.get("x-rz-enc") === "1" && ir.headers.get("x-rz-type") === "image/png" && ir.headers.get("content-type") === "application/octet-stream" && Buffer.from(await pg.e2eOpenBytes(capBytes)).equals(Buffer.from(png)));
  res = await call("/api/capture", "POST", { imageSealed: Buffer.from(ps).toString("base64"), imageType: "image/png" });
  const capId2 = JSON.parse(kv.get("inbox"))[0].img;
  t("obrázek zamčený stránkou se uloží, jak je", res.status === 200 && Buffer.from(new Uint8Array(await (await imgReq("/api/img/" + capId2)).arrayBuffer())).equals(Buffer.from(ps)));
  const c1 = cookie; cookie = "";
  t("čitelnou kopii nahraje jen přihlášená", (await imgReq("/api/img/" + capId, { method: "PUT", headers: { "content-type": "image/png" }, body: png })).status === 401);
  cookie = c1;
  ir = await imgReq("/api/img/" + capId, { method: "PUT", headers: { "content-type": "image/png", cookie: "rz_s=" + cookie }, body: png });
  ir = await imgReq("/api/img/" + capId);
  t("čitelná kopie pro sdílení", !ir.headers.get("x-rz-enc") && ir.headers.get("content-type") === "image/png");
  // sdílení s čitelnými obrázky: dozamykání je přeskočí, po zrušení se zamknou
  const bImg = JSON.parse(kv.get("board")); bImg.areas[2].links.push({ id: "im", title: "foto", url: "https://r.dev/api/img/" + capId }); kv.set("board", JSON.stringify(bImg));
  res = await call("/api/share/create", "POST", { areas: ["S"], images: true, mode: "obscure", access: "read" });
  const shTok = res.json.token;
  t("sdílení si pamatuje volbu obrázků", (await call("/api/share/view?token=" + shTok)).json.images === true);
  await call("/api/e2e/seal-images", "POST");
  t("obrázek v sdílení s čitelnými obrázky se nezamkne", !(await imgReq("/api/img/" + capId)).headers.get("x-rz-enc"));
  await call("/api/share/revoke", "POST", { token: shTok });
  await call("/api/e2e/seal-images", "POST");
  t("po zrušení sdílení se zamkne", (await imgReq("/api/img/" + capId)).headers.get("x-rz-enc") === "1");
  res = await call("/api/export");
  const exp = res.json;
  t("záloha nese zamčené obrázky zvlášť", exp.imagesEnc && exp.imagesEnc[capId] && exp.imagesEnc[capId].type === "image/png" && !exp.images[capId]);
  kv.delete("img:" + capId);
  await call("/api/restore", "POST", exp);
  ir = await imgReq("/api/img/" + capId);
  t("obnova vrátí zamčený obrázek", ir.headers.get("x-rz-enc") === "1" && Buffer.from(await pg.e2eOpenBytes(new Uint8Array(await ir.arrayBuffer()))).equals(Buffer.from(png)));
  t("stránka: obrázky přepíná na odemčené, odkaz otevře odemčený", html.includes("img.removeAttribute(\"src\");img.dataset.rzimg=m[1];") && html.includes("const w=window.open(\"\",\"_blank\");e2eImgUrl(m[1])"));
  t("stránka: čtení textu z obrázku bere odemčené bajty", html.includes("const run=async()=>{try{const img=await e2eFetchImg(job.src);"));
  t("sdílení: varování u čitelných obrázků", html.includes("shImgWarn:\"Obrázky budou na serveru čitelné, takže tahle data dostane služba Cloudflare.\"") && html.includes("if(images&&!confirm(lkT().shImgWarn))return;"));
  const shareHtml = fs.readFileSync("public/share.html", "utf8");
  t("příjemce místo zamčeného obrázku vidí zámek", shareHtml.includes("var locked = !data.images") && shareHtml.includes("🔒 šifrovaný obrázek"));

  // změna hesla a kód musí klíč přebalit
  t("změna hesla bez přebaleného klíče neprojde", (await call("/api/auth/change", "POST", { old: a.key, key: "c".repeat(64), salt, iter: 100000 })).status === 400);
  const a2 = await pg.lkDerive("nove-heslo-k-appce", salt, 100000), wdk2 = await pg.e2eWrap(a2.enc, dk1);
  res = await call("/api/auth/change", "POST", { old: a.key, key: a2.key, salt, iter: 100000, hint: "", wdk: wdk2 });
  t("po změně hesla odemkne klíč nové heslo", res.status === 200 && Buffer.from(await pg.e2eUnwrapRaw(a2.enc, JSON.parse(kv.get("auth")).wdk)).equals(Buffer.from(n.dkRaw)));
  res = await call("/api/auth/recover-keys", "POST", { rkey: r.key });
  t("záchranný kód vydá klíč zabalený kódem", res.status === 200 && res.json.rwdk.ct === rwdk.ct);
  t("špatný kód nic", (await call("/api/auth/recover-keys", "POST", { rkey: "d".repeat(64) })).status === 403);
  kv.delete("authfail");
  t("obnova bez přebaleného klíče neprojde", (await call("/api/auth/recover", "POST", { rkey: r.key, key: "e".repeat(64), salt, iter: 100000 })).status === 400);
  t("nový kód bez přebaleného klíče neprojde", (await call("/api/auth/recovery-new", "POST", { old: a2.key, rkey: "f".repeat(64), rsalt })).status === 400);

  // zapnutí u appky, která heslo už má
  const authNow = JSON.parse(kv.get("auth")); for (const k of ["kid", "pub", "wdk", "wpriv", "rwdk"]) delete authNow[k]; kv.set("auth", JSON.stringify(authNow));
  kv.set("board_prev", "{}");
  const n2 = await pg.e2eNewKeys();
  t("zapnutí chce současné heslo", (await call("/api/auth/keys", "POST", { old: a.key, ...n2.keys, wdk: wdk2, rwdk, rkey: r.key, rsalt })).status === 403);
  kv.delete("authfail");
  res = await call("/api/auth/keys", "POST", { old: a2.key, ...n2.keys, wdk: wdk2, rwdk, rkey: r.key, rsalt });
  t("zapnutí uloží klíče a smaže čitelné kopie z obnovy", res.status === 200 && JSON.parse(kv.get("auth")).kid === n2.keys.kid && !kv.has("board_prev"));
  t("podruhé zapnout nejde", (await call("/api/auth/keys", "POST", { old: a2.key, ...n2.keys, wdk: wdk2, rwdk, rkey: r.key, rsalt })).status === 409);
  res = await call("/api/export");
  t("záloha ví, kterým klíčem je zašifrovaná", res.json.kid === n2.keys.kid);

  // stránka
  t("api() šifruje uložení a odšifruje odpovědi", html.includes('if(e2e&&path==="/api/state"&&opts.method==="PUT"') && html.includes("return e2e?e2eOpen(j):j;"));
  t("přihlášení odemkne klíče, odhlášení je zapomene", html.includes("await e2eAfterAuth(a.enc,kind);return lkDone(kind);") && html.includes("await cyIdbDel();await e2eForget();"));
  t("bez klíče na zařízení chce znovu heslo", html.includes("if(s.ok&&s.keys&&!(await e2eLoad(s.keys)))s.ok=false;"));
  t("hlídač připomíná, že běží přes Cloudflare", html.includes("watchOutsourced:\"Tohle je outsourced služba přes Cloudflare, takže odkaz bude jim známý.\"") && html.includes("⚠ ${esc(L.watchOutsourced)}") && html.includes("+\"\\n\\n\"+L.watchOutsourced"));
  t("soukromá oblast nemá hlídač ani uložení textu", html.includes("${a.private?\"\":libReadBtn(l)}${a.private?\"\":"));
  t("soukromá oblast neposílá adresu na server přes ikonku ani náhled", html.includes("${a.private?esc(letter):`<img src=\"/api/favicon") && html.includes("pv=img||a.private?null:ixPreview(l.url)") && html.includes("pv=a.private?null:tidyPreview(it.url)"));

  console.log("ok=" + ok + " chyb=" + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("  CHYBA výjimka " + e.stack); console.log("ok=" + ok + " chyb=" + (bad + 1)); process.exit(1); });
