// Kalendář: přesun události na jiný den / čas (délka zůstává), úkol přetažený na jiný den,
// rozložení týdne, mazání ve formuláři. Oblasti: volné rozložení bez mřížky.
const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");
let ok = 0, bad = 0;
function t(label, cond, extra) { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } }
const fn = (name) => { let at = html.indexOf("function " + name + "("); if (at < 0) throw new Error(name); if (html.slice(at - 6, at) === "async ") at -= 6; const open = html.indexOf("{", at); let d = 0; for (let i = open; i < html.length; i++) { if (html[i] === "{") d++; else if (html[i] === "}" && --d === 0) return html.slice(at, i + 1); } };

const calls = [];
let saved = 0, rendered = 0;
const env = {
  calState: { events: [] }, state: { board: { tasks: [] } },
  calApi: async (p, o) => { calls.push([p, JSON.parse(o.body)]); return { status: 200, body: {} }; },
  loadCalEvents: () => {}, alert: () => {}, save: () => saved++, render: () => rendered++, renderCal: () => {},
  tz: () => "Europe/Prague",
};
const code = [fn("toInputLocal"), fn("addDayKey"), fn("daysBetween"), fn("dlFromInput"), fn("dlToInput"), fn("calMoveEvent"), fn("calMoveTask")].join("\n");
const m = new Function(...Object.keys(env), code + "; return {calMoveEvent, calMoveTask};")(...Object.values(env));

(async () => {
  env.calState.events.push({ id: "a", summary: "Zubař", start: "2026-10-31T09:00:00+01:00", end: "2026-10-31T10:30:00+01:00", allDay: false },
    { id: "b", summary: "Dovolená", start: "2026-11-01", end: "2026-11-03", allDay: true });
  await m.calMoveEvent("a", "2026-10-26", 14 * 60);
  t("přesun na jiný den a čas, délka zůstává", calls[0] && calls[0][1].start === "2026-10-26T14:00" && calls[0][1].end === "2026-10-26T15:30", calls[0]);
  await m.calMoveEvent("a", "2026-10-27", null);
  t("bez času se drží původní hodina", calls[1][1].start === "2026-10-27T09:00" && calls[1][1].end === "2026-10-27T10:30");
  await m.calMoveEvent("b", "2026-10-28", null);
  t("vícedenní celodenní se posune celá", calls[2][1].allDay === true && calls[2][1].date === "2026-10-28" && calls[2][1].endDate === "2026-10-29", calls[2]);
  const n = calls.length; await m.calMoveEvent("b", "2026-11-01", null);
  t("na stejný den se nic neposílá", calls.length === n);
  env.state.board.tasks.push({ id: "k", text: "Dárek", due: m.calMoveTask && new Date("2026-10-31T00:00:00").getTime() + 86400000 });
  m.calMoveTask("k", "2026-11-04");
  const d = new Date(env.state.board.tasks[0].due - 1);
  t("úkol dostane nový termín", d.getDate() === 4 && d.getMonth() === 10 && saved === 1);

  t("pohledy Den, vedle sebe / pod sebou, hodiny / jen dny, úkoly", ['data-view="day"', 'data-k="layout" data-v="cols"', 'data-k="layout" data-v="rows"', 'data-k="hours" data-v="1"', 'data-k="hours" data-v="0"', 'data-act="cal-tasks"'].every((x) => html.includes(x)));
  t("událost je přetahovatelná, dny jsou cíle", html.includes('draggable="true" data-calev=') && html.includes('data-drop-date="${key}"'));
  t("ve formuláři události je Smazat", html.includes('<button class="btn danger" data-act="cal-delete" data-id="${esc(ev.id)}"'));
  t("u úkolu je Do kalendáře", html.includes('data-act="task-tocal" data-id="${x.id}"'));
  t("hodiny vedle sebe začínají ve stejné výšce", html.includes("allH=rows?\"\":`min-height:${allN*20+6}px`"));

  t("oblasti: tlačítko Zrušit mřížku u přehledu", html.includes('data-act="toggle-free"') && html.includes('freeOn:"Zrušit mřížku"'));
  t("oblasti: volně položené, klidně přes sebe", html.includes(".board.free>.area{position:absolute;margin:0}") && html.includes("left:${a.fx||0}px;top:${a.fy||0}px;z-index:${a.fz||1};"));
  t("oblasti: bez přichytávání", html.includes("ws=rz.axis!==\"y\"&&!fr?rzSnap(w,rz.W,9):w"));
  t("oblasti: přepnutí měří od desky (nic neposkočí)", /function freeCapture\(\)\{const bd=\$\("boardEl"\),b=bd\.getBoundingClientRect\(\)/.test(html));
  t("oblasti: Pořádek s mřížkou volné rozložení vypne", html.includes("state.board.settings.areaCols=c;state.board.settings.areaFree=false;"));
  console.log("ok=" + ok + " chyb=" + bad);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("  CHYBA výjimka " + e.stack); console.log("ok=" + ok + " chyb=" + (bad + 1)); process.exit(1); });
