// Vykreslí rohovou nabídku panelu mimo prohlížeč a ověří tokeny ve stylech.
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
const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const L = {
  areaMenu: "Možnosti", tabColor: "Barva záložky", bodyColor: "Barva těla", clearColors: "Zrušit barvy",
  hideArea: "Schovat", rename: "Přejmenovat", optLinks: "Odkazy", optText: "Text a poznámky",
  resetSize: "Vrátit velikost", del: "Smazat", minAreas: "Sbalit", expandAreas: "Rozbalit",
};
const lbT = () => ({ viewCards: "Karty", viewList: "Seznam" }), e2e = null, lkT = () => ({}), lookT = () => ({}), state = { board: { settings: {} } };
eval(grab("areaMenuHtml"));

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + String(extra).slice(0, 200) : "")); } };

/* --- rohová nabídka --- */
const a = { id: "a1", name: "Divadlo", color: "#5B3A57", w: 320, h: 400 };
const m = areaMenuHtml(a, false);
t("nabidka se vykresli", m.includes('class="area-menu"'));
t("nese id oblasti", m.includes('data-area-menu="a1"'));
for (const act of ["toggle-area", "hide-area", "rename-area", "toggle-type", "area-color", "area-bodycolor", "clear-colors", "reset-size", "del-area"]) {
  t("ma polozku " + act, m.includes('data-act="' + act + '"'), m.slice(0, 120));
}
t("barva zalozky je predvyplnena", m.includes('data-act="area-color" data-id="a1" value="#5B3A57"'), m.match(/area-color[^>]*/));
t("barva tela je bila, kdyz neni nastavena", m.includes('data-act="area-bodycolor" data-id="a1" value="#ffffff"'), m.match(/area-bodycolor[^>]*/));
t("mazani je oznacene jako nebezpecne", /class="danger"[^>]*del-area/.test(m), m.match(/<button class="danger"[^>]*/));
t("nezustala nevyhodnocena sablona", !m.includes("${"), m.match(/\$\{[^}]{0,40}/));

const mb = areaMenuHtml({ id: "a2", color: "", bodyColor: "#cce5ff" }, true);
t("zvolena barva tela se predvyplni", mb.includes('data-act="area-bodycolor" data-id="a2" value="#cce5ff"'), mb.match(/area-bodycolor[^>]*/));
t("sbalena oblast nabizi rozbalit", mb.includes("Rozbalit"), mb.match(/toggle-area[^<]*<?[^<]*/));
t("bez rozmeru nenabizi vraceni velikosti", !mb.includes('data-act="reset-size"'));

/* --- gradient v šabloně oblasti --- */
const tpl = html.slice(html.indexOf("const bodyBg="), html.indexOf("const sized="));
t("telo pouziva prechod do bile pres safeTint", /linear-gradient\(180deg,\$\{safeTint\(a\.bodyColor\)\},var\(--panel\)\)/.test(tpl), tpl);
t("bez bodyColor se nic nevykresli", /a\.bodyColor&&!lookDark\(\)\?/.test(tpl) && /:""/.test(tpl), tpl);
t("zalozka ma jen jemny nadech", /acol\}22,transparent/.test(tpl), tpl);

/* --- tokeny ve stylech --- */
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
t("platno je bile", /--paper:#ffffff/.test(css));
t("linka je pencil gray", /--line:#ebebeb/.test(css));
t("inkoust neni cerny", /--ink:#252525/.test(css));
t("popisky maji vlastni token a projdou 4.5:1", /--caption:#767676/.test(css));
t("rozbite odkazy maji tmavou cervenou", /--broken:#7a2e2e/.test(css));
t("zadny box-shadow v celem souboru", !/box-shadow/.test(html), (html.match(/box-shadow[^;]*/g) || []).slice(0, 2));
t("pismo se nenacita z Googlu", !html.includes("fonts.googleapis") && !html.includes("fonts.gstatic"));
t("citaty zustaly kurzivou", /\.quote\{[^}]*font-style:italic/.test(css), css.match(/\.quote\{[^}]*/));
t("nadpis desky spadl na 15px", /\.mast h1\{[^}]*font-size:15px/.test(css), css.match(/\.mast h1\{[^}]*/));
// Okna (oblasti, panely, bloky, moduly) mají na přání jemné zaoblení 8px.
t("okna maji jemne zaobleni 8px", ["\\.area\\{background", "\\.panel\\{display", "\\.block\\{border", "\\.modsec\\{"].every((k) => new RegExp(k + "[^}]*border-radius:var\\(--r\\)").test(css)) && /:root\{[^}]*--r:8px/.test(css));
t("tlacitka maji 8px", /\.btn\{[^}]*border-radius:var\(--r\)/.test(css), css.match(/\.btn\{[^}]*/));
t("primarni tlacitko neni vyplnene", /\.btn\.primary\{background:var\(--panel\)/.test(css), css.match(/\.btn\.primary\{[^}]*/));

// měkké zaoblení si uživatelka zapíná sama (data-radius="soft"), výchozí vzhled ho nemá
const big = css.replace(/:root\[data-radius="soft"\][^{]*\{[^}]*\}/g, "").match(/border-radius:(1[0-9]|2[0-9]|[3-9][0-9]|999)px/g) || [];
t("nikde velke zaobleni", big.length === 0, big);

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
