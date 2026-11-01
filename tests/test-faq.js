const fs = require("fs");
const html = fs.readFileSync("public/index.html", "utf8");

// vytáhni FAQ data a vyhodnoť je
const start = html.indexOf("const FAQ={cs:[");
const end = html.indexOf("\n]};", start);
if (start < 0 || end < 0) throw new Error("FAQ nenalezeno");
const FAQ = eval("(" + html.slice(start + "const FAQ=".length, end + "\n]}".length) + ")");

// vytáhni řádek, který FAQ vykresluje, a spusť ho se stuby
const line = html.split("\n").find((l) => l.includes("const items=(FAQ["));
if (!line) throw new Error("vykresleni FAQ nenalezeno");
const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const L = { faqMore: "Podrobně" };
const DICT = { en: {} };
const render = new Function("FAQ", "L", "DICT", "esc", line.trim() + " return items;");

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + String(extra).slice(0, 180) : "")); } };

/* --- data --- */
t("obe jazykove verze existuji", Array.isArray(FAQ.cs) && Array.isArray(FAQ.en));
t("stejny pocet otazek v obou jazycich", FAQ.cs.length === FAQ.en.length, [FAQ.cs.length, FAQ.en.length]);
t("je jich aspon 12", FAQ.cs.length >= 12, FAQ.cs.length);

for (const lang of ["cs", "en"]) {
  FAQ[lang].forEach((e, i) => {
    t(lang + " #" + i + " ma otazku i kratkou odpoved", typeof e[0] === "string" && e[0].length > 5 && typeof e[1] === "string" && e[1].length > 20, e[0]);
    t(lang + " #" + i + " kratka odpoved je opravdu kratka", e[1].length <= 230, e[0] + " (" + e[1].length + ")");
    if (e[2] !== undefined) t(lang + " #" + i + " podrobnosti jsou delsi nez shrnuti", e[2].length > e[1].length, e[0]);
  });
}

const withMore = FAQ.cs.filter((e) => e[2]).length;
t("vetsina otazek ma podrobnosti", withMore >= FAQ.cs.length - 1, withMore + "/" + FAQ.cs.length);

/* --- obsah kolem instalátoru: to je ta otázka, kvůli které se to dělá --- */
const inst = FAQ.cs.find((e) => /spouštět|vir/i.test(e[0]));
t("je tam otazka na spousteni a viry", !!inst, FAQ.cs.map((e) => e[0]));
t("rika, ze tam neni exe", inst && /\.exe/.test(inst[1]), inst && inst[1]);
t("podrobnosti zminuji winget", inst && /winget/.test(inst[2]), inst && inst[2]);
t("podrobnosti zminuji npx bez globalni instalace", inst && /npx/.test(inst[2]));
t("podrobnosti nabizeji rucni postup", inst && /wrangler deploy/.test(inst[2]));
const instEn = FAQ.en.find((e) => /virus/i.test(e[0]));
t("anglicka verze te otazky taky", !!instEn && /\.exe/.test(instEn[1]), instEn && instEn[0]);

const cost = FAQ.cs.find((e) => /stoj/i.test(e[0]));
t("je tam otazka na cenu", !!cost);
t("cena rika ze nic", cost && /Nic/.test(cost[1]), cost && cost[1]);

/* --- vykreslení --- */
const out = render(FAQ, L, DICT, esc);
t("vykresli se polozky", (out.match(/<details class="faq-it">/g) || []).length === FAQ.cs.length, (out.match(/<details class="faq-it">/g) || []).length);
t("vnorene rozbalovatko je tam", out.includes('<details class="faq-more">'));
t("rozbalovatko ma popisek", out.includes("<summary>Podrobně</summary>"));
t("pocet rozbalovatek sedi s daty", (out.match(/faq-more/g) || []).length === withMore, (out.match(/faq-more/g) || []).length);
t("nezustala nevyhodnocena sablona", !out.includes("${"), out.match(/\$\{[^}]{0,40}/));
t("text je escapovany", !/<script/i.test(out));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
