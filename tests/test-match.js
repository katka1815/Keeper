const FIX=process.env.FIXTURES||"tests/fixtures";
const fs = require("fs");
const src = fs.readFileSync("src/index.js", "utf8");

function grab(name) {
  const fn = new RegExp("^function " + name + "\\b[\\s\\S]*?^\\}", "m");
  const cn = new RegExp("^const " + name + " = [^\\n]+", "m");
  const ob = new RegExp("^const " + name + " = \\{[\\s\\S]*?^\\};", "m");
  const m = src.match(fn) || src.match(ob) || src.match(cn);
  if (!m) throw new Error("nenalezeno: " + name);
  return m[0];
}

const DAY = 86400000;
// stub: 22. 9. 2026, 12:00 místního času
const local = () => ({ y: 2026, m: 9, d: 22, h: 12, wd: 2 });

const code = ["stripHtml", "normMap", "normPhrase", "normText", "findPhrase",
  "collectDeepLinks", "CZ_MONTHS", "TICKET_RE", "TICKET_HOST_RE", "pad2",
  "guessYear", "extractDates", "findTicketUrl"].map(grab).join("\n");
const DEEP_RE = /program|repertoar|repertoire|hraje|predstaveni|inscenace/;
eval(code);

let ok = 0, bad = 0;
function t(label, cond, extra) {
  if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); }
}
const snip = (text, phrase) => { const r = findPhrase(text, phrase); return r && r.snippet; };

/* --- hledání fráze --- */
t("presna shoda", (snip("Dnes hrajeme Maryšu v Redutě", "Maryšu") || "").includes("Maryšu"));
t("bez diakritiky v dotazu", (snip("Dnes hrajeme Maryšu", "Marysu") || "").includes("Maryšu"));
t("velka pismena", (snip("PROGRAM: MARYŠA", "maryša") || "").includes("MARYŠA"));
t("nenalezeno", findPhrase("Dnes hrajeme Hamleta", "Maryša") === null);
t("pres znacku", (snip(stripHtml("<b>Mary</b>ša dnes"), "Maryša") || "").includes("Mary ša"));
t("prazdna fraze", findPhrase("cokoli", "") === null);
t("siroke okno je delsi nez uryvek", (() => {
  const text = "x".repeat(300) + " Maryša " + "y".repeat(300);
  const r = findPhrase(text, "Maryša");
  return r.wide.length > r.snippet.length;
})());

/* --- termíny --- */
const d1 = extractDates("Nejbližší reprízy: 3.10.2026 17:30 | 5.10.2026 19:30", "Europe/Prague");
t("dva termíny", d1.length === 2, d1);
t("prvni termin je 3.10.2026 17:30", d1[0] && d1[0].y === 2026 && d1[0].m === 10 && d1[0].d === 3 && d1[0].hh === 17 && d1[0].mm === 30, d1[0]);
t("druhy termin je 5.10.2026 19:30", d1[1] && d1[1].d === 5 && d1[1].hh === 19 && d1[1].mm === 30, d1[1]);
t("sousedni datum se nepovazuje za cas", !d1.some((x) => x.hh === 5 && x.mm === 10), d1);

const d2 = extractDates("hrajeme 3. 10. od 19:00", "Europe/Prague");
t("mezery v datu", d2.length === 1 && d2[0].d === 3 && d2[0].m === 10 && d2[0].hh === 19, d2);
t("chybejici rok se doplni", d2[0] && d2[0].y === 2026, d2[0]);

const d3 = extractDates("premiéra 3. ledna bez roku", "Europe/Prague");
t("mesic slovem", d3.length === 1 && d3[0].m === 1 && d3[0].d === 3, d3);
t("davno minuly termin bere pristi rok", d3[0] && d3[0].y === 2027, d3[0]);

t("nesmysly se zahodi", extractDates("32.13.2026 a 99:99", "Europe/Prague").length === 0, extractDates("32.13.2026 a 99:99", "Europe/Prague"));
t("bez data nic", extractDates("žádný termín tu není", "Europe/Prague").length === 0);
t("duplicity se slucuji", extractDates("3.10.2026 a znovu 3.10.2026", "Europe/Prague").length === 1);
t("nejvys sest terminu", extractDates(Array.from({ length: 12 }, (_, i) => (i + 1) + ".11.2026").join(" "), "Europe/Prague").length === 6);

/* --- odkaz na vstupenky --- */
const base = "https://divadlo.cz/inscenace/kus";
t("cizi prodejna vyhrava", findTicketUrl(
  '<a href="/vstupenky">Vstupenky</a><a href="https://goout.net/cs/akce/xyz/">Koupit</a>', base
) === "https://goout.net/cs/akce/xyz/");
t("kotva pred cestou na webu", findTicketUrl(
  '<a href="/vstupenky">Vstupenky</a><a href="#vstupenky">Koupit vstupenky</a>', base
) === "https://divadlo.cz/inscenace/kus#vstupenky");
t("prazdna kotva se preskoci", findTicketUrl('<a href="#">Vstupenky</a>', base) === "");
t("odkaz bez vstupenek se ignoruje", findTicketUrl('<a href="/kontakt">Kontakt</a>', base) === "");

/* --- skutečná stránka HaDivadla, pokud je stažená --- */
const real = FIX + "/ha.html";
if (fs.existsSync(real)) {
  const html = fs.readFileSync(real, "utf8");
  const text = stripHtml(html);
  const dd = extractDates(text, "Europe/Prague");
  t("HaDivadlo: nasel termin 3.10.2026", dd.some((x) => x.d === 3 && x.m === 10 && x.y === 2026), dd.slice(0, 4));
  t("HaDivadlo: nasel termin 5.10.2026", dd.some((x) => x.d === 5 && x.m === 10 && x.y === 2026), dd.slice(0, 4));
  const tu = findTicketUrl(html, "https://www.hadivadlo.cz/inscenace/pan-biedermann-a-zhari");
  t("HaDivadlo: nasel odkaz na vstupenky", /vstupenk/i.test(tu), tu);
  console.log("  HaDivadlo -> termínů: " + dd.length + ", vstupenky: " + tu);
}


const dm=extractDates("Repríza 3.10.2026 a detail 3.10.2026 17:30","Europe/Prague");
t("den bez casu se slouci s casem",dm.length===1&&dm[0].hh===17,dm);
const dm2=extractDates("3.10.2026 17:30 a take 3.10.2026 19:30","Europe/Prague");
t("dva casy v jednom dni zustanou",dm2.length===2,dm2);
console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
