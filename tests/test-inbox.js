// Ke zpracování: vykreslení seznamu, mřížky, Roztřídit do oblastí,
// a slučování inboxu, aby uložení ze stránky nesmazalo věci poslané z telefonu.
const fs = require("fs");
const src = fs.readFileSync("public/index.html", "utf8");
const from = src.indexOf("/* ---------- Ke zpracování: mřížka"), to = src.indexOf("/* Ctrl+V:");
if (from < 0 || to < 0) throw new Error("kód Ke zpracování nenalezen");
const code = src.slice(from, to).replace(/^(const|let) /gm, "var ");
const m0 = src.indexOf("const inboxKnown=new Set();"), m1 = src.indexOf("function save(){", m0);
const mergeCode = src.slice(m0, m1).replace(/^(const|let) /gm, "var ");

const DICT = { cs: {}, en: {} };
let L = new Proxy({}, { get: (o, k) => (k in o ? o[k] : String(k)) });
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u || ""; } };
const els = { inbox: { style: {}, innerHTML: "" } };
const $ = (id) => els[id] || null;
const document = { body: { addEventListener: () => {} }, addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] };
const fetch = () => new Promise(() => {});
let saved = 0, n_ = 0;
const save = () => saved++, applySecSizes = () => {}, toast = () => {}, render = () => {};
const uid = () => "u" + n_++, normUrl = (u) => u || "", location = { origin: "https://r.dev" };
const A = (id) => state.board.areas.find((a) => a.id === id);
let state, editing = null, q_ = "";
const lbT = () => ({ dupIn: "Už máš v oblasti", nothing: "Nic" }), libQuery = () => q_, libArtHint = () => "";
const libMatch = (x) => !q_ || JSON.stringify(x).toLowerCase().includes(q_);
eval(src.slice(src.indexOf("const TRACK_RE="), src.indexOf("const isImgUrl=")).replace(/^(const|let) /gm, "var "));
eval(code);
eval(mergeCode);

let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }

function fresh(inbox) {
  state = { board: { settings: {}, areas: [{ id: "a1", name: "Oblast <1>", type: "links", links: [] }, { id: "a2", name: "Poznámky", type: "text", links: [] }] }, inbox };
  ixSort = null;
}

fresh([{ id: "1", type: "link", url: "https://vimeo.com/1", text: "Video" }, { id: "2", type: "point", text: "Koupit <mléko>" }]);
saved = 0; renderInbox();
const h = els.inbox.innerHTML;
t("vykreslení nic neukládá a štítky nejsou", saved === 0 && !h.includes("ix-tag") && !h.includes("ix-rules") && !h.includes("ix-filter") && !("tags" in state.inbox[0]));
t("seznam: text je escapovaný", h.includes("Koupit &lt;mléko&gt;") && !h.includes("<mléko>"));
t("seznam: u každé věci Mezi úkoly i Do oblasti", ["1", "2"].every((id) => h.includes('data-act="file-task" data-id="' + id + '"') && h.includes('data-act="ix-pick" data-id="' + id + '"')) && !h.includes("data-sel="));
t("seznam: oblasti se ukážou až po Do oblasti", !h.includes('data-act="ix-to-area"'));
ixPick = "2"; renderInbox();
const hp = els.inbox.innerHTML;
t("Do oblasti: poznámce nabídne všechny oblasti", hp.includes('data-act="ix-to-area" data-id="2" data-area="a1"') && hp.includes('data-act="ix-to-area" data-id="2" data-area="a2"') && hp.includes("Oblast &lt;1&gt;") && !hp.includes('data-act="ix-to-area" data-id="1"'));
ixPick = null;
t("nevyhodnocené ${ nikde", !h.includes("${"));
t("hlavička se přepisuje celá i s nástroji", h.startsWith('<div class="sec-head"><h2>') && h.includes('data-act="ix-view" data-v="grid"'));

state.board.settings.inboxView = "grid"; renderInbox();
t("mřížka: karty", (els.inbox.innerHTML.match(/class="ix-card"/g) || []).length === 2 && els.inbox.innerHTML.includes('class="ix-grid"'));
t("mřížka: poznámka jako text v kartě", els.inbox.innerHTML.includes('ix-media ix-txt">Koupit'));

// Roztřídit do oblastí
ixSort = { i: 0, ids: ["1", "2"] }; renderInbox();
let s = els.inbox.innerHTML;
t("roztřídit: jedna karta a počítadlo", s.includes("1 / 2") && (s.match(/ix-card/g) || []).length === 1);
t("roztřídit: oblasti očíslované", s.includes('data-act="ix-sort-area" data-id="1" data-area="a1"><b>1</b> Oblast &lt;1&gt;') && s.includes("<b>2</b> Poznámky"));
t("roztřídit: odkaz jde i mezi úkoly", s.includes('data-act="file-task" data-id="1"'));
t("zařazení odkazu", ixFile(state.inbox[0], A("a1")) && state.board.areas[0].links[0].url === "https://vimeo.com/1" && state.board.areas[0].links[0].title === "Video" && !state.inbox.some((i) => i.id === "1"));
renderInbox(); s = els.inbox.innerHTML;
t("roztřídit: po zařazení naskočí další", s.includes("1 / 1") && s.includes("Koupit"));
t("roztřídit: poznámka nabízí všechny oblasti i úkoly", s.includes('data-area="a1"><b>1</b> Oblast') && s.includes("<b>2</b> Poznámky") && s.includes('data-act="file-task"'));
const keep = state.inbox[0];
t("poznámka do odkazové oblasti jako položka bez adresy", ixFile(keep, A("a1")) && state.board.areas[0].links[1].url === "" && state.board.areas[0].links[1].title === "Koupit <mléko>" && state.inbox.length === 0);
state.inbox = [keep];
t("poznámka v textové oblasti", ixFile(state.inbox[0], A("a2")) && state.board.areas[1].links[0].text === "Koupit <mléko>" && state.inbox.length === 0);
state.inbox = [{ id: "p", type: "point", text: "Recept https://vareni.cz/x" }];
t("poznámka s adresou se v oblasti odkazů stane odkazem", ixFile(state.inbox[0], A("a1")) && state.board.areas[0].links[2].url === "https://vareni.cz/x" && state.board.areas[0].links[2].title === "Recept");
t("obrázek se zařadí jako odkaz na /api/img", (state.inbox = [{ id: "9", type: "image", img: "i9", url: "https://a.cz" }], ixFile(state.inbox[0], A("a1"))) && state.board.areas[0].links[3].url === "https://r.dev/api/img/i9");
state.board.tasks = [];
state.inbox = [{ id: "L", type: "link", url: "https://vimeo.com/2", text: "Film", note: "na víkend" }];
t("odkaz mezi úkoly: název je úkol, adresa v poznámce", ixToTask(state.inbox[0]) && state.board.tasks[0].text === "Film" && state.board.tasks[0].note === "https://vimeo.com/2 · na víkend" && state.inbox.length === 0);
renderInbox();
t("prázdné ke zpracování se schová a roztřídit skončí", els.inbox.style.display === "none" && ixSort === null);
t("Do oblasti i Roztřídit jdou přes ixFile", src.includes('act==="ix-sort-area"||act==="ix-to-area"){if(!ixFile(it,A(el.dataset.area)))return;'));
t("štítky z kódu zmizely", !/ixTag|ixFilter|inboxRules|IX_RULES|L\.tag/.test(src));

// duplicita a hledání
fresh([{ id: "d", type: "link", url: "https://www.vimeo.com/1?utm_source=x", text: "Znovu" }, { id: "e", type: "point", text: "Koupit rohlík" }]);
state.board.areas[0].links.push({ id: "x", url: "https://vimeo.com/1" });
state.board.settings.inboxView = "list"; renderInbox();
t("duplicita: ukáže, ve které oblasti už odkaz je", els.inbox.innerHTML.includes('ix-dup">Už máš v oblasti „Oblast &lt;1&gt;“'));
t("duplicita: poznámka bez adresy nic", (els.inbox.innerHTML.match(/ix-dup/g) || []).length === 1);
q_ = "rohlík"; renderInbox();
t("hledání: jen nalezené a počet", !els.inbox.innerHTML.includes("Znovu") && els.inbox.innerHTML.includes("1 / 2"));
q_ = "nic takového"; renderInbox();
t("hledání: nic nenalezeno", els.inbox.innerHTML.includes('class="empty">Nic<'));
q_ = "";

// slučování inboxu
fresh([{ id: "a" }, { id: "b" }]); inboxKnown.clear(); noteInbox();
state.inbox = state.inbox.filter((i) => i.id !== "b");
const n = mergeInbox([{ id: "c" }, { id: "a" }, { id: "b" }]);
t("ze serveru přibude jen nová položka", n === 1 && state.inbox.map((i) => i.id).join() === "c,a", state.inbox);
const body = JSON.parse(stateBody());
t("uložení posílá známé položky i smazanou", ["a", "b", "c"].every((x) => body.inboxKnown.includes(x)) && body.inbox.length === 2);

// server: PUT /api/state nechá, co klient nezná
const w = fs.readFileSync("src/index.js", "utf8");
t("server slučuje podle inboxKnown", /Array\.isArray\(b\.inboxKnown\)[\s\S]{0,200}getInbox\(env\)\)\.filter\(\(i\) => i && !known\.has\(i\.id\)\)\.concat\(inbox\)/.test(w));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
