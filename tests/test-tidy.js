// Pořádek: průvodce úklidem desky. Vytáhne kód průvodce z public/index.html
// a projde ho proti stubům: schování/sbalení oblastí, nechat/smazat, Zpět, mřížka.
const fs = require("fs");
const src = fs.readFileSync("public/index.html", "utf8");
const from = src.indexOf("/* ---------- Pořádek"), to = src.indexOf("/* ---------- Cyklus");
if (from < 0 || to < 0) throw new Error("kód Pořádku nenalezen");
const code = src.slice(from, to).replace(/^(const|let) /gm, "var ");

const DICT = { cs: {}, en: {} }; let L = DICT.cs;
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const host = (u) => { try { return new URL(u).hostname; } catch (e) { return u; } };
// Stuby DOMu: prvky podle id, okno přes stránku a tlačítko Pořádek.
const els = {}, bodyCls = new Set();
const mk = () => ({ style: {}, innerHTML: "", getClientRects: () => [1], getBoundingClientRect: () => ({ top: 10, bottom: 30, right: 400 }), offsetWidth: 300, offsetHeight: 200 });
els.tidyBtn = mk();
const win = { innerHTML: "" };
const document = { body: { appendChild: (e) => { els[e.id] = e; }, classList: { add: (c) => bodyCls.add(c), remove: (c) => bodyCls.delete(c) } },
  createElement: () => mk(), addEventListener: () => {},
  querySelector: (q) => (q === "#tidyModal .tidy-win" && els.tidyModal && els.tidyModal.style.display === "flex" ? win : null) };
const addEventListener = () => {}, innerHeight = 800, innerWidth = 1200;
const $ = (id) => els[id] || null;
const panel = { get innerHTML() { return win.innerHTML; } };
const readableInk = (c) => "#252525", safeTint = (c) => c;
const fetched = [];
const fetch = (u) => { fetched.push(u); return Promise.resolve({ json: () => ({ image: "https://img.cz/x.png", description: "Popis stránky", site: "Web A" }) }); };
const tidyOpen = () => {};
let saved = 0, rendered = 0;
const save = () => saved++, render = () => rendered++, renderAreas = () => rendered++;
let state;
const A = (id) => state.board.areas.find((a) => a.id === id);
let tn = 0;
function toTrash(kind, label, payload) { state.board.trash = state.board.trash || []; state.board.trash.unshift({ id: "t" + (++tn), kind, label, payload }); }
eval(code);

let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }
const btn = (d) => ({ dataset: d });

function fresh() {
  state = { board: { settings: { areasMin: true }, trash: [], areas: [
    { id: "a", name: "A", color: "#ff0000", links: [{ id: "l1", title: "Jedna", url: "https://a.cz" }, { id: "l2", title: "Dvě", url: "https://b.cz" }] },
    { id: "b", name: "B", type: "text", links: [{ id: "x1", text: "poznámka" }] },
    { id: "c", name: "C", links: [{ id: "l3", title: "Tři", url: "https://c.cz" }] },
  ] } };
}

(async () => {
/* --- trochu: rovnou mřížka --- */
fresh(); tidyPopOpen();
const pop = els.tidyPop.innerHTML;
t("okýnko u tlačítka má tři stupně", els.tidyPop.style.display === "block" && pop.includes("Udělej trochu pořádek") && pop.includes("Udělej celkem pořádek") && pop.includes("Udělej úplný pořádek"));
t("okýnko je pod tlačítkem", els.tidyPop.style.top === "34px" && els.tidyPop.style.left === "100px", els.tidyPop.style);
tidyAct("tidy-mode", btn({ mode: "1" }));
t("výběr zavře okýnko", els.tidyPop.style.display === "none");
t("otevře okno přes stránku a zamkne rolování", els.tidyModal.style.display === "flex" && bodyCls.has("tidy-lock"));
t("trochu → mřížka", tidy.step === "grid");
t("náhled mřížky nese barvy oblastí", panel.innerHTML.includes("border-left:3px solid #ff0000"));
t("nabídne 6 × 1 a 5 × 1 pro 3 oblasti", panel.innerHTML.includes("6 × 1") && panel.innerHTML.includes("5 × 1"), panel.innerHTML.match(/\d × \d/g));
tidyAct("tidy-grid", btn({ cols: "6" }));
t("mřížka uložená", state.board.settings.areaCols === 6 && state.board.settings.gridUnified === false);
t("po mřížce hotovo, okno zůstane", tidy.step === "done" && els.tidyModal.style.display === "flex");
tidyAct("tidy-close", null);
t("křížek okno zavře", els.tidyModal.style.display === "none" && !bodyCls.has("tidy-lock"));

/* --- celkem: oblasti, pak mřížka --- */
fresh(); tidyAct("tidy-mode", btn({ mode: "2" }));
t("celkem → otázka na oblasti", tidy.step === "areas" && panel.innerHTML.includes("Které oblasti chceš schovat, nebo rozbalit?"));
t("předvolba podle areasMin = sbalit", tidy.areas.a === "min" && tidy.areas.c === "min");
t("řádky oblastí mají barvu oblasti", panel.innerHTML.includes("border-left-color:#ff0000"));
tidyAct("tidy-area-set", btn({ id: "a", v: "open" }));
tidyAct("tidy-area-set", btn({ id: "b", v: "hide" }));
tidyAct("tidy-areas-next", null);
const [a, b, c] = state.board.areas;
t("a rozbalená", !a.hidden && !a.collapsed);
t("b schovaná", b.hidden === true);
t("c sbalená", c.collapsed === true && !c.hidden);
t("globální sbalení vypnuto", state.board.settings.areasMin === false);
t("celkem → mřížka", tidy.step === "grid");
t("mřížka počítá jen viditelné (2)", panel.innerHTML.includes("6 × 1") && (panel.innerHTML.match(/<i /g) || []).length === 4);

/* --- úplný: odkazy nechat/smazat/zpět --- */
fresh(); tidyAct("tidy-mode", btn({ mode: "3" }));
tidyAct("tidy-area-set", btn({ id: "c", v: "hide" }));
tidyAct("tidy-areas-next", null);
t("úplný → odkazy", tidy.step === "links" && panel.innerHTML.includes("Chceš nechat/smazat?"));
t("fronta bez schované oblasti (3 položky)", tidy.queue.length === 3, tidy.queue);
t("první je Jedna", panel.innerHTML.includes("Jedna") && panel.innerHTML.includes("1 / 3"));
t("karta má barvu oblasti", panel.innerHTML.includes("border-left-color:#ff0000"));
t("náhled se načítá", panel.innerHTML.includes("Načítám náhled") && fetched.includes("/api/preview?url=" + encodeURIComponent("https://a.cz")));
t("další náhled se přednačítá", fetched.includes("/api/preview?url=" + encodeURIComponent("https://b.cz")));
await new Promise((r) => global.setTimeout(r, 0));
t("náhled se ukáže", panel.innerHTML.includes("https://img.cz/x.png") && panel.innerHTML.includes("Popis stránky") && panel.innerHTML.includes("Web A"));
tidyAct("tidy-del", null);
t("smazaná jde do Koše", state.board.trash.length === 1 && !state.board.areas[0].links.some((l) => l.id === "l1"));
t("posun na druhou", tidy.i === 1 && panel.innerHTML.includes("Dvě"));
tidyAct("tidy-back", null);
t("Zpět vrátí položku na původní místo", state.board.areas[0].links[0].id === "l1");
t("Zpět ji vytáhne z Koše", state.board.trash.length === 0);
t("Zpět vrátí ukazatel", tidy.i === 0);
tidyAct("tidy-keep", null); tidyAct("tidy-keep", null);
t("textová položka se ukáže", panel.innerHTML.includes("poznámka"));
tidyAct("tidy-del", null);
t("po poslední → mřížka", tidy.step === "grid");
t("textová smazaná do Koše jako txt", state.board.trash[0].kind === "txt" && state.board.areas[1].links.length === 0);
tidyAct("tidy-grid", btn({ cols: "5" }));
t("5 sloupců", state.board.settings.areaCols === 5);

/* --- přeskočit zbytek a zrušení mřížky --- */
fresh(); tidyAct("tidy-mode", btn({ mode: "3" })); tidyAct("tidy-areas-next", null);
tidyAct("tidy-skip", null);
t("přeskočit → mřížka", tidy.step === "grid");
state.board.settings.areaCols = 6; renderTidy();
t("nabídne zrušení mřížky", panel.innerHTML.includes("Zrušit mřížku"));
tidyAct("tidy-grid", btn({ cols: "0" }));
t("mřížka zrušená", state.board.settings.areaCols === 0);

/* --- angličtina --- */
L = DICT.en; fresh(); tidyPopOpen();
t("anglické názvy", els.tidyPop.innerHTML.includes("Tidy up completely"));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
})();
