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
- Dvojjazyčnost CS/EN: objekt DICT (DICT.cs / DICT.en), aktuální jazyk je L. KAŽDÝ nový
  text do UI přidej do obou jazyků.
- Sdílený prohlížeč je public/share.html, routovaný Workerem na /s/<kód>.
- Worker: default export s fetch() (routing) a scheduled() (cron). JSON přes helper
  json(data, status). Náhodná id přes rid(). KV přes getBoard/putBoard/getInbox/putInbox.

CO UŽ APPKA UMÍ
oblasti (odkazy/text), úkoly (termín, popisek, rychlý úkol nad deskou), bloky cílů, citáty,
koš (30 dní) s obnovou, denní úklid přes cron, půjčené věci (loans) a dluhy (debts) s přepočtem
měn přes /api/fx, hledání knih jen z legálních zdrojů, Google Kalendář (OAuth, za PINem,
obousměrně, barvy), sledování menstruačního cyklu (za týmž PINem), FAQ panel v appce,
hlídač stránek (board.watches/watchHits: hlídání jde založit tlačítkem 👁 přímo u odkazu
v oblasti, hledá frázi na zadaných adresách, z nálezu tahá
termíny a odkaz na vstupenky, umí se napojit na oblast a zapsat termín do popisku její položky
s automatickým smazáním po termínu (link.expiresDay), nabízí vložení do kalendáře tady i do
Googlu, potvrzení nálezu ano/ne, upozornění přes ntfy a Resend),
výběrové sdílení (ke čtení/úpravám, veřejné/heslo, platnost, ntfy upozornění).

PRAVIDLA, KTERÁ MUSÍŠ DODRŽET
- Frontend zůstává jeden soubor, vanilla JS, bez frameworku a bez build kroku.
- Žádné localStorage (jediná povolená výjimka už v kódu je PIN ke kalendáři).
- Data zůstávají v uživatelově Cloudflare (KV/R2). Nepřidávej třetí strany ani neposílej
  data jinam bez výslovného souhlasu uživatele.
- Jen legální zdroje obsahu, žádné stínové knihovny. Cizí weby jen číst šetrně:
  respektovat robots.txt, rozumný interval, nic z nich nepřepublikovávat.
- Hlavní deska je bez přihlášení (otevřená po URL). Citlivé věci dávej za PIN nebo heslo.
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
Calendar (OAuth, behind a PIN, two-way, colors), menstrual cycle tracking (behind the same
PIN), an in-app FAQ panel, a page watcher (board.watches/watchHits: looks for a phrase on
given addresses (a watch can be created straight from a link in an area with its 👁 button),
pulls dates and a ticket link out of a finding, can link to an area and write
the date into a matching item's note with automatic removal once it passes (link.expiresDay),
offers adding them to the calendar here or in Google, yes/no confirmation of a finding, alerts
via ntfy and Resend),
selective
sharing (read/edit, public/password, expiry, ntfy
reminders).

RULES YOU MUST FOLLOW
- The frontend stays one file, vanilla JS, no framework and no build step.
- No localStorage (the only allowed exception already in the code is the calendar PIN).
- Data stays in the user's own Cloudflare (KV/R2). Don't add third parties or send data
  elsewhere without the user's explicit opt-in.
- Legal content sources only, no shadow libraries. Other people's sites may only be read
  politely: respect robots.txt, keep the interval sane, never republish their content.
- The main board has no login (open by URL). Put sensitive things behind a PIN or password.
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
