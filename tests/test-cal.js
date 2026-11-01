const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");

// regexem to nejde: některé funkce mají závěrečnou složenou závorku na konci
// posledního řádku, ne na vlastním. Počítám tedy závorky.
function grab(name) {
  const at = html.indexOf("function " + name + "(");
  if (at < 0) throw new Error("nenalezeno: " + name);
  const open = html.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) return html.slice(at, i + 1); }
  }
  throw new Error("neuzavrena funkce: " + name);
}
const esc = (x) => String(x);
const L = { watchAllDay: "celý den" };
const state = { board: { settings: { tz: "Europe/Prague" } } };
eval(["watchDateLabel", "watchPad", "watchEndOf", "watchGoogleUrl", "watchCalPayload"].map(grab).join("\n"));

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } };

const hit = { name: "Pan Biedermann a žháři", url: "https://www.hadivadlo.cz/inscenace/pan-biedermann-a-zhari", ticketUrl: "https://www.hadivadlo.cz/inscenace/pan-biedermann-a-zhari#vstupenky" };
const timed = { y: 2026, m: 10, d: 3, hh: 17, mm: 30 };
const allday = { y: 2026, m: 10, d: 3, hh: null, mm: null };

t("popisek s casem", watchDateLabel(timed) === "3. 10. 2026 · 17:30", watchDateLabel(timed));
t("popisek cely den", watchDateLabel(allday) === "3. 10. 2026 · celý den", watchDateLabel(allday));

const end = watchEndOf(timed);
t("konec je o 2.5 h pozdeji", end.hh === 20 && end.mm === 0, end);
const late = watchEndOf({ y: 2026, m: 10, d: 3, hh: 22, mm: 30 });
t("konec pres pulnoc prehodi den", late.d === 4 && late.hh === 1 && late.mm === 0, late);

const g = watchGoogleUrl(hit, timed);
t("google: sablona", g.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE"), g.slice(0, 50));
t("google: rozsah casu", g.includes("&dates=20261003T173000/20261003T200000"), g);
t("google: casove pasmo", g.includes("ctz=Europe%2FPrague"), g);
t("google: nazev", g.includes(encodeURIComponent("Pan Biedermann a žháři")), g);
t("google: v detailu je odkaz na vstupenky", decodeURIComponent(g).includes("#vstupenky"), g);

const ga = watchGoogleUrl(hit, allday);
t("google: cely den je den az nasledujici den", ga.includes("&dates=20261003/20261004"), ga);

const p = watchCalPayload(hit, timed);
t("payload: zacatek", p.start === "2026-10-03T17:30:00", p);
t("payload: konec", p.end === "2026-10-03T20:00:00", p);
t("payload: pasmo", p.tz === "Europe/Prague", p);
t("payload: neni celodenni", !p.allDay, p);
const pa = watchCalPayload(hit, allday);
t("payload: celodenni ma date", pa.allDay === true && pa.date === "2026-10-03", pa);
t("payload: popis nese obe adresy", p.description.includes("hadivadlo.cz") && p.description.includes("#vstupenky"), p.description);

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
