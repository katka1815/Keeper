// Dok panelů (skládání vedle sebe / nad sebe) a vykreslení Nastavení mimo prohlížeč.
const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");
function grab(name) {
  const at = html.indexOf("function " + name + "(");
  if (at < 0) throw new Error("nenalezeno: " + name);
  const open = html.indexOf("{", at);
  let d = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
}
let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra).slice(0, 200) : "")); } };

/* --- rozložení doku --- */
eval(grab("dockRows"));
const J = (x) => JSON.stringify(x);
t("jeden panel je sam", J(dockRows(["a"])) === J([["a"]]), dockRows(["a"]));
t("druhy se otevre vlevo od prvniho", J(dockRows(["a", "b"])) === J([["b", "a"]]), dockRows(["a", "b"]));
t("treti jde nad dvojici", J(dockRows(["a", "b", "c"])) === J([["c"], ["b", "a"]]), dockRows(["a", "b", "c"]));
t("ctvrty se prida vlevo od tretiho", J(dockRows(["a", "b", "c", "d"])) === J([["d", "c"], ["b", "a"]]), dockRows(["a", "b", "c", "d"]));
t("prazdny dok nema radky", J(dockRows([])) === "[]");

/* --- struktura stránky --- */
const dockAt = html.indexOf('<div class="dock" id="dock">'), dockEnd = html.indexOf('<section class="inbox"');
const dockHtml = html.slice(dockAt, dockEnd);
const DOCK = eval(html.match(/const DOCK=(\[[^\]]*\])/)[1]);
t("vsechny panely lezi v doku", DOCK.every((id) => dockHtml.includes('id="' + id + '"')), DOCK.filter((id) => !dockHtml.includes('id="' + id + '"')));
t("zadny panel mimo dok", (html.match(/<section class="panel"/g) || []).length === DOCK.length);
t("dok ma krizek zavrit vse", /data-act="close-all-panels"/.test(dockHtml));
t("zavrit vse je obslouzene", html.includes('act==="close-all-panels"'));
const order = ["quickAdd", "dock", "inbox", "blocksWrapEl", "tasksEl", "search", "boardEl"].map((id) => html.indexOf('id="' + id + '"'));
t("poradi stranky: rychly ukol, panely, ke zpracovani, cile, ukoly, hledani, deska", order.every((v, i) => v > 0 && (!i || v > order[i - 1])), order);

/* --- Nastavení se vykreslí (dřív padalo na nedefinovaném b) --- */
const el = {};
const $ = (id) => (el[id] = el[id] || { innerHTML: "", style: {} });
const esc = (x) => String(x == null ? "" : x);
const L = new Proxy({}, { get: (_, k) => "«" + String(k) + "»" });
const state = { board: { settings: { tz: "Europe/Prague", lang: "cs", features: {} }, areas: [{ id: "a1", name: "Divadla" }] } };
const tzQuery = "", cityOf = () => "Praha", tzOffsetLabel = () => "+2";
let tzListed = false; const renderTzList = () => { tzListed = true; };
eval(html.match(/const PLACE={[^}]*};/)[0].replace("const ", "var ")); // const z evalu nevyleze
eval(html.match(/const MOD={[^}]*};/)[0].replace("const ", "var "));
eval(html.match(/const DOCK_BTN=\{[^\n]*\};/)[0].replace("const ", "var "));
eval(grab("modTitle"));
eval(grab("secMode"));
eval(grab("secCtl"));
const libSettingsHtml = () => "", lkSettingsHtml = () => "", gdSettingsHtml = () => "", lookSettingsHtml = () => "", lookT = () => ({ adv: "Pokročilé" });
eval(grab("renderSettings"));
let err = null; try { renderSettings(); } catch (e) { err = e.message; }
t("nastaveni se vykresli bez chyby", err === null, err);
const sp = el.settingsPanel.innerHTML;
t("nastaveni nabizi oblasti pro hlidac", sp.includes('value="a1"'), sp.slice(0, 120));
t("nastaveni ma skupiny", ["setGGeneral", "setGLook", "setGTasks", "setGWatch"].every((k) => sp.includes("«" + k + "»")));
t("nastaveni vola seznam pasem", tzListed);

t("nastaveni nabizi umisteni sekci i modulu", ["blocks","tasks","areas","cal","watch","faq"].every((k) => sp.includes('data-act="set-secmode" data-sec="' + k + '"')));

/* --- sekce na ploše / v liště --- */
state.board.settings.secMode = { blocks: "min", tasks: "tab", areas: "bogus" };
t("neznamy rezim je rozbaleny", secMode("areas") === "open");
t("modul je vychozi jen v liste", secMode("cal") === "tab" && secMode("faq") === "tab");
state.board.settings.secMode.cal = "min"; state.board.settings.secMode.money = "bogus";
t("modul jde na plochu sbaleny", secMode("cal") === "min" && secMode("money") === "tab");
t("sbalena sekce nabizi rozbalit", secCtl("blocks").includes("«secExpand»") && secCtl("blocks").includes('data-act="sec-tab"'));
t("sekce v liste ma krizek a navrat", secCtl("tasks").includes('data-act="close-panel" data-panel="tasksEl"') && secCtl("tasks").includes('data-act="sec-page"'));
t("lista ma taby pro vsechny tri sekce", ["blocks","tasks","areas"].every((k) => html.includes('data-act="open-sec" data-sec="' + k + '"')));
t("sekce lezi na plose v #layout", ["inbox", "blocksWrapEl", "tasksEl", "areasWrap"].every((id) => { const a = html.indexOf('<div id="layout">'), b = html.indexOf('<div id="layMark">'); const i = html.indexOf('id="' + id + '"'); return a > 0 && i > a && i < b; }));

/* --- plocha: řady a přetahování --- */
eval(html.match(/const LAY=\{[^\n]*\};/)[0].replace("const ", "var "));
eval(grab("layoutRows"));
eval(grab("layDrop"));
t("bez ulozeneho rozlozeni je kazda sekce v sve rade", J(layoutRows({})) === J([["inbox"], ["goals"], ["tasks"], ["areas"]]), layoutRows({}));
t("rozlozeni zahodi nezname a zdvojene klice a doplni chybejici", J(layoutRows({ layout: [["tasks", "bogus", "tasks"], "x", ["goals"]] })) === J([["tasks"], ["goals"], ["inbox"], ["areas"]]), layoutRows({ layout: [["tasks", "bogus", "tasks"], "x", ["goals"]] }));
const R0 = [["goals"], ["tasks"], ["areas"]];
let d = layDrop(R0, {}, "tasks", { type: "row", anchor: "goals", pos: "after" });
t("ukoly vedle cilu jdou do stejne rady", J(d.rows) === J([["goals", "tasks"], ["areas"]]), d.rows);
t("sekce pustena vedle jine se prizpusobi", d.fit.tasks === true, d.fit);
t("sekce, ktera tam byla, si necha svou velikost", !d.fit.goals, d.fit);
let d2 = layDrop(d.rows, d.fit, "tasks", { type: "newrow", anchor: "areas", pos: "after" });
t("puštena mimo radu dostane vlastni radu", J(d2.rows) === J([["goals"], ["areas"], ["tasks"]]), d2.rows);
t("mimo radu se vrati ke svym rozmerum", !d2.fit.tasks, d2.fit);
let d3 = layDrop([["goals", "tasks"], ["areas"]], { goals: true, tasks: true }, "tasks", { type: "newrow", anchor: "goals", pos: "before" });
t("kdo zustane v rade sam, taky se narovna", !d3.fit.goals && J(d3.rows) === J([["tasks"], ["goals"], ["areas"]]), [d3.fit, d3.rows]);
t("posunuti nahoru funguje", J(layDrop(R0, {}, "areas", { type: "newrow", anchor: "goals", pos: "before" }).rows) === J([["areas"], ["goals"], ["tasks"]]));
t("pusteni na sebe nic nedela", layDrop(R0, {}, "goals", { type: "row", anchor: "goals", pos: "before" }) === null);
t("bez cile nic nedela", layDrop(R0, {}, "goals", null) === null);
t("vlevo od jine sekce", J(layDrop(R0, {}, "areas", { type: "row", anchor: "tasks", pos: "before" }).rows) === J([["goals"], ["areas", "tasks"]]));
t("nova oblast jde zalozit i z hlavicky odkazu", (() => { const i = html.indexOf('<h2 id="areasTitle">'); return html.slice(i, i + 300).includes('data-act="add-area"'); })());
t("mobil ma tlacitko upravit plochu", /id="layEditBtn"/.test(html) && /@media\(max-width:640px\)\{#layEditBar\{display:flex\}\}/.test(html));
t("prstem se tahne jen v rezimu uprav", /e\.pointerType!=="mouse"&&!document\.body\.classList\.contains\("lay-edit"\)/.test(html));
t("v rezimu uprav jsou sekce jen nadpisy", /body\.lay-edit #layout \.lrow>section>:not\(\.sec-head\)\{display:none!important\}/.test(html));
t("nadpis v rezimu uprav nescrolluje stranku", /body\.lay-edit #layout \.lrow>section>\.sec-head\{[^}]*touch-action:none/.test(html));
t("na uzke obrazovce se cil hleda svisle", /if\(layNarrow\(\)\)return layTargetNarrow\(y,key\)/.test(html));
t("rucni zmena velikosti zrusi prizpusobeni", /delete sf\[key\]/.test(html) && /el\.classList\.remove\("fit"\)/.test(html));
t("oblasti se jmenuji Odkazy a pripominky", html.includes('areasTitle:"Odkazy a připomínky"'));

/* --- kontrast --- */
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
t("rychly ukol ma inkoustovy ramecek", /\.quickadd\{[^}]*border:1px solid var\(--ink\)/.test(css));
t("krizek zavrit vse zaplavi 35% cervenou", /--flood:rgba\(220,38,38,\.35\)/.test(css));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
