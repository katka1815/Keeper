// Projede applySecSizes proti minimálnímu náhradnímu DOM, aby se ověřilo,
// že úchyty vznikají, nezdvojují se a rozměry se opravdu nasazují.
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
function grabConst(name) {
  const m = html.match(new RegExp("^const " + name + "=[^\\n]+", "m"));
  if (!m) throw new Error("nenalezeno: const " + name);
  return m[0];
}

/* --- náhradní DOM --- */
class El {
  constructor(tag) {
    this.tag = tag; this.children = []; this.dataset = {}; this.style = {};
    this.className = ""; this.title = "";
    this.offsetWidth = 500; this.offsetHeight = 300;
    const self = this;
    this.classList = {
      add(c) { if (!self.className.split(" ").includes(c)) self.className = (self.className + " " + c).trim(); },
      remove(c) { self.className = self.className.split(" ").filter((x) => x && x !== c).join(" "); },
      contains(c) { return self.className.split(" ").includes(c); },
    };
  }
  appendChild(c) { this.children.push(c); c.parentElement = this; return c; }
  querySelector(sel) {
    const cls = sel.replace(".", "");
    return this.children.find((c) => c.className.split(" ").includes(cls)) || null;
  }
}
const document = { createElement: (t) => new El(t) };
const els = { blocksWrapEl: new El("section"), tasksEl: new El("section"), inbox: new El("section"), areasWrap: new El("section") };
const $ = (id) => els[id] || null;
const L = { resizeReset: "Táhni za kraj" };
let saved = 0;
const save = () => { saved++; };
let state = { board: { settings: {} } };

// const uvnitř eval nevyleze ven, tak ho vyhodnotím jako výraz
const SECS = eval("(" + grabConst("SECS").replace(/^const SECS=/, "").replace(/;$/, "") + ")");
eval([grab("secSizes"), grab("applySecSizes")].join("\n"));

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } };

/* --- první běh vytvoří úchyty --- */
applySecSizes();
for (const [id, key] of SECS) {
  const el = els[id];
  t(key + ": ma tri uchyty", el.children.length === 3, el.children.length);
  t(key + ": uchyty nesou klic", el.children.every((c) => c.dataset.sec === key), el.children.map((c) => c.dataset.sec));
  const axes = el.children.map((c) => c.dataset.axis).sort();
  t(key + ": osy jsou x, y a roh", JSON.stringify(axes) === JSON.stringify(["both", "x", "y"]), axes);
  t(key + ": roh je posledni, aby prebil kraje", el.children[2].className === "sec-rz", el.children.map((c) => c.className));
  t(key + ": bez ulozene velikosti neni sized", !el.classList.contains("sized"));
}

/* --- druhý běh nesmí zdvojit --- */
applySecSizes();
t("opakovane volani uchyty nezdvoji", SECS.every(([id]) => els[id].children.length === 3), SECS.map(([id]) => els[id].children.length));

/* --- uložená velikost se nasadí --- */
state.board.settings.secSize = { tasks: { w: 640, h: 320 } };
applySecSizes();
t("ulozena sirka se nasadi", els.tasksEl.style.width === "640px", els.tasksEl.style.width);
t("ulozena vyska se nasadi", els.tasksEl.style.height === "320px", els.tasksEl.style.height);
t("sekce s rozmerem dostane sized", els.tasksEl.classList.contains("sized"));
t("ostatni sekce zustanou bez rozmeru", els.inbox.style.width === "" && !els.inbox.classList.contains("sized"), [els.inbox.style.width, els.inbox.className]);

/* --- jen výška --- */
state.board.settings.secSize = { goals: { h: 200 } };
applySecSizes();
t("jen vyska necha sirku prazdnou", els.blocksWrapEl.style.width === "" && els.blocksWrapEl.style.height === "200px", [els.blocksWrapEl.style.width, els.blocksWrapEl.style.height]);
t("drive nastavena sekce se uklidi", els.tasksEl.style.width === "" && !els.tasksEl.classList.contains("sized"), [els.tasksEl.style.width, els.tasksEl.className]);

/* --- nulové rozměry se berou jako bez rozměru --- */
state.board.settings.secSize = { tasks: { w: 0, h: 0 } };
applySecSizes();
t("nulovy rozmer neni sized", !els.tasksEl.classList.contains("sized"), els.tasksEl.className);

/* --- zapojení ve zdroji --- */
t("applySecSizes se vola po prekresleni", /applyAreaScroll\(\);\s*\n\s*applySecSizes\(\);/.test(html));
t("Cile maji id", html.includes('<section class="block-wrap" id="blocksWrapEl">'));
t("dvojklik na roh resetuje", /dblclick[\s\S]{0,200}sec-rz[\s\S]{0,200}delete secSizes\(\)/.test(html));
t("tazeni za kraj meni jen jeden rozmer", /if\(secRz\.axis!=="y"\)w=/.test(html) && /if\(secRz\.axis!=="x"\)h=/.test(html));
t("sekce s rozmerem roluje jen telem", /section\.sized>\.sec-body\{[^}]*overflow:auto/.test(html));
t("uchyty se obnovi az po vykresleni vsech sekci", /applySecModes\(\);\s*\n\s*applySecSizes\(\);\s*\n\s*libAfterRender\(\);\s*\n\s*lookAfterRender\(\);\s*\n\}/.test(html));
t("ukoly si uchyty obnovi i pri samostatnem prekresleni", /add-task[^\n]*\n\s*applySecSizes\(\);\}/.test(html));
t("ke zpracovani si uchyty obnovi taky", /ib\.innerHTML=[^\n]*\n\s*applySecSizes\(\);\}/.test(html));
t("odkazy a pripominky jdou zvetsovat", SECS.some(([id]) => id === "areasWrap"));
t("kazda sekce ma hlavicku a telo", ['id="blocksWrapEl"', 'id="areasWrap"'].every((m) => { const i = html.indexOf(m); return html.slice(i, i + 700).includes('class="sec-body"'); }));
t("na mobilu se rozmer ignoruje", /section\.sized\{width:auto!important;height:auto!important;overflow:visible\}/.test(html));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
