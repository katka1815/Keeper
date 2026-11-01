// Vykreslí šablonu položky v oblasti mimo prohlížeč a podívá se na výsledné HTML.
// Testuje přesně to, co jsem do šablony vložil — vnoření a escapování.
const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");

function grabFn(name) {
  const at = html.indexOf("function " + name + "(");
  if (at < 0) throw new Error("nenalezeno: " + name);
  const open = html.indexOf("{", at);
  let d = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
}

// vytáhni tělo šablony odkazu: od `return \`<div class="link"` po konec toho template stringu
const start = html.indexOf('return `<div class="link" draggable="true"');
if (start < 0) throw new Error("sablona odkazu nenalezena");
// konec šablony je poslední "`;" před uzávěrkou .join("") — uvnitř jsou
// vnořené template stringy, takže první "`;" by šablonu useklo v půlce
const join = html.indexOf('}).join("");', start);
if (join < 0) throw new Error("konec seznamu odkazu nenalezen");
const end = html.lastIndexOf("`;", join);
const tpl = html.slice(start + "return ".length, end + 1);
const t0 = html.lastIndexOf("const tools=", start), toolsDef = html.slice(t0, html.indexOf("\n", t0));
const libReadBtn = () => "", libArtHint = () => "";

const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const ring = () => "#ccc";
const rel = () => "před chvílí";
const L = { watchFromLink: "Hlídat, jestli to někde hrají", watchAlready: "Tohle už se hlídá — otevřít Hlídač" };
let state = { board: { areas: [], watches: [], settings: {} } };
eval([grabFn("watchNorm"), grabFn("watchPhraseFromTitle"), grabFn("watchForLink")].join("\n"));

const a = { id: "a1", name: "Divadlo", type: "links" };
const l = { id: "i1", title: "debata pro loutky - doporučila aisha", url: "https://www.archa-plus.cz/cz/program/", note: "", status: "ok", lastChecked: Date.now(), code: 0 };
const renderItem = new Function("a", "l", "esc", "host", "ring", "rel", "L", "state", "watchNorm", "watchPhraseFromTitle", "watchForLink", "h", "letter", "matches", "libReadBtn", "libArtHint", toolsDef + "\nreturn " + tpl);
const call = () => renderItem(a, l, esc, host, ring, rel, L, state, watchNorm, watchPhraseFromTitle, watchForLink, host(l.url), "A", () => true, libReadBtn, libArtHint);

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + String(extra).slice(0, 200) : "")); } };

const out1 = call();
t("vykresli se vubec", out1.includes('class="link"'), out1.slice(0, 80));
t("tlacitko oka je tam", out1.includes('data-act="watch-from-link"'), out1);
t("nese oblast i polozku", out1.includes('data-act="watch-from-link" data-area="a1" data-id="i1"'), out1.match(/data-act="watch-from-link"[^>]*/));
t("popisek rika Hlidat", out1.includes("Hlídat, jestli to někde hrají"), out1.match(/watch-from-link[^>]*/));
t("jeste neni oznacene jako hlidane", !/class="icon good" data-act="watch-from-link"/.test(out1));
t("puvodni tlacitka zustala", ["link-up", "link-down", "edit-link", "del-link"].every((x) => out1.includes('data-act="' + x + '"')), out1);
t("nazev polozky se vypsal", out1.includes("debata pro loutky - doporučila aisha"));
t("nezustala nevyhodnocena sablona", !out1.includes("${"), out1.match(/\$\{[^}]{0,40}/));

state.board.watches = [{ id: "w1", areaId: "a1", phrase: "debata pro loutky" }];
const out2 = call();
t("uz hlidane ma zvyrazneni", out2.includes('class="icon good" data-act="watch-from-link"'), out2.match(/<button class="icon[^>]*watch-from-link[^>]*/));
t("uz hlidane ma jiny popisek", out2.includes("Tohle už se hlídá"), out2.match(/watch-from-link[^>]*/));

console.log("\n  vykreslené tlačítko:\n  " + (out2.match(/<button[^>]*watch-from-link[^>]*>[^<]*<\/button>/) || ["-"])[0]);
console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
