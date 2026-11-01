// Stáhne skutečné stránky divadel, proti kterým se testuje vytahování termínů.
// Nejsou v repozitáři schválně: jsou to cizí stránky a jedna z nich má 2 MB.
// Bez nich 12 tvrzení tiše přeskočí, zbytek sad běží normálně.
//   node tests/fetch-fixtures.js
const fs = require("fs");
const PAGES = {
  "ha.html": "https://www.hadivadlo.cz/inscenace/pan-biedermann-a-zhari",
  "nd.html": "https://www.narodni-divadlo.cz/cs/program",
};
(async () => {
  fs.mkdirSync("tests/fixtures", { recursive: true });
  for (const [name, url] of Object.entries(PAGES)) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Rozcestnik-Watcher/1.0" } });
      const t = await r.text();
      fs.writeFileSync("tests/fixtures/" + name, t);
      console.log(name + ": " + (t.length / 1024).toFixed(0) + " kB z " + url);
    } catch (e) { console.log(name + ": nestazeno (" + e.message + ")"); }
  }
  console.log("\nPozor: stránky se mění. Když test na termínech spadne, podívej se");
  console.log("napřed, jestli divadlo nezměnilo program, než budeš opravovat kód.");
})();
