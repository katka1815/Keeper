# Nový vzhled a ovládání panelů — návrh

Datum: 2026-09-22
Stav: ke schválení

## Proč

Současný vzhled je teplý, krémový a serifový. Uživatelka chce místo toho
monochromatický systém podle styleguidu „Dul Zorigoo“: bílé plátno, vlasové
linky, inkoust místo černé, Inter, malé písmo a žádné stíny. Zároveň chce mít
u každého panelu v rohu ovládání — minimalizaci, změnu velikosti tažením za
kraje i rohy, barvu záložky, barvu těla a přechod barvy v těle.

## Rozhodnutí, která už padla

- Vzhled se mění **všude**, včetně `public/share.html`, který vidí příjemci
  sdílených odkazů.
- Stávající barvy oblastí a bloků **zůstávají**. Nic se nepřebarví bez ptaní.
- Přechod v těle panelu jde **ze zvolené barvy do bílé** směrem dolů.
- Postupuje se cestou „vyměnit tokeny a zamést“, ne přepisem CSS načisto.

## Rozpor ve styleguidu a jak se řeší

Styleguide říká doslova, že žádná barva neexistuje a že správná reakce na chuť
sáhnout po barvě je přestat. Uživatelka přitom chce barevné panely.

Není to spor, když se ten dokument přečte přesně: nezakazuje barvu v obsahu,
zakazuje ji v **rámu**. V portfoliu je chrom šedý proto, aby veškerou barvu
nesly fotografie. V Rozcestníku nejsou obsahem fotografie, ale panely. Proto:

- Plátno, lišta, linky, písmo, tlačítka a ikony jsou striktně monochromatické.
- **Barva panelu je jediné barevné místo v celé appce**, v přesně té roli, jakou
  v předloze hrají fotografie.
- Panel bez barvy je bílý s vlasovou linkou, tedy čistá galerie podle předlohy.

## Co se z předlohy nepřebírá

Předloha je portfolio, Rozcestník je nástěnka. Nepřebírá se pevná bio lišta
vlevo ani filtrační záložky — tady nemají co dělat. Masonry mřížka v appce už
existuje jako volba v Nastavení, takže se nezavádí znovu. Přebírá se vizuální
jazyk, ne rozložení stránky.

## Tokeny

Appka už na CSS proměnných jede, takže se z velké části jen přemapují.

| Proměnná | Dnes | Nově | Role |
|---|---|---|---|
| `--paper` | `#F4F2EB` | `#ffffff` | plátno stránky |
| `--panel` | `#FBFAF6` | `#ffffff` | povrch panelu bez barvy |
| `--ink` | `#20262B` | `#252525` | hlavní text, aktivní stav |
| `--muted` | `#6B7178` | `#8e8e8e` | nejtišší pomocný text |
| `--caption` | — | `#a8a8a8` | popisky, metadata, neaktivní stav |
| `--line` | `#E4DECF` | `#ebebeb` | všechny linky, okraje, dělítka |
| `--lineSoft` | `#EDE8DC` | `#f3f3f3` | linky uvnitř hustých seznamů |
| `--sans` | system-ui | Inter, pak system-ui | veškerý text |
| `--serif` | Iowan Old Style | zrušeno | viz níže |

Písmo: Inter se načte z Google Fonts s `system-ui` jako záložkou, aby appka
fungovala i offline a bez cizího písma.

Rozměry: základ 4 px, škála 4/8/12/16/20/32. Zaoblení 0 px na panelech a
kartách, 8 px na tlačítkách a odkazech. Všechny čtyři `box-shadow` se ruší;
strukturu nese vlasová linka.

Písmo nepřesáhne 15 px. To znamená, že masthead `h1` klesne z 34px serifu na
15px Inter v inkoustu a citáty se z plum serifu přesunou do 13px kurzívy
v `--caption`. Je to věrné předloze („headlines do not exist on this site“),
ale je to velká ztráta charakteru — dá se to jedním řádkem vrátit, kdyby to
v praxi vadilo.

## Stavové barvy

Dnes se stav odkazu značí barvou kroužku: zelená v pořádku, červená rozbitý,
okrová neznámý. Styleguide sémantické barvy zakazuje.

Navrhuje se řešit to bez barvy: rozbitý odkaz dostane **inkoustový** kroužek a
viditelný štítek s kódem, v pořádku **vlasový šedý**, neznámý **žádný**. Rozdíl
nese sytost, ne odstín, což je přesně ten mechanismus, který styleguide
předepisuje pro aktivní a neaktivní stav.

Riziko: rozbitý odkaz může být hůř na první pohled vidět. Když se to v praxi
ukáže jako problém, vrátí se jediná výjimka v podobě červené a nikde jinde.

## Vzhled panelu

### Data

Do oblasti (a stejně tak do bloku cílů) přibývá jedno pole:

```js
a.color      // už existuje — nově je to barva ZÁLOŽKY (hlavičky)
a.bodyColor  // nové — barva těla; prázdné = bílé tělo
```

Bloky cílů dostávají totéž pod `b.color` a `b.bodyColor`.

Rohovou nabídku a barvy dostávají **oblasti a bloky cílů na desce**. Panely,
které se rozbalují přes celou šířku z lišty — kalendář, cyklus, knihy, sdílení,
FAQ, Hlídač, Věci, Peníze, Koš — dostanou jen nový vzhled. Velikost ani barva
u nich nedává smysl, protože to nejsou dlaždice na desce, ale překryvy.

Tělo se vykreslí jako `linear-gradient(180deg, <bodyColor>, #ffffff)`, takže
spodek panelu je vždy bílý a text zůstane čitelný bez ohledu na zvolený odstín.
Tím odpadá nutnost počítat kontrast.

Stávající desky žádné `bodyColor` nemají, takže se po nasazení nic nepřebarví —
záložky si ponechají barvy, které mají, a těla zůstanou bílá.

### Ovládání v rohu

V pravém horním rohu hlavičky každého panelu jedno nenápadné tlačítko, které
rozbalí kompaktní nabídku:

- minimalizovat (existující `a.collapsed`)
- schovat (existující `a.hidden`)
- barva záložky (existující výběr barvy, jen přestěhovaný)
- barva těla (nový výběr barvy)
- zrušit barvy (vynuluje obě)
- vrátit velikost (existující ⤢)

Nabídka je textová, bez ikon a bez výplně, oddělená vlasovou linkou — v duchu
zbytku systému. Otevřená je vždy nejvýš jedna.

### Změna velikosti

Dnes se táhne jen za pravý dolní roh. Přibývají úchyty na **pravém a spodním
kraji**, takže jde měnit šířka a výška zvlášť. Stávající přichytávání k rozměrům
sousedních oblastí a tlačítko pro návrat velikosti zůstávají beze změny.

## Kudy to vede kódem

**`public/index.html`** — `:root`, sweep natvrdo psaných barev, zaoblení a
stínů, hlavička panelu s rohovou nabídkou, vykreslení gradientu, úchyty na
krajích, nové texty do `DICT.cs` i `DICT.en`.

**`public/share.html`** — vlastní kopie stylů, přebarvuje se zvlášť. Vidí ji
příjemci sdílených odkazů, takže se testuje samostatně.

**`src/index.js`** — beze změny. Vzhled je čistě věc frontendu; `bodyColor` se
veze v desce jako každé jiné pole a worker o něm nemusí vědět.

## Jak se to ověří

Vzhled se testy neověří, to musí vidět oko. Testy pokryjí to, co ověřit jdou:

- Vykreslení hlavičky panelu mimo prohlížeč: rohová nabídka je ve značkách,
  nese id oblasti, mění popisek podle stavu.
- Gradient: panel s `bodyColor` má `linear-gradient` a končí bílou; panel bez
  něj nemá `background-image` vůbec.
- Zrušení barev vynuluje obě pole a panel se vrátí na bílou s linkou.
- Úchyty na krajích existují a nesou správný směr tažení.
- Žádná zbylá `box-shadow` a žádná zbylá barva mimo tokeny a barvy panelů —
  kontrola grepem přes oba HTML soubory.
- `node --check` na skriptech z obou HTML souborů.

Nasazuje se po částech, aby šlo po každém kroku kouknout a případně se vrátit
o jeden commit: nejdřív tokeny a sweep, pak rohová nabídka a barvy těla, nakonec
úchyty a `share.html`. Po každém nasazení tvrdý reload, jinak service worker
naservíruje starou stránku.

## Co do toho nepatří

Žádný tmavý režim, žádná volba motivu, žádné ukládání vlastních palet, žádná
animace nebo přechod nad rámec toho, co v appce už je. Styleguide je jeden a
platí; barva panelu je jediná odchylka a ta je řízená uživatelkou.
