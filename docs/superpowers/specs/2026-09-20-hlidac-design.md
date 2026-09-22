# Hlídač — návrh modulu

Datum: 2026-09-20
Stav: schváleno k rozpracování do implementačního plánu

## Proč

Katka má na desce záložku s doporučenými divadly a chce vědět, až se konkrétní
inscenace objeví v programu. Ruční obcházení webů jednou za čas nefunguje —
člověk to přestane dělat dřív, než se inscenace vypíše.

Modul se ale nestaví na divadla. Staví se jako obecný **hlídač**: řekneš mu, kde
hledat, co hledat, jak často a co udělat, když se to najde. Divadla jsou první
použití, ne jediné.

## Co to dělá

Každé hlídání je jeden záznam s frází, seznamem adres, intervalem a akcemi.
Cron, který už v appce tiká každou hodinu, u každého hlídání zkontroluje, jestli
mu uplynul interval. Když ano, stáhne zadané stránky, vyhází z nich HTML a hledá
frázi.

Když najde shodu, uloží nález (adresa, kousek textu okolo, čas) a pošle
upozornění. V panelu se nález objeví s otázkou „tohle jsi hledala?" a dvěma
tlačítky:

- **Ano** — spustí nastavené akce (založ úkol, hoď odkaz do oblasti) a s hlídáním se
  stane to, co má v `afterFound`: uspí se, smaže se, nebo běží dál (když čekáš víc termínů).
- **Ne** — adresa se zapíše mezi odmítnuté a stejný nález už se nikdy nenahlásí.

Dokud nález čeká na potvrzení, hlídání mlčí. Neposílá druhé upozornění na totéž.

## Jak se hledá

**Základní režim (A).** Stáhne se každá zadaná adresa, zahodí se `<script>`,
`<style>` a všechny značky, zbytek se složí na jeden řádek. Fráze i text se
porovnávají v malých písmenech a bez diakritiky, takže „Maryša" najde „MARYŠA"
i „Marysa". Hledá se prostý podřetězec.

**Hloubkový režim (B), zaškrtávátko u jednotlivého hlídání.** Kromě zadané
stránky se projdou i odkazy, které z ní vedou na stejný web a jejichž adresa nebo
text odkazu vypadá na program (`program`, `repertoar`, `repertoire`, `hraje`,
`predstaveni`, `inscenace`). Maximálně jedna úroveň do hloubky a nejvýš 12
stránek na jednu zadanou adresu.

Výchozí je A. B se zapíná jen tam, kde A nestačí, protože stáhne řádově víc
stránek a víc se plete.

**Co to neumí.** Divadla, která si program dokreslují JavaScriptem až v
prohlížeči, Worker nepřečte — v HTML tam ta inscenace prostě není. Takové
hlídání bude mlčet donekonečna a nepozná se to od toho, že se inscenace nevypsala.
Panel proto u každého hlídání ukazuje datum poslední kontroly a počet stažených
stránek, aby bylo vidět, že engine opravdu běží.

## Slušné chování k cizím webům

Hlídač chodí na weby, které nejsou tvoje, takže:

- `robots.txt` každého hostitele se stáhne jednou a drží se v KV týden; co je
  zakázané, se nestahuje.
- Hlavička `user-agent` se představí jako `Rozcestnik-Watcher/1.0` a odkáže na
  adresu Workeru.
- Na každou stránku deset vteřin timeout, stejně jako u kontroly odkazů.
- Kontroly běží ve stejném denním okně jako úklid, tedy v 6:00 podle časového
  pásma z Nastavení, ne v náhodnou hodinu.

To si žádá úpravu pravidla v `PROMPT.md`. Dnes tam stojí „jen legální zdroje
obsahu (žádné stínové knihovny, žádný scraping)". Nové znění: „jen legální zdroje
obsahu, žádné stínové knihovny; cizí weby jen číst šetrně, respektovat
robots.txt a nic z nich nepřepublikovávat." Zákaz stínových knihoven zůstává,
mění se jen to, že se čtení veřejné programové stránky jednou týdně nepovažuje za
scraping.

## Rozpočet na požadavky

Worker má na jeden běh cronu strop podrequestů (50 na free plánu). Kontrola
odkazů v `maybeDaily` už z něj ukusuje. Hlídač si proto bere nejvýš **25
podrequestů na jeden běh cronu**. Hlídání, na která se v daném běhu nedostalo,
se odloží na další hodinu — interval je v dnech, takže o hodinu později nikomu
nic neuteče. Pořadí je podle toho, kdo čeká na kontrolu nejdéle.

## Data

Vedle `loans` a `debts` přibydou do desky dva seznamy, takže koš, sdílení i
denní úklid fungují beze změny.

```js
board.watches = [{
  id, name,                  // "Maryša"
  phrase,                    // hledaná fráze
  urls: [],                  // adresy ke stažení
  deep: false,               // hloubkový režim B
  intervalDays: 7,           // 1 / 7 / 30
  lastRunDay: 0,             // YYYYMMDD poslední kontroly
  lastPages: 0,              // kolik stránek se naposled stáhlo
  onFound: { task: true, area: "" },  // co udělat po potvrzení
  afterFound: "sleep",       // "sleep" | "delete" | "keep"
  rejected: [],              // odmítnuté adresy
  paused: false
}]

board.watchHits = [{
  id, watchId, url, snippet, foundAt
}]
```

Do Nastavení přibyde `settings.watchSourceArea` — která oblast na desce je
výchozí zdroj adres. Při zakládání nového hlídání se její odkazy předvyplní jako
`urls`, dají se odškrtat a doplnit ručně. Oblast se vybírá ze seznamu existujících
oblastí, není nikde zadrátovaná; když se smaže, hlídač se vrátí k prázdnému
seznamu a nic nespadne.

## Upozornění

Nález se hlásí dvěma kanály zároveň:

- **ntfy** — už v appce je, používá ho kontrola odkazů i konce sdílení. Nic
  nového se nenastavuje.
- **e-mail přes Resend** — nový secret `RESEND_KEY` a adresa příjemce v
  Nastavení (`settings.watchEmail`). Bez klíče se větev jen vypne, stejně jako
  kalendář bez `CAL_PIN`.

> Resend bez ověřené domény umí posílat jen na adresu vlastníka účtu, z adresy
> `onboarding@resend.dev`. Pro tebe to stačí. Kdo si appku nainstaluje a bude chtít
> posílat jinam, musí si v Resendu ověřit doménu — patří to do README k e-mailu.

Zpráva obsahuje název hlídání, adresu nálezu, kousek textu okolo a odkaz zpět do
appky na potvrzení, stejně jako to dnes dělá upozornění na končící sdílení.

## Kudy to vede kódem

**Worker (`src/index.js`)**
- `runWatches(board, env)` — projde hlídání, hlídá rozpočet podrequestů, vrací
  počet nových nálezů. Volá se ze `scheduled()` hned po `maybeDaily`.
- `fetchText(url)` — stažení a vyčištění HTML na holý text.
- `matchPhrase(text, phrase)` — normalizace bez diakritiky a hledání.
- `collectDeepLinks(html, baseUrl)` — jen pro režim B.
- `robotsAllows(url, env)` — `robots.txt` s týdenní cache v KV.
- `notifyHit(watch, hit, board, env)` — ntfy plus Resend.
- `POST /api/watch/run` — ruční „zkontrolovat teď" pro jedno hlídání.

**Frontend (`public/index.html`)**
- `watchPanel` a `data-act="toggle-watch"` v liště, vedle Věcí a Peněz.
- `renderWatch()` — nahoře nepotvrzené nálezy s ano/ne, pod nimi seznam hlídání.
- `data-act` větve: `watch-add`, `watch-del`, `watch-pause`, `watch-run`,
  `watch-hit-yes`, `watch-hit-no`.
- Nové texty do `DICT.cs` i `DICT.en`, česky genderless.

**Konfigurace a dokumentace**
- `wrangler secret put RESEND_KEY` do `setup/wizard.ps1` i `setup/wizard.sh`,
  jako volitelný krok.
- README: nová sekce v obou jazycích, plus zmínka v seznamu souborů.
- `PROMPT.md`: hlídač do seznamu funkcí, upravené pravidlo o scrapingu.
- FAQ v appce: otázka na to, že hlídač chodí na cizí weby a co tam o tobě nechá.

## Co do toho nepatří

Žádné upozorňování na změnu stránky obecně, žádná historie verzí stránek, žádné
regulární výrazy v hledané frázi, žádné sdílení hlídání odkazem. Fráze je prostý
text a hlídání jsou tvoje.

## Jak se to ověří

- Normalizace a match: fráze s diakritikou proti textu bez ní a naopak, shoda
  přes hranici značky (`<b>Mary</b>ša`), fráze, která v textu není.
- Rozpočet: třicet hlídání v jednom běhu nesmí přetáhnout strop podrequestů.
- Smyčka potvrzení: nález → upozornění → „ne" → stejná adresa se při dalším běhu
  nenahlásí znovu.
- `robots.txt` se zákazem danou adresu vyřadí.
- Chybějící `RESEND_KEY` nesmí shodit běh cronu; ntfy musí odejít i tak.
- `node --check` na `src/index.js` a na skriptech z `public/index.html` a
  `public/share.html`.
