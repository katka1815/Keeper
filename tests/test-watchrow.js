// Vykreslí řádek hlídání mimo prohlížeč — v přehledu i v režimu úpravy.
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
  watchUrlsShort: "adres", watchDaily: "denně", watchWeekly: "týdně", watchMonthly: "měsíčně",
  watchDeepShort: "do hloubky", watchLast: "Naposled", watchNever: "zatím nikdy", watchPages: "stránek",
  watchRunNow: "Zkontrolovat teď", watchEditBtn: "Upravit", watchPause: "Pozastavit", watchResume: "Spustit",
  watchDelAsk: "Smazat tohle hlídání?", watchEditTitle: "Úprava hlídání", watchName: "Název", watchPhrase: "Co hledat",
  watchUrls: "Kde hledat", watchSleep: "pozastavit", watchDelete: "smazat", watchKeep: "hlídat dál",
  watchLinkArea: "Prolinkovat s oblastí", watchLinkNone: "— nepropojovat —", watchDeep: "Hloubka",
  watchSave: "Uložit změny", watchCancel: "Zrušit",
};
let watchEditId = null;
let state = { board: { areas: [{ id: "a1", name: "Divadlo" }, { id: "a2", name: "Muzikály" }], watches: [], settings: {} } };
eval([grab("watchDayLabel"), grab("watchRowHtml")].join("\n"));

const w = {
  id: "w1", name: "Pan Biedermann", phrase: "Biedermann",
  urls: ["https://www.hadivadlo.cz/inscenace/pan-biedermann-a-zhari", "https://www.hadivadlo.cz/program"],
  deep: false, intervalDays: 7, afterFound: "sleep", areaId: "a1", lastRunDay: 20260922, lastPages: 2, paused: false,
};

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + String(extra).slice(0, 220) : "")); } };

/* --- přehled --- */
const view = watchRowHtml(w);
t("prehled ukaze nazev", view.includes("Pan Biedermann"));
t("prehled ukaze pocet adres", view.includes("2 adres"), view.match(/adres[^<]*/));
t("prehled ukaze interval", view.includes("týdně"));
t("prehled ukaze datum posledniho behu", view.includes("22.09.2026"), view.match(/Naposled[^<]*/));
t("je tam tlacitko Upravit", view.includes('data-act="watch-edit" data-id="w1"'), view.match(/watch-edit[^>]*/));
t("puvodni tlacitka zustala", ["watch-run", "watch-pause", "watch-del"].every((x) => view.includes('data-act="' + x + '"')));
t("v prehledu nejsou editacni pole", !view.includes('data-we="'), view);
t("nezustala nevyhodnocena sablona", !view.includes("${"), view.match(/\$\{[^}]{0,40}/));

/* --- režim úpravy --- */
watchEditId = "w1";
const edit = watchRowHtml(w);
t("editace ma nadpis", edit.includes("Úprava hlídání"));
t("editace ma pole s adresami", edit.includes('data-we="urls"'));
t("adresy jsou predvyplnene kazda na radek",
  edit.includes("https://www.hadivadlo.cz/inscenace/pan-biedermann-a-zhari\nhttps://www.hadivadlo.cz/program"),
  (edit.match(/<textarea[\s\S]*?<\/textarea>/) || [""])[0]);
t("fraze je predvyplnena", edit.includes('data-we="phrase" value="Biedermann"'), edit.match(/data-we="phrase"[^>]*/));
t("nazev je predvyplneny", edit.includes('value="Pan Biedermann"'));
t("interval ma vybrano tydne", /<option value="7" selected>týdně<\/option>/.test(edit), edit.match(/<select data-we="every">[\s\S]*?<\/select>/));
t("interval nema vybrano vic moznosti", (edit.match(/selected>(denně|týdně|měsíčně)/g) || []).length === 1, edit.match(/selected>[^<]*/g));
t("oblast ma vybrano Divadlo", /<option value="a1" selected>Divadlo<\/option>/.test(edit), edit.match(/<select data-we="area">[\s\S]*?<\/select>/));
t("nabizi obe oblasti", edit.includes("Muzikály"));
t("hloubka je odskrtnuta", !/data-we="deep" checked/.test(edit));
t("je tam Ulozit i Zrusit", edit.includes('data-act="watch-edit-save" data-id="w1"') && edit.includes('data-act="watch-edit-cancel"'));
t("v editaci nejsou tlacitka prehledu", !edit.includes('data-act="watch-run"'), edit.match(/watch-run[^>]*/));
t("nezustala nevyhodnocena sablona v editaci", !edit.includes("${"), edit.match(/\$\{[^}]{0,40}/));

/* --- hloubkový režim a pauza --- */
watchEditId = null;
const paused = watchRowHtml(Object.assign({}, w, { paused: true, deep: true, intervalDays: 1 }));
t("pozastavene je zesvetlene", paused.includes("opacity:.6"));
t("pozastavene nabizi Spustit", paused.includes("Spustit"));
t("hloubka se ukazuje", paused.includes("do hloubky"));
t("denni interval se ukazuje", paused.includes("denně"));

watchEditId = "w1";
const deepEdit = watchRowHtml(Object.assign({}, w, { deep: true }));
t("zapnuta hloubka je zaskrtnuta", /data-we="deep" checked/.test(deepEdit));

watchEditId = null;
const fresh = watchRowHtml(Object.assign({}, w, { lastRunDay: 0, lastPages: 0 }));
t("hlidani bez behu rika zatim nikdy", fresh.includes("zatím nikdy"), fresh.match(/Naposled[^<]*/));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
