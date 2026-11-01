const FIX=process.env.FIXTURES||"tests/fixtures";
const fs = require("fs");
const src = fs.readFileSync("src/index.js", "utf8");
const T = FIX;

function grab(name) {
  const at = src.search(new RegExp("^(function|const) " + name + "\\b", "m"));
  if (at < 0) throw new Error("nenalezeno: " + name);
  const open = src.indexOf("{", at);
  const semi = src.indexOf(";", at);
  if (semi > 0 && (open < 0 || semi < open)) return src.slice(at, semi + 1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        const tail = src.indexOf("\n", i);
        return src.slice(at, tail < 0 ? i + 1 : tail);
      }
    }
  }
  throw new Error("neuzavrene: " + name);
}

const DAY = 86400000;
const local = () => ({ y: 2026, m: 9, d: 22, h: 12, wd: 2 }); // 22. 9. 2026
// regexy s {1,2} se vytáhnout nedají (závorka mate hledání konce deklarace),
// tak je tu držím shodné se src/index.js
const DATE_G = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(20\d\d)?/g;
const TIME_G = /\b(\d{1,2})[:.](\d{2})\b(?!\s*[.\d])/g;
const BACK_WINDOW = 600;
const names = ["stripHtml", "normMap", "normPhrase", "normText", "findPhrase",
  "CZ_MONTHS", "TICKET_RE", "TICKET_HOST_RE", "pad2", "guessYear",
  "extractDates", "findTicketUrl", "allMatches", "datesForPhrase"];
eval(names.map(grab).join("\n"));

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } };
const fmt = (a) => a.map((d) => d.d + "." + d.m + "." + d.y + (d.hh == null ? "" : " " + d.hh + ":" + String(d.mm).padStart(2, "0")));

/* --- syntetický listing, jaký má Národní divadlo --- */
const listing = "Program Září 2026 PDF 22. 9. Úterý Detail představení 19:00 Národní divadlo Činohra Hamlet Titulkovací brýle "
  + "23. 9. Středa Detail představení 19:00 Stavovské divadlo Činohra Revizor "
  + "24. 9. Čtvrtek Detail představení 20:00 Nová scéna Balet Labutí jezero ";
const L1 = datesForPhrase(listing, "Hamlet", "Europe/Prague");
t("z listingu bere jen den sveho predstaveni", L1.length === 1, fmt(L1));
t("den je 22. 9.", L1[0] && L1[0].d === 22 && L1[0].m === 9, L1[0]);
t("cas 19:00 se nacte i kdyz je daleko od data", L1[0] && L1[0].hh === 19 && L1[0].mm === 0, L1[0]);
t("sousedni dny se nepripletou", !fmt(L1).some((x) => x.startsWith("23.") || x.startsWith("24.")), fmt(L1));

/* --- vícekrát na stránce --- */
const twice = listing + "25. 10. Neděle Detail představení 17:00 Národní divadlo Činohra Hamlet dalsi text ";
const L2 = datesForPhrase(twice, "Hamlet", "Europe/Prague");
t("dva vyskyty daji dva terminy", L2.length === 2, fmt(L2));
t("druhy je 25. 10. v 17:00", L2[1] && L2[1].d === 25 && L2[1].m === 10 && L2[1].hh === 17, L2[1]);

/* --- stránka inscenace: datum je AŽ ZA názvem, musí fungovat záloha --- */
const detail = "Pan Biedermann a žháři | HaDivadlo Program Repertoár Vstupenky " + "x".repeat(500)
  + " Nejblizsi reprizy 3.10.2026 17:30 a 5.10.2026 19:30";
const L3 = datesForPhrase(detail, "Biedermann", "Europe/Prague");
t("stranka inscenace: zaloha najde terminy za nazvem", L3.length >= 2, fmt(L3));
t("stranka inscenace: ma cas 17:30", L3.some((d) => d.hh === 17 && d.mm === 30), fmt(L3));

/* --- skutečné stránky --- */
if (fs.existsSync(T + "/nd.html")) {
  const text = stripHtml(fs.readFileSync(T + "/nd.html", "utf8"));
  const nd = datesForPhrase(text, "Hamlet", "Europe/Prague");
  const got = fmt(nd);
  console.log("  Národní divadlo -> " + got.join(" | "));
  // schválně se netvrdí konkrétní zářijové datum: program se mění a test by
  // zestárl. Tvrdí se tvar — najdou se říjnové a listopadové termíny s časem
  // a nehlásí se dva po sobě jdoucí dny, což byla ta původní chyba.
  t("ND: obsahuje 25.10. 17:00", got.includes("25.10.2026 17:00"), got);
  t("ND: obsahuje 27.10. 19:00", got.includes("27.10.2026 19:00"), got);
  t("ND: obsahuje 4.11. 19:00", got.includes("4.11.2026 19:00"), got);
  // Dvě představení ve dvou dnech po sobě jsou běžná (29. a 30. 1. jsou obě
  // skutečné reprízy), takže "po sobě jdoucí dny" není příznak chyby. Tím byl
  // sběr termínů ze sousedních položek programu, a ten se pozná takhle:
  // každý termín musí mít čas a nesmí jich být celý měsíc.
  t("ND: nesbira cizi polozky programu", nd.length <= 8, got);
  t("ND: zadny termin neni bez casu", nd.every((d) => d.hh != null), got);
}
if (fs.existsSync(T + "/ha.html")) {
  const text = stripHtml(fs.readFileSync(T + "/ha.html", "utf8"));
  const ha = datesForPhrase(text, "Biedermann", "Europe/Prague");
  const got = fmt(ha);
  console.log("  HaDivadlo -> " + got.join(" | "));
  t("HaDivadlo porad funguje: 3.10. 17:30", got.some((x) => x.startsWith("3.10.2026 17:30")), got);
  t("HaDivadlo porad funguje: 5.10. 19:30", got.some((x) => x.startsWith("5.10.2026 19:30")), got);
}


/* --- cas az za nazvem, a nesmi se vzit cas nasledujiciho predstaveni --- */
const two = "3.10.2026 Pan Biedermann a zhari 3 . 10 . 2026 17:30 sobota Vstupenky 5.10.2026 Pan Biedermann a zhari 5 . 10 . 2026 19:30 pondeli";
const L4 = datesForPhrase(two, "Pan Biedermann", "Europe/Prague");
t("cas za nazvem se najde", L4.length === 2, fmt(L4));
t("prvni ma 17:30", L4[0] && L4[0].hh === 17 && L4[0].mm === 30, L4[0]);
t("druhy ma 19:30", L4[1] && L4[1].hh === 19 && L4[1].mm === 30, L4[1]);
const steal = "1.1.2027 Kus A 2.1.2027 Kus B 20:00";
const L5 = datesForPhrase(steal, "Kus A", "Europe/Prague");
t("nevezme cas nasledujiciho predstaveni", L5.length === 1 && L5[0].hh === null, fmt(L5));
console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
