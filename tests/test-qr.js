const fs = require("fs");
const crypto = require("crypto");
const html = fs.readFileSync("public/index.html", "utf8");

// vytáhni QR kodér a spusť ho bez prohlížeče
const a = html.indexOf("const QR_V="), b = html.indexOf("// Kód je vždy černý");
if (a < 0 || b < 0) throw new Error("QR kodér nenalezen");
const qrMatrix = new Function(html.slice(a, b) + ";return qrMatrix;")();

let ok = 0, bad = 0;
const t = (label, cond, extra) => { if (cond) ok++; else { bad++; console.log("  CHYBA " + label + (extra !== undefined ? " => " + String(extra).slice(0, 180) : "")); } };
const hash = (M) => crypto.createHash("sha256").update(M.map((r) => r.join("")).join("\n")).digest("hex").slice(0, 16);

/* --- velikost a verze --- */
const url = "https://rozcestnik.tvuj-ucet.workers.dev";
const M = qrMatrix(url);
t("adresa appky se vejde (verze 3 = 29 modulů)", M && M.length === 29, M && M.length);
t("čtvercová matice z nul a jedniček", M.every((r) => r.length === 29 && r.every((c) => c === 0 || c === 1)));
t("213 bajtů se ještě vejde (verze 10)", qrMatrix("x".repeat(213)).length === 57);
t("214 bajtů už ne", qrMatrix("x".repeat(214)) === null);
t("jeden znak je verze 1", qrMatrix("a").length === 21);
t("diakritika jde jako UTF-8", qrMatrix("ž".repeat(106)).length === 57 && qrMatrix("ž".repeat(107)) === null);

/* --- vyhledávací vzory ve třech rozích --- */
const finder = (x0, y0) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
  const d = Math.max(Math.abs(x - 3), Math.abs(y - 3)); if (M[y0 + y][x0 + x] !== (d !== 2 ? 1 : 0)) return false; } return true; };
t("vzor vlevo nahoře", finder(0, 0));
t("vzor vpravo nahoře", finder(22, 0));
t("vzor vlevo dole", finder(0, 22));
t("časovací řada střídá", [...Array(13)].every((_, i) => M[6][8 + i] === (i % 2 === 0 ? 1 : 0)));

/* --- formát: obě kopie stejné, úroveň M, platný BCH --- */
const N = M.length, bit = (x, y) => M[y][x];
let f1 = 0, f2 = 0;
const c1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
c1.forEach(([x, y], i) => { f1 |= bit(x, y) << i; });
for (let i = 0; i < 8; i++) f2 |= bit(N - 1 - i, 8) << i;
for (let i = 8; i < 15; i++) f2 |= bit(8, N - 15 + i) << i;
t("obě kopie formátu se shodují", f1 === f2, [f1, f2]);
const raw = f1 ^ 0x5412, data = raw >>> 10;
let r = data; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
t("formát má platný kontrolní kód", (raw & 0x3ff) === (r & 0x3ff));
t("úroveň opravy je M", (data >>> 3) === 0);
t("tmavý modul je na svém místě", bit(8, N - 8) === 1);

/* --- otisk ověřený nezávislou čtečkou (jsQR 1.4.0, 1. 11.) --- */
t("otisk verze 3 sedí", hash(M) === "f0c747ec73f4e8e2", hash(M));
const long = qrMatrix("https://example.workers.dev/" + "a".repeat(120));
t("otisk verze 8 (dva typy bloků, informace o verzi) sedí", long.length === 49 && hash(long) === "c12d3c6ced140e6c", hash(long));

/* --- průvodce po prvním spuštění --- */
const gs = html.indexOf("const GD={cs:"), ge = html.indexOf("const gdT=");
const GD = new Function(html.slice(gs, ge) + ";return GD;")();
t("průvodce má obě jazykové verze se stejnými klíči", JSON.stringify(Object.keys(GD.cs)) === JSON.stringify(Object.keys(GD.en)));
t("žádný text průvodce není prázdný", [...Object.values(GD.cs), ...Object.values(GD.en)].every((s) => typeof s === "string" && s.length > 1));
t("po nastavení hesla se otevře průvodce", html.includes("x.status===200?lkDone(lkPend.kind,1)") && html.includes('location.replace("/?welcome=1")'));
t("start průvodce ukáže a parametr z adresy uklidí", html.includes('get("welcome")==="1"){history.replaceState(null,"",location.pathname);gdShow();}'));
t("průvodce jde otevřít z Nastavení", html.includes("${gdSettingsHtml()}") && html.includes('data-act="gd-open"'));
t("QR nevolá žádnou cizí službu", !/qrserver|chart\.googleapis|quickchart/i.test(html));

console.log(`ok=${ok} chyb=${bad}`);
if (bad) process.exitCode = 1;
