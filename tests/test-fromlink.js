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
let state = { board: { areas: [], watches: [], settings: {} } };
eval(["watchNorm", "watchItemName", "watchPhraseFromTitle", "watchForLink"].map(grab).join("\n"));

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } };

/* --- fráze z názvu položky --- */
const P = watchPhraseFromTitle;
t("pomlcka odrizne poznamku", P("debata pro loutky - doporučila aisha") === "debata pro loutky", P("debata pro loutky - doporučila aisha"));
t("dlouha pomlcka taky", P("Maryša – tip od mámy") === "Maryša", P("Maryša – tip od mámy"));
t("zavorka taky", P("Hamlet (Nároďák, prý dobrý)") === "Hamlet", P("Hamlet (Nároďák, prý dobrý)"));
t("svisitko taky", P("Revizor | Stavovské") === "Revizor", P("Revizor | Stavovské"));
t("tecka uprostred taky", P("Tosca · opera") === "Tosca", P("Tosca · opera"));
t("cisty nazev zustane cely", P("Pan Biedermann a žháři") === "Pan Biedermann a žháři", P("Pan Biedermann a žháři"));
t("spojovnik bez mezer se nekrati", P("Jean-Paul") === "Jean-Paul", P("Jean-Paul"));
t("prazdno da prazdno", P("") === "");
t("orizne mezery", P("  Hamlet  ") === "Hamlet", P("  Hamlet  "));

/* --- rozpoznání už založeného hlídání --- */
state.board.areas = [{ id: "a1", name: "Divadlo", links: [{ id: "i1", title: "debata pro loutky - doporučila aisha", url: "https://x.cz/a" }] }];
const link = state.board.areas[0].links[0];

t("bez hlidani nic", watchForLink("a1", link) === null);

state.board.watches = [{ id: "w1", areaId: "a1", phrase: "debata pro loutky" }];
t("najde existujici hlidani", (watchForLink("a1", link) || {}).id === "w1", watchForLink("a1", link));

state.board.watches = [{ id: "w1", areaId: "a1", phrase: "DEBATA PRO LOUTKY" }];
t("nezalezi na velikosti pismen a diakritice", (watchForLink("a1", link) || {}).id === "w1");

state.board.watches = [{ id: "w1", areaId: "jina", phrase: "debata pro loutky" }];
t("hlidani z jine oblasti se nepocita", watchForLink("a1", link) === null);

state.board.watches = [{ id: "w1", areaId: "a1", phrase: "Hamlet" }];
t("jine hlidani ve stejne oblasti se nepocita", watchForLink("a1", link) === null);

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
