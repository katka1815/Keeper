// Vzhled: témata a tmavý režim jako tokeny, obrazy v appce (volná díla), úklid,
// řazení odkazů podle používání a ráno nahoře úkoly.
const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");
let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }
const fn = (name) => { const at = html.indexOf("function " + name + "("); const open = html.indexOf("{", at); let d = 0; for (let i = open; i < html.length; i++) { if (html[i] === "{") d++; else if (html[i] === "}" && --d === 0) return html.slice(at, i + 1); } };

// témata
t("výchozí vzhled je beze změny (8 px, bílá)", /:root\{--paper:#ffffff;--panel:#ffffff;--ink:#252525/.test(html) && /--r:8px/.test(html));
t("Duna, Zlatá hodina a tmavé varianty", ['[data-theme="duna"]', '[data-theme="golden"]', ':root[data-dark="1"]{', ':root[data-dark="1"][data-theme="duna"]', ':root[data-dark="1"][data-theme="golden"]'].every((x) => html.includes(x)));
t("nikde natvrdo bílé pozadí (tmavý režim)", !/background:#fff(?![0-9a-f])/i.test(html));
t("písmo jen systémové, nic ze sítě", !/fonts\.googleapis|@font-face/.test(html));

// obrazy
const art = JSON.parse(html.match(/const ART=\/\*ART\*\/(\[[\s\S]*?\])\/\*ART\*\//)[1]);
t("16 obrazů z katalogu", art.length === 16, art.length);
t("každý obraz i náhled leží v appce", art.every((p) => fs.existsSync("public/" + p.file) && fs.existsSync("public/" + p.thumb) && /^art\//.test(p.file)));
t("obrazy jsou malé (do 400 kB)", art.every((p) => fs.statSync("public/" + p.file).size < 400000));
t("každý má autora, název, část dne, linie, paletu a detail", art.every((p) => p.author && p.title && p.tags.length
  && p.et.length === 48 && p.eb.length === 48 && p.et.every((v) => v >= 40 && v <= 100) && p.eb.every((v) => v >= 0 && v <= 60)
  && p.pal.length >= 3 && p.pal.every((c) => /^#[0-9a-f]{6}$/.test(c)) && p.det.length === 3), art.map((p) => p.id));
t("černobílé fotky obrazů nahrazené barevnými", !art.some((p) => /chittussi/.test(p.id)));
t("hrana jde po linii (clip-path), ne rovný řez", html.includes("el.style.clipPath=artClip(") && !/\.art-top\{-webkit-mask-image/.test(html));
t("záložky z palety jen se zapnutou volbou", html.includes("const acol=lookTab(a,ai);") && html.includes("if(o.tabPal&&o.art.kind===\"paint\")"));
t("všechny části dne mají obraz", ["morning", "day", "evening", "night"].every((ph) => art.some((p) => p.tags.includes(ph))));

// řazení podle používání
const state = { board: { settings: {} } };
const useScore = new Function("return " + fn("useScore"))();
const useSorted = new Function("state", "useScore", "return " + fn("useSorted"))(state, useScore);
const now = Date.now(), a = { type: "links", links: [{ id: "x" }, { id: "y", hits: 5, used: now }, { id: "z", hits: 9, used: now - 120 * 864e5 }] };
t("častěji použité nahoru, staré klikání slábne", useSorted(a).map((l) => l.id).join() === "y,z,x", useSorted(a).map((l) => l.id));
a.manualOrder = true;
t("ruční pořadí oblasti se drží", useSorted(a).map((l) => l.id).join() === "x,y,z");
state.board.settings.sortUse = false; delete a.manualOrder;
t("vypnuté řazení nic nemění", useSorted(a).map((l) => l.id).join() === "x,y,z");
t("šipky ▲▼ přepnou oblast na ruční pořadí", html.includes('act==="link-down"){const a=A(areaId);if(a)a.manualOrder=true;'));

// úklid a nastavení
t("úklid schová sekce do lišty a vrátí je", /s\.cleanPrev=\{secMode:Object\.assign\(\{\},s\.secMode\|\|\{\}\)\}/.test(html) && html.includes("s.secMode=Object.assign({},(s.cleanPrev&&s.cleanPrev.secMode)||{})"));
t("v úklidu zůstane hledání a rychlý zápis", html.includes('id="cleanSearch" class="clean-only"') && html.includes("body.clean .clean-only{display:inline-flex!important}"));
t("nastavení: Vzhled a Plocha nahoře, zbytek v Pokročilých", html.includes("${lookSettingsHtml()}") && html.includes('<details class="set-adv" id="setAdv">') && html.includes("</div></details>`;"));
t("⚙ u sekcí skočí do nastavení", html.includes('data-act="sec-settings" data-g="setg-tasks"') && html.includes('data-act="sec-settings" data-g="setg-layout"'));
t("úkoly mají úchyt pro přesun", html.includes('<span class="tgrip" data-tgrip="${x.id}"'));
t("ráno nahoře úkoly jen s volbou podle denní doby", html.includes('if(!look().daytime||lookPhase()!=="morning")return rows;'));
t("vlastní fotka se se šifrováním nahraje zamčená", html.includes('body=await e2eSealBytes(lkInfo.keys.pub,body);h["x-rz-enc"]="1";'));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
