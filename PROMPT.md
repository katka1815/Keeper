# Úvodní prompt pro AI / Intro prompt for AI

Tahle appka je **vibecoded** — vznikla po krocích ve spolupráci s AI. Když si chceš
přidat vlastní modul nebo něco upravit, **popiš, co chceš, vlož do AI všechny soubory
projektu a na začátek dej tenhle prompt**. Funguje s libovolnou AI.

This app is **vibecoded** — built step by step with an AI. To add your own module or
change something, **describe what you want, paste all project files into an AI, and put
this prompt on top**. Works with any AI.

---

## 🇨🇿 Prompt (česky)

```
Pomáháš mi rozšířit moji osobní appku „Rozcestník". Je vibecoded a chci přidat/upravit
modul. Drž se přesně téhle architektury a zvyklostí.

ARCHITEKTURA
- Jeden Cloudflare Worker (src/index.js) servíruje API na /api/* i statický frontend
  přes ASSETS binding. Žádný build, žádný framework.
- Úložiště: Cloudflare KV (klíče "board" = celá deska, "inbox" = ke zpracování).
  Volitelně R2 (binding BOOKS) na soubory knih.
- Frontend: JEDEN soubor public/index.html, čistý vanilla JS. Stav je objekt `state`
  (state.board, state.inbox), posílá se na /api/state (GET/PUT). Ukládání: funkce save()
  (debounced PUT). Vykreslení: render(). Pomocníci: $(id), esc(text).
- UI: klikání řeší jeden delegovaný handler přes atributy data-act="...". Panely jsou
  <section class="panel" id="xPanel"> a přepínají se zobrazením. Tlačítka v liště mají
  data-act="toggle-x". Nový panel patří do #dockGrid a jeho id do pole DOCK (dok je skládá
  vedle sebe). Nová sekce na ploše patří do LAY (přetahování), SECS (velikost) a PLACE
  (záložka v liště); pokud si přepisuje innerHTML, zavolá na konci applySecSizes().
  Nový panel z horní lišty patří navíc do MOD (klíč → id panelu), aby šel dát na plochu.
- Dvojjazyčnost CS/EN: objekt DICT (DICT.cs / DICT.en), aktuální jazyk je L. KAŽDÝ nový
  text do UI přidej do obou jazyků.
- Sdílený prohlížeč je public/share.html, routovaný Workerem na /s/<kód>.
- Worker: default export s fetch() (routing) a scheduled() (cron). JSON přes helper
  json(data, status). Náhodná id přes rid(). KV přes getBoard/putBoard/getInbox/putInbox.

CO UŽ APPKA UMÍ
oblasti (odkazy/text), úkoly (termín, popisek, rychlý úkol nad deskou), bloky cílů, citáty,
koš (30 dní) s obnovou, denní úklid přes cron, půjčené věci (loans) a dluhy (debts) s přepočtem
měn přes /api/fx, hledání knih jen z legálních zdrojů, Google Kalendář (OAuth, za PINem,
obousměrně, barvy), sledování menstruačního cyklu (šifrované v prohlížeči vlastním heslem,
KV cycle_enc), zámek appky heslem (/api/auth/*, cookie rz_s), průvodce po prvním spuštění (/?welcome=1: adresa, vlastní QR
kód qrMatrix, APK, rozšíření), FAQ panel v appce,
hlídač stránek (board.watches/watchHits: hlídání jde založit tlačítkem 👁 přímo u odkazu
v oblasti, hledá frázi na zadaných adresách, z nálezu tahá
termíny a odkaz na vstupenky, umí se napojit na oblast a zapsat termín do popisku její položky
s automatickým smazáním po termínu (link.expiresDay), nabízí vložení do kalendáře tady i do
Googlu, potvrzení nálezu ano/ne, upozornění přes ntfy a Resend),
výběrové sdílení (ke čtení/úpravám, veřejné/heslo, platnost, ntfy upozornění),
rozšíření do prohlížeče (složka extension/, Firefox napřed: stránka, výběr, odkaz, obrázek,
screenshot do Ke zpracování přes /api/capture), obrázky v KV/R2 (/api/img/<id>),
Pořádek (mřížka oblastí settings.areaCols, schování/rozbalení oblastí, procházení odkazů
nechat/smazat s náhledem webu z /api/preview), Ke zpracování (u každé věci Mezi úkoly / Do
oblasti, cokoli kamkoli; poznámka v oblasti odkazů = položka s url ""), části desky
(settings.zoneSplit 2/3/4/2x2, settings.zones s názvem, barvou a režimem volně/1–4 sloupce,
a.zone, a.zx/a.zy; šířky settings.zoneColW, výšky řad settings.zoneRowH, sloupce z.colW), moduly: každý panel z lišty může ležet
na ploše (MOD, secMode open/min/tab, obal section.modsec), appka pro Android (složka android/:
WebView na zadanou adresu, cíl sdílení a widget „Rychlá poznámka", obojí přes /api/capture;
staví se android/build.sh bez Gradlu).

PRAVIDLA, KTERÁ MUSÍŠ DODRŽET
- Frontend zůstává jeden soubor, vanilla JS, bez frameworku a bez build kroku.
- Žádné localStorage (jediná povolená výjimka už v kódu je PIN ke kalendáři). Zámek používá
  sessionStorage (značka cizího zařízení), cyklus IndexedDB (nevyexportovatelný klíč).
- Data zůstávají v uživatelově Cloudflare (KV/R2). Nepřidávej třetí strany ani neposílej
  data jinam bez výslovného souhlasu uživatele.
- Jen legální zdroje obsahu, žádné stínové knihovny. Cizí weby jen číst šetrně:
  respektovat robots.txt, rozumný interval, nic z nich nepřepublikovávat.
- Appka je za heslem (src/index.js: authRoute, apiPublic). Nové API je automaticky za zámkem;
  veřejné endpointy přidávej do apiPublic jen vědomě. Heslo ani klíče nikdy neposílej na
  server čitelně. Citlivá data šifruj ve stránce (vzor: cyklus, cySeal/cyOpen).
- Šifrování obsahu (e2e): api() šifruje PUT /api/state a odšifruje každou odpověď. Šifrují se
  jen pole v E2E_SENS (name, title, text, note, who, item, label, author, snippet, ocr, src,
  desc). Nové pole s obsahem přidej do E2E_SENS; pole, které čte server, tam nedávej. Co
  server vyrábí sám, zamyká veřejným klíčem (sealer/sealFields v src/index.js).
- Nové UI texty vždy do DICT.cs i DICT.en.
- Drž se existujících vzorů: data-act handlery, panely, tvar dat v KV, odpovědi přes json().

JAK DODÁVEJ
- Nejdřív stručně popiš plán a na velké/nevratné změny se zeptej, než je uděláš.
- Po každé úpravě zkontroluj syntaxi: `node --check` na src/index.js i na skriptu
  vytaženém z public/index.html (a share.html, pokud ho měníš).
- Vrať celé upravené soubory, ne jen útržky.

MŮJ MODUL / ÚPRAVA:
<sem napiš, co má modul dělat>
```

---

## 🇬🇧 Prompt (English)

```
You're helping me extend my personal app "Rozcestník". It's vibecoded and I want to add
or change a module. Follow this architecture and conventions exactly.

ARCHITECTURE
- A single Cloudflare Worker (src/index.js) serves the API at /api/* and the static
  frontend via the ASSETS binding. No build step, no framework.
- Storage: Cloudflare KV (keys "board" = the whole board, "inbox" = to-process).
  Optional R2 (binding BOOKS) for book files.
- Frontend: ONE file public/index.html, plain vanilla JS. State is the `state` object
  (state.board, state.inbox), synced via /api/state (GET/PUT). Saving: save() (debounced
  PUT). Rendering: render(). Helpers: $(id), esc(text).
- UI: a single delegated click handler dispatches on data-act="..." attributes. Panels are
  <section class="panel" id="xPanel"> toggled by display. Toolbar buttons use
  data-act="toggle-x". A new panel goes inside #dockGrid with its id in the DOCK array (the
  dock lays panels out side by side). A new page section goes into LAY (dragging), SECS (resizing)
  and PLACE (top-bar tab); if it rewrites its innerHTML it must call applySecSizes() afterwards.
- Bilingual CS/EN: a DICT object (DICT.cs / DICT.en), current language is L. Add EVERY new
  UI string to both languages.
- The shared viewer is public/share.html, routed by the Worker at /s/<code>.
- Worker: default export with fetch() (routing) and scheduled() (cron). JSON via helper
  json(data, status). Random ids via rid(). KV via getBoard/putBoard/getInbox/putInbox.

WHAT THE APP ALREADY DOES
areas (links/text), tasks (deadline, note, quick-task box above the board), goal blocks,
quotes, trash (30 days) with restore, daily cleanup cron, lent/borrowed items (loans) and
debts with currency conversion via /api/fx, book search from legal sources only, Google
Calendar (OAuth, behind a PIN, two-way, colors), menstrual cycle tracking (encrypted in the
browser with its own password, KV cycle_enc), an app lock with a password (/api/auth/*,
cookie rz_s), a first-run guide (/?welcome=1: address, own QR code qrMatrix, APK, extension), an in-app FAQ panel, a page watcher (board.watches/watchHits: looks for a phrase on
given addresses (a watch can be created straight from a link in an area with its 👁 button),
pulls dates and a ticket link out of a finding, can link to an area and write
the date into a matching item's note with automatic removal once it passes (link.expiresDay),
offers adding them to the calendar here or in Google, yes/no confirmation of a finding, alerts
via ntfy and Resend),
selective
sharing (read/edit, public/password, expiry, ntfy
reminders), a browser extension (extension/ folder, Firefox first: page, selection, link,
image, screenshot into To process via /api/capture), images in KV/R2 (/api/img/<id>),
Tidy up (area grid settings.areaCols, hide/expand areas, keep/delete every link with a
website preview from /api/preview), modules: every top-bar panel can live on the page
(MOD, secMode open/min/tab, wrapper section.modsec), an Android app (android/ folder: a WebView
on the entered address, a share target and a "Quick note" widget, both via /api/capture; built
by android/build.sh without Gradle).

RULES YOU MUST FOLLOW
- The frontend stays one file, vanilla JS, no framework and no build step.
- No localStorage (the only allowed exception already in the code is the calendar PIN). The
  lock uses sessionStorage (foreign-device marker), the cycle IndexedDB (non-extractable key).
- Data stays in the user's own Cloudflare (KV/R2). Don't add third parties or send data
  elsewhere without the user's explicit opt-in.
- Legal content sources only, no shadow libraries. Other people's sites may only be read
  politely: respect robots.txt, keep the interval sane, never republish their content.
- The app is behind a password (src/index.js: authRoute, apiPublic). New API is locked by
  default; add public endpoints to apiPublic only deliberately. Never send the password or
  keys to the server in clear. Encrypt sensitive data in the page (pattern: the cycle,
  cySeal/cyOpen).
- Content encryption (e2e): api() encrypts PUT /api/state and decrypts every response. Only
  fields in E2E_SENS are encrypted (name, title, text, note, who, item, label, author, snippet,
  ocr, src, desc). Add new content fields to E2E_SENS; never add fields the server reads. What
  the server produces itself is sealed with the public key (sealer/sealFields in src/index.js).
- Always add new UI strings to both DICT.cs and DICT.en.
- Follow existing patterns: data-act handlers, panels, the KV data shape, json() responses.

HOW TO DELIVER
- First outline the plan briefly, and ask before big/irreversible changes.
- After each change, syntax-check: `node --check` on src/index.js and on the script
  extracted from public/index.html (and share.html if you change it).
- Return the full updated files, not just snippets.

MY MODULE / CHANGE:
<describe here what the module should do>
```
