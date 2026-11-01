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
eval(["hexRgb", "srgbLum", "contrastOn", "readableOn", "readableMutedOn", "readableInk", "safeTint", "cycContrast"].map(grab).join("\n"));

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + JSON.stringify(extra) : "")); } };
const r2 = (x) => Math.round(x * 100) / 100;

/* --- kontrastní poměr proti známým hodnotám --- */
t("cerna na bile je 21:1", r2(contrastOn("#000000", "#ffffff")) === 21, contrastOn("#000000", "#ffffff"));
t("bila na bile je 1:1", r2(contrastOn("#ffffff", "#ffffff")) === 1);
t("inkoust na bile prochazi", contrastOn("#252525", "#ffffff") > 14, r2(contrastOn("#252525", "#ffffff")));
t("popisky #a8a8a8 na bile NEprochazi 4.5", contrastOn("#a8a8a8", "#ffffff") < 4.5, r2(contrastOn("#a8a8a8", "#ffffff")));
t("je to symetricke", r2(contrastOn("#252525", "#ffffff")) === r2(contrastOn("#ffffff", "#252525")));

/* --- text na podkladu --- */
t("na bile inkoust", readableOn("#ffffff") === "#252525");
t("na svetle zluté inkoust", readableOn("#ffe600") === "#252525", readableOn("#ffe600"));
t("na tmave modre bila", readableOn("#1a2b6d") === "#ffffff", readableOn("#1a2b6d"));
t("na cerne bila", readableOn("#000000") === "#ffffff");
t("na stredni sede to nespadne", ["#252525", "#ffffff"].includes(readableOn("#767676")), readableOn("#767676"));
t("vybrana barva opravdu prochazi nebo je to nejlepsi moznost", (() => {
  for (const bg of ["#ffffff", "#000000", "#767676", "#7a2e2e", "#cce5ff", "#5B3A57"]) {
    const fg = readableOn(bg);
    const other = fg === "#252525" ? "#ffffff" : "#252525";
    if (contrastOn(fg, bg) < 4.5 && contrastOn(fg, bg) < contrastOn(other, bg)) return false;
  }
  return true;
})());

/* --- tiché popisky --- */
t("seda na bile jako popisek projde 3:1", readableMutedOn("#ffffff") === "#8e8e8e", [readableMutedOn("#ffffff"), r2(contrastOn("#8e8e8e", "#ffffff"))]);
t("na tmavem podkladu je popisek svetla seda", readableMutedOn("#1a2b6d") === "#c9c9c9", readableMutedOn("#1a2b6d"));
t("popisek je vzdy na stejne strane jako hlavni text", ["#ffffff","#000000","#1a2b6d","#7a2e2e","#ffe600","#cce5ff"].every(bg=>{
  const ink=readableOn(bg), m=readableMutedOn(bg);
  return ink==="#ffffff" ? ["#c9c9c9","#ffffff"].includes(m) : ["#8e8e8e","#252525"].includes(m);
}));
t("popisek vzdy unese aspon 3:1", ["#ffffff","#000000","#1a2b6d","#7a2e2e","#ffe600"].every(bg=>contrastOn(readableMutedOn(bg),bg)>=3));

/* --- barva použitá jako text --- */
t("dost tmava barva jako text zustane", readableInk("#5B3A57") === "#5B3A57", readableInk("#5B3A57"));
t("svetla barva jako text ustoupi inkoustu", readableInk("#ffe600") === "#252525", readableInk("#ffe600"));
t("stredne svetla taky ustoupi", readableInk("#a8a8a8") === "#252525", readableInk("#a8a8a8"));
t("vysledek vzdy prochazi na bile", ["#5B3A57", "#ffe600", "#a8a8a8", "#246A63", "#cce5ff"].every((c) => contrastOn(readableInk(c), "#ffffff") >= 4.5));

/* --- ztlumení podkladu --- */
for (const c of ["#000000", "#1a2b6d", "#7a2e2e", "#246A63", "#5B3A57", "#ffe600", "#cce5ff", "#ffffff"]) {
  const tint = safeTint(c);
  t("safeTint(" + c + ") unese inkoust", contrastOn("#252525", tint) >= 4.5, [tint, r2(contrastOn("#252525", tint))]);
}
t("uz svetla barva se zbytecne nemeni", safeTint("#cce5ff") === "#cce5ff", safeTint("#cce5ff"));
t("cerna se ztlumi vyrazne", srgbLum(safeTint("#000000")) > srgbLum("#000000"), safeTint("#000000"));
t("ztlumena barva si nechava odstin", (() => {
  const tint = safeTint("#1a2b6d"), rgb = hexRgb(tint);
  return rgb[2] > rgb[0]; // modrá zůstane nejsilnější složkou
})(), safeTint("#1a2b6d"));

/* --- starý pomocník delegovaný na nový --- */
t("cycContrast dava totez co readableOn", ["#000000", "#ffffff", "#246A63"].every((c) => cycContrast(c) === readableOn(c)));

/* --- nasazení v šablonách --- */
t("telo panelu pouziva safeTint", /linear-gradient\(180deg,\$\{safeTint\(a\.bodyColor\)\},var\(--panel\)\)/.test(html));
t("nazev oblasti pouziva readableInk", html.includes('class="area-name" style="color:${lookDark()?"var(--ink)":readableInk(acol)}"'));
t("nazev bloku pouziva readableInk", html.includes('block-title" style="color:${readableInk(col)}"'));

console.log("ok=" + ok + " chyb=" + bad);
process.exit(bad ? 1 : 0);
