const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");

function grab(name) {
  const at = html.indexOf("function " + name + "(");
  if (at < 0) throw new Error("nenalezeno: " + name);
  const open = html.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) return html.slice(at, i + 1); }
  }
  throw new Error("neuzavrene: " + name);
}

const L = { watchAllDay: "celý den", watchNoteStamp: "Hraje se {d}" };
let state = { board: { areas: [], settings: {} } };
eval(["watchNorm", "watchItemName", "watchMatchEntry", "watchDateLabel", "watchPad", "watchStampArea"].map(grab).join("\n"));

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } };

function board() {
  return {
    areas: [{
      id: "a1", name: "Divadlo", type: "links", links: [
        { id: "i1", title: "debata pro loutky - doporučila aisha", url: "https://archa-plus.cz/x", note: "" },
        { id: "i2", title: "Jana z Arku HaDivadlo", url: "https://hadivadlo.cz/y", note: "stará poznámka" },
      ],
    }],
    settings: {},
  };
}

/* --- hledání položky podle názvu hlídání --- */
state.board = board();
const w = { id: "w1", name: "debata", areaId: "a1" };
t("cela fraze jako podretezec", (watchMatchEntry(w).item || {}).id === "i1", watchMatchEntry(w));

const w2 = { id: "w2", name: "debata pro loutky", areaId: "a1" };
t("delsi fraze taky najde", (watchMatchEntry(w2).item || {}).id === "i1");

const w3 = { id: "w3", name: "DEBATA PRO LOUTKY", areaId: "a1" };
t("nezalezi na velikosti pismen", (watchMatchEntry(w3).item || {}).id === "i1");

const w4 = { id: "w4", name: "jana arku", areaId: "a1" };
t("slova kdekoli v nazvu", (watchMatchEntry(w4).item || {}).id === "i2", watchMatchEntry(w4));

const w5 = { id: "w5", name: "Hamlet", areaId: "a1" };
t("co tam neni, se nenajde", watchMatchEntry(w5).item === null, watchMatchEntry(w5));
t("ale oblast se vrati, at jde rict ktera", watchMatchEntry(w5).area.name === "Divadlo");

t("bez propojeni nic", watchMatchEntry({ id: "w6", name: "x" }) === null);
t("smazana oblast nespadne", watchMatchEntry({ id: "w7", name: "x", areaId: "neexistuje" }).area === null);

/* --- zápis termínu do položky --- */
state.board = board();
const d = { y: 2026, m: 10, d: 25, hh: 17, mm: 0 };
t("zapis projde", watchStampArea(w, d) === true);
const it = state.board.areas[0].links[0];
t("popisek ma termin", it.note === "Hraje se 25. 10. 2026 · 17:00", it.note);
t("nastavil se den expirace", it.expiresDay === 20261025, it.expiresDay);

watchStampArea(w, d);
t("druhy zapis tehoz terminu nic nezdvoji", it.note === "Hraje se 25. 10. 2026 · 17:00", it.note);

const d2 = { y: 2026, m: 11, d: 4, hh: 19, mm: 30 };
watchStampArea(w, d2);
t("jiny termin se pripoji", it.note.includes("25. 10. 2026") && it.note.includes("4. 11. 2026"), it.note);
t("expirace se posunula na novy termin", it.expiresDay === 20261104, it.expiresDay);

state.board = board();
const wJana = { id: "wj", name: "Jana z Arku", areaId: "a1" };
watchStampArea(wJana, d);
t("puvodni poznamka zustane", state.board.areas[0].links[1].note.startsWith("stará poznámka · Hraje se"), state.board.areas[0].links[1].note);

t("bez shody se nezapisuje", watchStampArea({ id: "wx", name: "Hamlet", areaId: "a1" }, d) === false);

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
