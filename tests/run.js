// Spustí všechny sady a vypíše souhrn. Testy nepotřebují žádnou knihovnu:
// vytáhnou si funkce přímo z public/index.html nebo src/index.js a spustí je.
// Pouštět z kořene projektu: node tests/run.js
const { execFileSync } = require("child_process");
const fs = require("fs");

const files = fs.readdirSync("tests").filter((f) => f.startsWith("test-") && f.endsWith(".js")).sort();
let total = 0, failed = 0;
for (const f of files) {
  let out = "", code = 0;
  try { out = execFileSync(process.execPath, ["tests/" + f], { encoding: "utf8" }); }
  catch (e) { out = (e.stdout || "") + (e.stderr || ""); code = 1; }
  const line = (out.trim().split("\n").pop() || "").trim();
  const m = line.match(/ok=(\d+) chyb=(\d+)/);
  if (m) { total += +m[1]; failed += +m[2]; }
  else { code = 1; failed++; }
  console.log((code ? "SELHALO " : "ok      ") + f.padEnd(20) + line);
  if (code) console.log(out.trim().split("\n").filter((l) => l.includes("CHYBA")).join("\n"));
}
console.log("\ncelkem " + total + " testu, " + failed + " chyb");
process.exit(failed ? 1 : 0);
