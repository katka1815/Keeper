# Rozcestník — your own dashboard, web + phone app

A self-hosted start page on your own address, reachable anywhere, installable on the
phone as an app (home-screen icon, full screen). It keeps links, tasks, goal blocks,
a reading/book area, quotes, optional Google Calendar and selective sharing. Your data
stays in **your own** Cloudflare account.

**🇬🇧 [English](#english) · 🇨🇿 [Česky](#česky)**

```
Phone: app (PWA) + quick-capture widget  ──►  /api/capture
                                                │
                                        Cloudflare Worker  ◄── cron checks links
                                                │  (KV storage)
Web on your address  ◄───────────────────────►  /api/state
```

---

# English

This version has **no password** for the main board — the web and editing are open to
anyone who knows the address. The calendar is behind a PIN; shares can be public-by-link
or password-protected. Keep your main address private.

## Deploy
**Easiest:** unzip and double-click **`Click this to install the app.bat`** (Windows) or **`Click this to install the app (Mac).command`** (macOS) — a wizard walks you through everything. See [`INSTALL.md`](INSTALL.md). Manual steps below.

In a terminal, in the project folder (where `wrangler.toml` is):
```bash
npm install -g wrangler
wrangler login          # or use a scoped API token (CLOUDFLARE_API_TOKEN)
wrangler deploy
```
The repo ships `wrangler.toml.example`; the installer copies it to `wrangler.toml` and fills in
the KV id of a namespace it creates in your own account (manually: `wrangler kv namespace create KV`).
After `wrangler deploy` it prints a public
address like `https://rozcestnik.your-account.workers.dev` — that's your web.

> A custom domain (e.g. `links.mydomain.com`) is added in the Cloudflare dashboard on the
> Worker as a Custom Domain.

## What the installer actually does

Running a script you found on the internet deserves suspicion, so here is the whole of it.

**There is no `.exe` in this package, and nothing else binary either.** Every file is plain
text. Open them in a text editor and read them before you run anything — that is the point of
shipping it this way.

`Click this to install the app.bat` is three lines long. It sets the console to UTF-8 and runs
`setup/wizard.ps1` from the folder next to it. Nothing else.

`setup/wizard.ps1` (and `setup/wizard.sh` on macOS and Linux) then:

1. Checks that it is sitting next to `wrangler.toml`, and stops if it isn't.
2. Checks whether Node.js is installed. If it isn't, it **asks you y/n** before doing anything.
   On yes it runs `winget install -e --id OpenJS.NodeJS.LTS` — winget is Microsoft's own
   package manager and that is the official Node.js package. On no it opens nodejs.org in your
   browser and leaves the rest to you.
3. Runs `wrangler` through `npx --yes wrangler@latest`. **Wrangler is never installed
   globally**; npx fetches it into a cache and nothing permanent is added to your system.
4. Signs you in to Cloudflare using Cloudflare's own browser login. Your password is typed on
   cloudflare.com, not into the script; the script never sees it.
5. Asks, each one optional and skippable with Enter, for a PIN, an ntfy topic, a Resend key and
   Google Calendar credentials. Each is stored as an encrypted Worker secret, except the ntfy
   topic, which goes into `wrangler.toml`.
6. Runs `wrangler deploy`, which uploads the app to **your** Cloudflare account and prints the
   address it lives at.

**What it never does:** it does not download code from the internet and execute it (no
`iex`, no `curl | bash`), does not ask for administrator rights, does not touch anything
outside the project folder, and does not talk to any server belonging to the author of the app.

**You can skip the installer entirely.** It exists to save you typing, not to hide anything.
The manual route is three commands, shown under Deploy above: `npm install -g wrangler`,
`wrangler login`, `wrangler deploy`.

> Windows will likely warn you about a `.bat` downloaded from the internet — that warning is
> normal and applies to every script, signed or not. Read the file first; it's three lines.

## Install as a phone app
1. Open the web address in the phone browser.
2. **Android (Chrome):** menu (⋮) → *Add to Home screen* / *Install app*.
3. **iPhone (Safari):** Share → *Add to Home Screen*.
An icon "Rozcestník" appears and opens the app full screen.

## Quick-capture widget
The home-screen app is full screen; for a **widget** (a capture button) use:
- **iPhone:** Shortcuts → action "Get Contents of URL", POST to
  `https://YOUR-ADDRESS/api/capture`, JSON body `{"type":"point","text":"…"}`. Add the
  shortcut to the home screen (Shortcuts widget). No password header needed.
- **Android:** the *HTTP Shortcuts* app → POST to the same endpoint, same JSON body, then
  place the widget on the home screen.
To save links by sharing, set `"type":"link"` and put the shared link in `"url"`.

## Using it
- What comes from the phone appears at the top in "To process" — from there you file it
  into an area or into tasks.
- Quick task: the box above the board drops a task straight to the top of the list — type and hit **+**.
- Areas: add, rename, move ◀ ▶.
- Links: drag on desktop, arrows ▲ ▼ on the phone.
- Text areas: each item can also have an optional **description** (the 📝 button), just like links.
- Goal blocks have three columns: Want to do -> Doing -> Done. Move an item with ▶ (to Doing) and ✓ (to Done), ◀ moves it back, and Doing items can have a note (📝) so you remember where each in-progress task stands.
- Tasks can each have an optional deadline (📅) and a note (📝), and you can sort the task list by deadline with the button in the Tasks header.
- Deadline blocks: a deadline is due at the end of its day (not the morning); click the ✎ next to the countdown to change/postpone it, or ✕ to remove it.
- Resize areas: drag the bottom-right corner of any area to set its width and height; the ⤢ button resets it. While dragging it briefly snaps to the width/height of other areas, so you can match neighbours. (In the unified/masonry layout sizing is off.)
- Area display: each area shows up to **3 items** and scrolls for the rest. In Settings you can
  **turn the scrollbar off** (expand everything), **unify the grid** (compact masonry layout,
  toggle off to revert), and **hide** an area (⊟) — it collapses to just its header and parks at
  the **top** or **side** (your choice in Settings); click it to bring it back. Collapse a single area with the ▾ caret, or use **Minimize areas** above the board to fold them all at once — expanding again restores each area to how it was.
- "Check all" runs a link check now; otherwise it runs as part of the daily cleanup at **06:00 in
  the time zone you set in Settings** (the Worker cron ticks hourly and fires the cleanup once 6 a.m.
  has passed there).

## Items and money (who owes what)

Two toolbar buttons keep track of things that left the house and money that moved.

**Items** keeps two lists — *Lent by me* (to whom, what) and *Lent to me* (from whom, what).
Tick **Returned** when the thing comes back.

**Money** records debts both ways: a name, an amount, a currency (CZK, EUR, USD, GBP, PLN), the
direction (*I lent* / *I borrowed*), plus an optional date and note. It adds them up per person and
shows one net line each — *owes you*, *you owe* or *even* — converted into the summary currency you
pick at the top of the panel. Rates come from your own Worker (`/api/fx`, from frankfurter.app with
a fallback source), are fetched once a day and cached in KV. If they can't be loaded the app says so
and leaves the amounts unconverted rather than guessing.

A ticked **Settled** debt or **Returned** item stays visible until the next cleanup; at 06:00 it
moves to the Trash, where it waits 30 days and can be restored.

> Both lists live on the main board, which is open by address — so names and amounts are visible to
> anyone who has your address. Unlike the cycle they are **not** behind the PIN. Shares never carry
> them: a share link only ever contains the areas, goals and tasks you ticked.

## Watcher (tell me when it shows up)

The **Watcher** button in the toolbar keeps an eye on other people's pages for you. A watch is
four things: what to look for, where to look, how often, and what to do when it turns up.

Say a theatre has not announced a production yet. You add a watch with the phrase
`Maryša`, paste in the addresses of the theatres you care about, leave it at *weekly*, and
forget about it. The Worker fetches those pages on its usual cron, strips the HTML and looks
for the phrase. Accents and capitals don't matter, and a title broken up by markup
(`<b>Mary</b>ša`) still matches.

When it finds something, the finding shows up at the top of the panel with the address, a
snippet of the surrounding text and the question **"Is this what you were looking for?"**:

- **Yes** — pauses, deletes or keeps the watch, whichever you chose.
- **No** — remembers that address and never reports it again.

Until you answer, that watch stays quiet, so it can't pester you twice about the same thing.

**Dates and tickets.** A finding also carries whatever it could read off the page: the dates of
*your* production (with times when they are printed) and the best ticket link it found — an external box
office if the page links to one, otherwise the ticket anchor on the page itself. Each date gets
On a whole-season programme listing it keeps the neighbouring days of other plays out of it: a
date belongs to the entry it stands in front of, so only the dates governing an occurrence of
your phrase are picked up. Each date gets two buttons: **Add to calendar here** writes the event
straight into your Google Calendar
through the app (needs the calendar unlocked with your PIN), and **Add to Google Calendar**
opens Google's pre-filled form in a new tab, which works even if you never connected the
calendar. An event lasts two and a half hours; a date with no time becomes an all-day entry.

> The Watcher cannot tell you whether seats are still available. Theatres hand that to a
> ticketing widget that runs in the browser, and the Worker doesn't run JavaScript. Looking for
> the word "sold out" in the HTML doesn't work either — GoOut ships that word inside its script
> bundle, so it shows up even on pages with no performance at all. The ticket link is one click
> from the real answer instead.

**Default source of addresses.** In Settings you pick one area of your board as the Watcher's
address book — a new watch is pre-filled with that area's links and you delete the ones you
don't want. Nothing is hardcoded; if you delete the area, new watches just start empty.

**One level deeper.** A tick-box per watch. Besides the address you gave it, it also follows
links on that same site whose address or label looks like a programme (`program`,
`repertoire`, …), at most twelve per address. It catches more theatres but fetches far more
pages, so it is off by default.

**Starting a watch from a link you already have.** Every link in an area has an 👁 button. Press
it and the watch writes itself: the phrase is the link's title, the address is the link's own
address, the interval is a week, and it is linked back to that area. You don't type the same
thing twice. Anything in the title after a dash, a pipe or an opening bracket is treated as your
own note and left out of the phrase, so "debata pro loutky - doporučila aisha" is watched as
`debata pro loutky`. Once a link is watched its 👁 lights up, and pressing it again just opens
the Watcher instead of making a second watch. Every watch has an **Edit** button that opens it
up: the addresses it checks (one per line), the phrase, the name, the interval, the deep mode
and the linked area. So whatever the app guessed for you, or whatever you got wrong the first
time, is one click away.

**Linking a watch to an area.** When you create a watch you can point it at one of your areas,
and that choice is remembered for the next one. The watch then looks in that area for an item
whose name matches the watch — the whole phrase first, then all of its words anywhere in the
name, ignoring accents and capitals. So a watch called `debata` finds the item
"debata pro loutky - doporučila aisha".

When you then put one of the dates in the calendar, that same date is written into the item's
note ("Playing 25. 10. 2026 · 17:00") and the item is set to delete itself once the date has
passed. The deletion happens in the 06:00 cleanup and the item lands in the Trash like anything
else, so you have 30 days to change your mind. The finding shows which item it matched before
you click anything, or says plainly that it found none.

**Alerts.** Findings go out through ntfy (the same `NTFY_TOPIC` as broken links) and by
e-mail if you set a Resend key — `wrangler secret put RESEND_KEY` plus your address in
Settings. Without either one nothing breaks; findings simply wait for you in the panel.

> The Watcher reads other people's websites. It honours `robots.txt`, identifies itself as
> `Rozcestnik-Watcher/1.0`, gives up on a page after ten seconds and fetches at most 25 pages
> per cron run — anything left over waits for the next hour. Pages that build their programme
> with JavaScript can't be read this way; such a watch will simply never match.

## Sharing a slice of the board (read or edit)
The toolbar has a **Sharing** button. It creates a link that shows only selected things
(one or more areas, goal blocks, tasks) — not your whole page. Depending on the setting the
content is read-only, or the recipient can edit it.

When creating you choose:
- **What to share** — tick areas / blocks / tasks (several at once is fine).
- **Access:**
  - *Read only* — the recipient only sees the content.
  - *Allow editing* — the recipient can **add, change and delete** the shared
    areas/goals/tasks (and tick tasks off). This changes your real data. Edits are limited
    to what you shared — the rest of the board is unreachable through the link. **For editing
    we strongly recommend *Private (password)*** — otherwise anyone who gets the link can
    change your data.
- **Mode:**
  - *Public via link* — anyone with the link can see it. The address is random and
    unguessable, so until you send it to someone, no one will find it.
  - *Private (password)* — the recipient needs the link **and** a password. Send the password
    via a different channel than the link. (No accounts here — privacy is the password on the
    link; the password is stored only as a hash, not in clear text.)
- **Validity** — 24 h / 7 days / 30 days / no end. After expiry the link stops working
  (incl. edits); long-expired shares are removed automatically after a while.
- **Notify before expiry** — sends a push (via ntfy, see below) with a link back into the
  app, where you **extend** the share in one click.

You then *Copy* the link, send it via the system *Share…* sheet (Messenger, WhatsApp…) or by
*Email*. For each existing share you can change validity (*Extend*) or revoke it (×). The link
points to `…/s/<code>`.

> Concurrent edits: the app is not a live collaborative editor. Your page refreshes itself
> when you return to the tab and roughly every 30 s, so your own saving doesn't overwrite the
> other person's changes. If you both write to the same thing in the same second, last write
> wins.

> For expiry push notifications, `NTFY_TOPIC` must be filled in (same as for broken-link
> alerts) — see Notes.

## Optional: Google Calendar (two-way, behind a PIN)
The app can read, create, change and delete events in your Google Calendar. Because the rest
of the app is open by URL, the calendar is **hidden behind a PIN** and the whole feature is
**off until you set the PIN**. The Google token lives only on your Worker (in KV); it never
goes anywhere else and is not sent to the browser.

**1) Google Cloud (one-time):**
1. Go to `https://console.cloud.google.com/` → create a project (e.g. "Rozcestnik").
2. *APIs & Services → Library* → find **Google Calendar API** → *Enable*.
3. *APIs & Services → OAuth consent screen* → type **External** → fill in a name and your
   email → under *Audience* add your Google account to **Test users** (nothing more needed).
4. *APIs & Services → Credentials → Create credentials → OAuth client ID* → type
   **Web application**. To **Authorized redirect URIs** add exactly:
   `https://YOUR-ADDRESS/api/cal/callback`
   (YOUR-ADDRESS is the Worker address from `wrangler deploy`, e.g.
   `rozcestnik.your-account.workers.dev`).
5. Copy the **Client ID** and **Client secret**.

**2) Set three Worker secrets** (not stored in the file or in git):
```bash
echo -n "PIN"        | wrangler secret put CAL_PIN              # your calendar PIN
echo -n "CLIENT_ID"  | wrangler secret put GOOGLE_CLIENT_ID     # from step 1
echo -n "SECRET"     | wrangler secret put GOOGLE_CLIENT_SECRET # from step 1
wrangler deploy
```
> Use `echo -n "value" | wrangler secret put KEY` rather than typing into the hidden prompt —
> the interactive prompt can store only the first character.

**3) Connect:** in the toolbar open **Calendar** → enter the PIN → *Connect Google Calendar* →
sign in with Google and allow access. Done.

**Views and controls:**
- At the top you switch **Month / Week / List**. Month is a 7-column grid with weeks in rows;
  the first and last row are padded with days from neighbouring months (dimmed). Arrows ‹ ›
  page through, *Today* jumps to today.
- **Week from** toggles whether the week starts on Monday or Sunday (saved).
- Click a **day** to open a new event with that date prefilled, click an **event** to edit it.
  An event can also have a **description** (like the event detail in Google Calendar).
- **The PIN is remembered** in the browser after first entry, so it no longer logs you out.
  On a shared/foreign device clear it with *Forget PIN*.

**Colors** (the *Colors* button in the calendar toolbar):
- A default color separately for **timed**, **all-day** and **multi-day** events.
- **Keyword rules** — when an event has a given word in its title/description (e.g. "ríša"),
  it gets that color. You can add several; the first match wins.
- **A custom color on a specific event** (tick *custom* in the event window) — takes priority
  over rules and defaults.
- **Push colors to Google** is optional. Note: at event level Google supports only 11 fixed
  colors, so the nearest is chosen; the app always shows the exact shade. Priority: custom on
  event → keyword rule → default by type.

**I want to tweak / build my own view:** the whole calendar rendering is in
`public/index.html` in `renderMonth()`, `renderWeek()` and `renderCalList()` (the grid is
computed by `monthGrid()` / `weekGrid()`). Add a new view by writing your own `renderXxx()`,
adding a button with `data-act="cal-view" data-view="xxx"`, and a branch in `renderCal()` that
calls it. Grid styles are in the `CAL_CSS` constant right above — colors, cell height and the
mobile layout are all there to play with.

> Note: while the consent screen stays in *Testing* mode, Google may ask for a new sign-in
> after ~7 days. For permanent peace put the app into *Production* (for a personal app that's
> usually enough, or go through Google verification).

## Book search (legal sources)
The toolbar has a "Books" button (can be turned off in Settings → "Book search"). You enter a
title, author, language and format; the app searches **Project Gutenberg**, **Wikisource** and
**Open Library / Internet Archive**:
- public-domain works → inserts a direct file link into the chosen area,
- copyrighted works → shows where to legally borrow/get them.
It does not search shadow libraries and does not download pirated content. (Public domain ≠
every translation is free.)

## Optional: store books in the app (R2)
Without setup, the app just inserts a file link for public-domain works. To keep the file
directly in the app, enable R2:
1. `wrangler r2 bucket create rozcestnik-books`
2. in `wrangler.toml` uncomment the `[[r2_buckets]]` block (binding `BOOKS`)
3. `wrangler deploy`
R2 has 10 GB free and no download fees (thousands of epubs). A "Save file to app" button then
appears for public-domain works. This is optional — without R2 the search and link inserting
still work.

## Optional: Menstrual cycle tracker (behind the PIN)
The toolbar has a **Cycle** button. You log period start (and optional end) dates; the app
computes your **average cycle and period length** and **predicts** upcoming periods, the
fertile window and ovulation, shown in a compact month calendar (weekday columns, like a small Google-Calendar month) (logged days, predicted days, the
prediction's uncertainty window, fertile window and ovulation each marked differently).
To cope with irregular cycles (stress, moving, illness…) it uses a **median** of your recent
cycles instead of a plain average (so one odd cycle barely moves it), shows the prediction as a
**window, not a single day**, labels how **regular** your cycles are and widens/flags the
estimate when they vary a lot, and lets you mark any record as **atypical** so it's excluded
from the stats. Because this is sensitive health data, it is **not**
stored in the open board — it lives in a separate key and is **locked behind the same PIN as the
calendar** (`CAL_PIN`); without the PIN no one can read it via the address. It stays only in your
Cloudflare and is never sent anywhere. You can recolor each phase, and optionally project the
phases either into the app's own calendar view (nothing leaves your Cloudflare) or push the
prediction into Google Calendar — which shares this sensitive data with Google as a third party;
the app warns you before that. The predictions are a rough estimate from a calendar
algorithm — **not medical advice and not contraception**; accuracy grows with more logged cycles
and is lower for irregular cycles.

## Vibecoded — extend it with AI
This app is **vibecoded** — built step by step with an AI. If you want, you can easily
create your own module or tweak something: **describe what you want, paste all the project
files into an AI, and start with the intro prompt** in [`PROMPT.md`](PROMPT.md). The prompt
gives any AI the architecture, conventions and rules so it picks the project up correctly
(single-file vanilla-JS frontend, Cloudflare Worker + KV, bilingual UI, legal sources only,
data stays in your Cloudflare). Then just write your module at the bottom of the prompt.

## License

MIT — see [`LICENSE`](LICENSE). Do what you like with it; there is no warranty.

## Files
- `public/index.html` — look and logic of the web/app
- `public/share.html` — read/edit viewer for shared links (`/s/<code>`)
- `public/manifest.webmanifest`, `public/sw.js`, `public/icon-*.png` — install as an app
- `src/index.js` — API, link checking, calendar, sharing, exchange rates, the watcher
- `wrangler.toml.example` — config template; the installer copies it to `wrangler.toml`
- `wrangler.toml` — KV, cron schedule, push, optional secrets/R2 (yours, not in the repo)
After changes run `wrangler deploy` again.

## Notes
- Rename & wipe: rename the page in Settings (default "Rozcestník"); the footer links to your Cloudflare dashboard; Settings has a **Danger zone** that permanently and irreversibly deletes all data, and the Cycle panel has its own button to wipe only cycle data.
- **No password:** anyone with the address sees and edits the content. For a personal list
  that's usually fine — just don't post the address publicly.
- **Broken-link push:** fill `NTFY_TOPIC` in `wrangler.toml` and in the phone subscribe to the
  same topic in the *ntfy* app.
- **Data sovereignty:** everything lives in your Cloudflare (KV/R2). Exceptions: favicons load
  from Google, link checking visits your saved links, and Google Calendar (if connected) talks
  to Google. Nothing goes to the app's author.

---

# Česky

Hostovaná stránka na vlastní adrese, dostupná odkudkoliv. Na telefonu se nainstaluje jako
appka (ikona na ploše, běh na celou obrazovku). Drží odkazy, úkoly, bloky cílů, čtecí oblast,
citáty, volitelně Google Kalendář a výběrové sdílení. Data zůstávají v **tvém** Cloudflare účtu.

Tahle verze je u hlavní desky **bez hesla** — web i zápis jsou otevřené komukoli, kdo zná
adresu. Kalendář je za PINem, sdílení může být veřejné přes odkaz nebo chráněné heslem. Hlavní
adresu si nech pro sebe.

## Nasazení
**Nejjednodušeji:** rozbal a dvojklikni na **`Click this to install the app.bat`** (Windows) nebo **`Click this to install the app (Mac).command`** (macOS) — průvodce tě provede vším. Viz [`INSTALL.md`](INSTALL.md). Ruční postup níže.

V terminálu ve složce projektu (kde je `wrangler.toml`):
```bash
npm install -g wrangler
wrangler login          # nebo použij úzký API token (CLOUDFLARE_API_TOKEN)
wrangler deploy
```
KV id už je v `wrangler.toml` vyplněné. Po `wrangler deploy` se vypíše veřejná adresa typu
`https://rozcestnik.tvuj-ucet.workers.dev` — to je tvůj web.

> Vlastní doménu (např. `odkazy.mojedomena.cz`) přidáš v Cloudflare dashboardu u Workeru jako
> Custom Domain.

## Co instalátor doopravdy dělá

Spouštět skript stažený z internetu si zaslouží nedůvěru, takže tady je celý jeho obsah.

**V tomhle balíčku není žádný `.exe` ani nic jiného binárního.** Všechno jsou textové soubory.
Otevři si je v poznámkovém bloku a přečti si je, než něco spustíš — kvůli tomu se to takhle
rozdává.

`Click this to install the app.bat` má tři řádky. Přepne konzoli na UTF-8 a spustí
`setup/wizard.ps1` ze složky vedle sebe. Nic víc.

`setup/wizard.ps1` (a na macOS a Linuxu `setup/wizard.sh`) pak:

1. Ověří, že stojí vedle `wrangler.toml`, a když ne, skončí.
2. Zjistí, jestli je nainstalovaný Node.js. Když není, **zeptá se a/n**, než cokoli udělá. Na
   ano spustí `winget install -e --id OpenJS.NodeJS.LTS` — winget je správce balíčků přímo od
   Microsoftu a tohle je oficiální balíček Node.js. Na ne jen otevře nodejs.org a zbytek nechá
   na tobě.
3. Pouští `wrangler` přes `npx --yes wrangler@latest`. **Wrangler se nikdy neinstaluje
   globálně**; npx si ho stáhne do cache a v systému po něm nic trvalého nezůstane.
4. Přihlásí tě k Cloudflare jeho vlastním přihlašovacím oknem v prohlížeči. Heslo píšeš na
   cloudflare.com, ne do skriptu; ten ho nikdy nevidí.
5. Zeptá se — všechno nepovinné a přeskočitelné Enterem — na PIN, téma pro ntfy, klíč k Resendu
   a údaje ke Google Kalendáři. Každé se uloží jako šifrovaný secret Workeru, kromě tématu pro
   ntfy, které jde do `wrangler.toml`.
6. Spustí `wrangler deploy`, který appku nahraje do **tvého** Cloudflare účtu a vypíše adresu,
   na které běží.

**Co nikdy nedělá:** nestahuje si z internetu kód, aby ho spustil (žádné `iex`, žádné
`curl | bash`), nechce práva správce, nesahá na nic mimo složku projektu a nemluví s žádným
serverem autora appky.

**Instalátor jde úplně přeskočit.** Je tu proto, aby ušetřil psaní, ne aby něco schovával.
Ruční postup jsou tři příkazy, jsou výš v sekci Nasazení: `npm install -g wrangler`,
`wrangler login`, `wrangler deploy`.

> Windows tě nejspíš varují před `.bat` souborem staženým z internetu — to varování je normální
> a týká se každého skriptu, podepsaného i ne. Přečti si ten soubor; má tři řádky.

## Nainstalovat jako appku na telefon
1. Otevři adresu webu v prohlížeči na telefonu.
2. **Android (Chrome):** menu (⋮) → *Přidat na plochu* / *Instalovat aplikaci*.
3. **iPhone (Safari):** Sdílet → *Přidat na plochu*.
Vznikne ikona „Rozcestník", která otevírá appku na celou obrazovku.

## Widget na rychlý zápis
Appka z plochy je celá obrazovka; pro **widget** (tlačítko na zápis) použij:
- **iPhone:** Zkratky → akce „Získat obsah URL", POST na `https://TVOJE-ADRESA/api/capture`,
  tělo JSON `{"type":"point","text":"…"}`. Přidej zkratku na plochu (widget Zkratky). Žádná
  hlavička s heslem už není potřeba.
- **Android:** appka *HTTP Shortcuts* → POST na stejný endpoint, stejné JSON tělo, pak umísti
  widget na plochu.
Pro ukládání odkazů sdílením nastav `"type":"link"` a do `"url"` vlož sdílený odkaz.

## Použití
- Co přijde z telefonu, je nahoře v „Ke zpracování" — odtud zařadíš do oblasti nebo mezi úkoly.
- Rychlý úkol: políčko nad deskou hodí úkol rovnou na začátek seznamu — napiš a zmáčkni **+**.
- Oblasti: přidat, přejmenovat, posouvat ◀ ▶.
- Odkazy: na počítači přetažením, na telefonu šipkami ▲ ▼.
- Textové oblasti: každá položka může mít i nepovinný **popisek** (tlačítko 📝), stejně jako odkazy.
- Bloky cílů mají tři sloupce: Chci zvládnout -> Probíhá -> Hotovo. Položku posuneš ▶ (do Probíhá) a ✓ (do Hotovo), ◀ vrátí zpět, a u položek v Probíhá lze přidat popisek (📝), ať víš, kde rozdělaný úkol je.
- Úkoly můžou mít každý svůj nepovinný termín (📅) i popisek (📝), a seznam úkolů jde tlačítkem v hlavičce Úkolů seřadit podle termínu.
- Bloky s termínem: termín platí do konce daného dne (ne od rána); ✎ vedle odpočtu termín změní/posune, ✕ ho zruší.
- Roztahování oblastí: chytni pravý dolní roh oblasti a táhni — nastavíš si šířku i výšku; tlačítko ⤢ velikost vrátí. Při tažení se na chvíli přichytí k šířce/výšce jiných oblastí, ať je snadno sjednotíš se sousedy. (Ve sjednocené/masonry mřížce je rozměr vypnutý.)
- Zobrazení oblastí: oblast ukáže max **3 položky** a zbytek se roluje. V Nastavení můžeš
  **vypnout scroll bar** (vše se rozbalí), **sjednotit mřížku** (kompaktní masonry rozložení,
  vypnutím se vrátí zpět) a oblast **schovat** (⊟) — zabalí se jen na nadpis a odloží se
  **nahoru** nebo **na bok** (dle Nastavení); kliknutím ji zase vrátíš. Jednotlivou oblast sbalíš šipkou ▾, nebo tlačítkem **Sbalit oblasti** nad deskou složíš všechny naráz — po rozbalení se každá vrátí do stavu, v jakém byla.
- „Zkontrolovat vše" spustí kontrolu hned; jinak proběhne sama v rámci denního úklidu v **6:00 podle
  časového pásma z Nastavení** (cron Workeru tiká každé hodinu a úklid spustí, jakmile je tam po šesté).

## Věci a peníze (kdo co komu dluží)

Dvě tlačítka v liště hlídají věci, co odešly z domu, a peníze, co se pohnuly.

**Věci** mají dva seznamy — *Půjčeno ode mě* (komu, co) a *Půjčeno mně* (od koho, co). Až se věc vrátí,
zaškrtni **Vráceno**.

**Peníze** evidují dluhy oběma směry: jméno, částka, měna (CZK, EUR, USD, GBP, PLN), směr
(*půjčeno ode mě* / *půjčeno mně*) a nepovinné datum s poznámkou. Sčítají se po lidech a u každého je
jeden souhrnný řádek — *dluží ti*, *dlužíš*, nebo *vyrovnáno* — přepočtený do měny souhrnu, kterou si
vybereš nahoře v panelu. Kurzy tahá tvůj vlastní Worker (`/api/fx`, ze zdroje frankfurter.app se
záložním zdrojem), stahují se jednou denně a drží se v KV. Když se načíst nepodaří, appka to napíše
a částky nechá nepřepočtené, místo aby si něco domýšlela.

Zaškrtnutý **Vyrovnáno** u dluhu nebo **Vráceno** u věci zůstane vidět do dalšího úklidu; ten v 6:00
záznam přesune do Koše, kde leží 30 dní a dá se vrátit zpět.

> Oba seznamy jsou součástí hlavní desky, a ta je otevřená po adrese — jména i částky vidí každý, kdo
> zná tvoji adresu. Na rozdíl od cyklu **nejsou** za PINem. Do sdílení se nikdy nedostanou: sdílený
> odkaz nese jen ty oblasti, cíle a úkoly, které do něj vybereš.

## Hlídač (dej vědět, až se to objeví)

Tlačítko **Hlídač** v liště sleduje cizí stránky za tebe. Jedno hlídání jsou čtyři věci: co
hledat, kde hledat, jak často a co udělat, až se to najde.

Řekněme, že divadlo inscenaci ještě nevypsalo. Založíš hlídání s frází `Maryša`, vložíš
adresy divadel, která tě zajímají, necháš *týdně* a zapomeneš na to. Worker ty stránky při
svém obvyklém cronu stáhne, vyhází HTML a hledá frázi. Na diakritice ani velikosti písmen
nezáleží a najde i název rozsekaný značkami (`<b>Mary</b>ša`).

Když něco najde, objeví se nález nahoře v panelu s adresou, úryvkem okolního textu a otázkou
**„Tohle jsi hledala?"**:

- **Ano** — hlídání podle tvé volby pozastaví, smaže, nebo nechá běžet dál.
- **Ne** — tu adresu si zapamatuje a už ji nikdy nenahlásí.

Dokud neodpovíš, hlídání mlčí, takže tě na stejnou věc neupozorní dvakrát.

**Termíny a vstupenky.** Nález s sebou nese i to, co se ze stránky dalo přečíst: termíny
*té tvé* inscenace (s časy, když jsou uvedené) a nejlepší nalezený odkaz do prodeje — cizí prodejnu,
když na ni stránka odkazuje, jinak kotvu na vstupenky na stránce samotné. U každého termínu
Na celosezónním výpisu programu se do toho nepletou sousední dny jiných kusů: datum patří té
položce, před kterou stojí, takže se berou jen termíny, které vedou k výskytu tvojí fráze.
U každého termínu jsou dvě tlačítka: **Do kalendáře tady** zapíše událost rovnou do tvého
Google Kalendáře přes
appku (kalendář musí být odemčený PINem) a **Do Google kalendáře** otevře v nové záložce
předvyplněný formulář Googlu, který funguje, i kdybys kalendář nikdy nepropojila. Událost trvá
dvě a půl hodiny; termín bez času se založí jako celodenní.

> Jestli je ještě volno, Hlídač nepozná. Divadla to nechávají na prodejním widgetu, který běží
> až v prohlížeči, a Worker JavaScript nespouští. Hledat v HTML slovo „vyprodáno" taky
> nefunguje — GoOut ho veze ve svém skriptu, takže se objeví i na stránce, kde žádné
> představení není. Místo falešné jistoty je v nálezu odkaz do prodeje, jeden klik od pravdy.

**Výchozí zdroj adres.** V Nastavení si vybereš jednu oblast desky jako adresář Hlídače — nové
hlídání se předvyplní jejími odkazy a ty nepotřebné smažeš. Nic není zadrátované; když oblast
smažeš, nová hlídání prostě začnou s prázdným seznamem.

**O úroveň hlouběji.** Zaškrtávátko u jednotlivého hlídání. Kromě zadané adresy projde i
odkazy na tomtéž webu, jejichž adresa nebo popisek vypadá na program (`program`,
`repertoar`, …), nejvýš dvanáct na jednu adresu. Chytí víc divadel, ale stáhne řádově víc
stránek, takže je ve výchozím stavu vypnuté.

**Hlídání rovnou z odkazu, který už máš.** Každý odkaz v oblasti má tlačítko 👁. Zmáčkneš ho a
hlídání se založí samo: fráze je název odkazu, adresa je jeho vlastní adresa, interval týden a
rovnou je napojené zpátky na tu oblast. Nic nepíšeš dvakrát. Co je v názvu za pomlčkou,
svislítkem nebo závorkou, se bere jako tvoje poznámka a do fráze nejde, takže „debata pro loutky
- doporučila aisha" se hlídá jako `debata pro loutky`. U hlídaného odkazu se 👁 rozsvítí a další
stisk už jen otevře Hlídač, místo aby založil druhé hlídání. Každé hlídání má tlačítko
**Upravit**, které ho rozklikne: adresy, na kterých hlídá (každá na svůj řádek), frázi, název,
interval, hloubkový režim i napojenou oblast. Takže co si appka domyslela — nebo cos poprvé
napsala jinak — opravíš na jedno kliknutí.

**Napojení hlídání na oblast.** Při zakládání hlídání mu můžeš přiřadit jednu ze svých
oblastí a volba se zapamatuje na příště. Hlídání pak v té oblasti hledá položku, jejíž název
odpovídá — nejdřív celou frází, pak všemi jejími slovy kdekoli v názvu, bez ohledu na
diakritiku a velikost písmen. Hlídání pojmenované `debata` tak najde položku
„debata pro loutky - doporučila aisha".

Když pak některý z termínů vložíš do kalendáře, zapíše se ten samý termín i do popisku té
položky („Hraje se 25. 10. 2026 · 17:00") a položka se nastaví tak, aby se po termínu sama
smazala. Smaže se při úklidu v 6:00 a spadne do Koše jako všechno ostatní, takže máš 30 dní na
rozmyšlenou. Nález ti ukáže, na kterou položku se napojil, ještě než na cokoli klikneš — a když
žádnou nenajde, napíše to.

**Upozornění.** Nálezy chodí přes ntfy (stejné `NTFY_TOPIC` jako rozbité odkazy) a e-mailem,
když nastavíš klíč k Resendu — `wrangler secret put RESEND_KEY` a adresu v Nastavení. Bez
obojího se nic nerozbije, nálezy na tebe jen počkají v panelu.

> Hlídač chodí na cizí weby. Respektuje `robots.txt`, představuje se jako
> `Rozcestnik-Watcher/1.0`, po deseti vteřinách stránku vzdá a na jeden běh cronu stáhne
> nejvýš 25 stránek — na co nedojde, počká na další hodinu. Stránky, které si program
> dokreslují JavaScriptem, takhle přečíst nejdou a takové hlídání se prostě nikdy netrefí.

## Sdílení výřezu desky (ke čtení i k úpravám)
V liště je tlačítko **Sdílení**. Umí vytvořit odkaz, který ukáže jen vybrané věci (jednu i víc
oblastí, bloky cílů, úkoly) – ne celou tvou stránku. Podle nastavení je obsah buď jen ke čtení,
nebo ho příjemce může i upravovat.

Při vytváření vybíráš:
- **Co sdílet** – zaškrtneš oblasti / bloky / úkoly (klidně víc najednou).
- **Přístup:**
  - *Jen ke čtení* – příjemce obsah jen vidí.
  - *I k úpravám* – příjemce může vybrané oblasti/cíle/úkoly **přidávat, měnit a mazat** (a úkoly
    odškrtávat). Mění se tím tvá skutečná data. Úpravy jsou omezené jen na to, co jsi nasdílel/a
    – ke zbytku desky se přes odkaz nedostane. **U úprav důrazně doporučujeme režim *Soukromé
    (heslo)*** – jinak může měnit tvá data kdokoli, kdo odkaz získá.
- **Režim:**
  - *Veřejné přes odkaz* – odkaz uvidí každý, kdo ho má. Adresa je náhodná a neuhádnutelná,
    takže dokud ji nikomu nepošleš, nikdo ji nenajde.
  - *Soukromé (heslo)* – adresát potřebuje odkaz **i** heslo. Heslo pošli jinou cestou než
    odkaz. (Appka nemá účty – soukromí tu zajišťuje právě heslo u odkazu; heslo se ukládá jen
    jako otisk, ne čitelně.)
- **Platnost** – 24 h / 7 dní / 30 dní / bez konce. Po vypršení odkaz přestane fungovat (vč.
  úprav); dávno prošlá sdílení se po čase sama smažou.
- **Upozornit před vypršením** – pošle push (přes ntfy, viz níže) s odkazem zpět do appky, kde
  sdílení jedním klikem **prodloužíš**.

Hotový odkaz pak rovnou *zkopíruješ*, pošleš přes systémové *Sdílet…* (Messenger, WhatsApp…)
nebo *E-mailem*. U každého existujícího sdílení můžeš kdykoli změnit platnost (*Prodloužit*)
nebo ho úplně zrušit (×). Odkaz vede na `…/s/<kód>`.

> Souběh úprav: appka není živý kolaborativní editor. Tvoje stránka se sama občerství při návratu
> do okna a zhruba každých 30 s, aby ti vlastní ukládání nepřepsalo změny od druhého. Když oba
> píšete do téže věci ve stejnou vteřinu, platí poslední zápis.

> Pro push upozornění na vypršení musí být vyplněné `NTFY_TOPIC` (stejně jako u hlášení rozbitých
> odkazů) – viz Poznámky.

## Volitelné: Google Kalendář (obousměrný, za PINem)
Appka umí číst, zakládat, měnit i mazat události v tvém Google Kalendáři. Protože zbytek appky je
otevřený po URL, je kalendář **schovaný za PINem** a celá funkce je **vypnutá, dokud PIN
nenastavíš**. Token ke Googlu leží jen na tvém Workeru (v KV), nikam jinam neteče a do prohlížeče
se neposílá.

**1) Google Cloud (jednorázově):**
1. Jdi na `https://console.cloud.google.com/` → vytvoř projekt (např. „Rozcestnik").
2. *APIs & Services → Library* → najdi **Google Calendar API** → *Enable*.
3. *APIs & Services → OAuth consent screen* → typ **External** → vyplň název a svůj e-mail → v
   *Audience* přidej svůj Google účet do **Test users** (víc netřeba).
4. *APIs & Services → Credentials → Create credentials → OAuth client ID* → typ **Web
   application**. Do **Authorized redirect URIs** přidej přesně:
   `https://TVOJE-ADRESA/api/cal/callback`
   (TVOJE-ADRESA je adresa Workeru z `wrangler deploy`, např. `rozcestnik.tvuj-ucet.workers.dev`).
5. Zkopíruj si **Client ID** a **Client secret**.

**2) Nastav tři tajné hodnoty Workeru** (neukládají se do souboru ani do gitu):
```bash
echo -n "PIN"        | wrangler secret put CAL_PIN              # vymyšlený PIN ke kalendáři
echo -n "CLIENT_ID"  | wrangler secret put GOOGLE_CLIENT_ID     # Client ID z kroku 1
echo -n "SECRET"     | wrangler secret put GOOGLE_CLIENT_SECRET # Client secret z kroku 1
wrangler deploy
```
> Používej `echo -n "hodnota" | wrangler secret put KLIC`, ne psaní do skryté výzvy — ta umí
> uložit jen první znak.

**3) Propojení:** v liště otevři **Kalendář** → zadej PIN → *Připojit Google Kalendář* → přihlas
se Googlem a povol přístup. Hotovo.

**Zobrazení a ovládání:**
- Nahoře přepínáš **Měsíc / Týden / Seznam**. Měsíc je mřížka 7 sloupců × týdny v řádcích; první
  a poslední řádek dorovnávají dny ze sousedních měsíců (jsou zesvětlené). Šipkami ‹ › listuješ,
  *Dnes* skočí na dnešek.
- **Týden od** přepíná, jestli týden začíná pondělím nebo nedělí (uloží se).
- Klik na **den** otevře nové akce s předvyplněným datem, klik na **akci** ji otevře k úpravě.
  U akce lze vyplnit i **popis** (jako detail v Google Kalendáři).
- **PIN se po prvním zadání pamatuje** v prohlížeči, takže tě to už neodhlašuje. Na
  cizím/sdíleném zařízení ho po sobě smaž tlačítkem *Odhlásit PIN*.

**Barvy** (tlačítko *Barvy* v liště kalendáře):
- Výchozí barva zvlášť pro **hodinové**, **celodenní** a **vícedenní** akce.
- **Pravidla podle slov** – když má akce v názvu/popisu dané slovo (např. „ríša"), obarví se
  zadanou barvou. Dá se jich přidat víc; bere se první, které sedí.
- **Vlastní barva u konkrétní akce** (v okně akce zaškrtni *vlastní*) – má přednost před pravidly
  i výchozími barvami.
- **Propisovat barvy do Googlu** je volitelné. Pozor: Google na úrovni události umí jen 11
  pevných barev, takže se vybere nejbližší; v appce vždy vidíš přesný odstín. Pořadí přednosti:
  vlastní u akce → pravidlo podle slova → výchozí dle typu.

**Chci si zobrazení upravit / udělat vlastní:** celé vykreslování kalendáře je v
`public/index.html` ve funkcích `renderMonth()`, `renderWeek()` a `renderCalList()` (mřížku
počítají `monthGrid()` / `weekGrid()`). Nový pohled přidáš tak, že napíšeš vlastní `renderXxx()`,
přidáš tlačítko s `data-act="cal-view" data-view="xxx"` a do `renderCal()` větev, která ho zavolá.
Styly mřížky jsou v konstantě `CAL_CSS` hned nad tím – barvy, výšku buněk i rozložení na mobilu
si tam můžeš osahat.

> Pozn.: dokud necháš consent screen v režimu *Testing*, Google může po ~7 dnech chtít nové
> přihlášení. Pro trvalý klid dej appku do *Production* (u osobní appky stačí i tak, případně projít
> ověřením Googlu).

## Hledání knih (legální zdroje)
V liště je tlačítko „Knihy" (jde vypnout v Nastavení → „Hledání knih"). Zadáš název, autora, jazyk
a formát; appka hledá v **Project Gutenberg**, **Wikisource** a **Open Library / Internet Archive**:
- volná díla (public domain) → vloží přímý odkaz na soubor do zvolené oblasti,
- díla pod autorským právem → ukáže, kde je legálně půjčit/získat.
Nehledá ve stínových knihovnách a nestahuje pirátský obsah. (Volné dílo ≠ každý překlad je volný.)

## Volitelné: ukládat knihy do appky (R2)
Bez nastavení appka u volných děl jen vloží odkaz na soubor. Kdo chce mít soubor uložený přímo
v appce, zapne si R2:
1. `wrangler r2 bucket create rozcestnik-books`
2. ve `wrangler.toml` odkomentuj blok `[[r2_buckets]]` (binding `BOOKS`)
3. `wrangler deploy`
R2 má 10 GB zdarma a bez poplatků za stahování (řádově tisíce epubů). U volných děl se pak objeví
tlačítko „Uložit soubor do appky". Tahle volba je nepovinná – kdo si R2 nezaloží, má pořád funkční
hledání i vkládání odkazů.

## Volitelné: Sledování menstruačního cyklu (za PINem)
V liště je tlačítko **Cyklus**. Zaznamenáváš začátky menstruace (a volitelně konce); appka
spočítá **průměrnou délku cyklu a menstruace** a **předpoví** další menstruace, plodné okno
a ovulaci, to vše v kompaktním měsíčním kalendáři (sloupce = dny v týdnu, jako malý Google-kalendář) (zaznamenané dny, předpověď, okno nejistoty, plodné okno
a ovulace mají různé značení). Aby zvládl nepravidelné cykly (stres, stěhování, nemoc…), počítá
z **mediánu** posledních cyklů místo prostého průměru (jeden divný cyklus jím skoro nehne),
předpověď ukazuje jako **okno, ne jediný den**, označí, jak **pravidelné** cykly jsou, a při
velkém kolísání odhad rozšíří a upozorní na to; každý záznam můžeš označit jako **atypický**, aby
se do statistik nezapočítával. Protože jde o citlivá zdravotní data, **neukládají se do otevřené desky** —
leží v samostatném klíči a jsou **schovaná za stejným PINem jako kalendář** (`CAL_PIN`); bez PINu
je nikdo přes adresu nenačte. Zůstávají jen v tvém Cloudflare a nikam se neodesílají. Barvy jednotlivých fází si můžeš změnit a fáze volitelně promítnout buď do appkového kalendáře (nic neopustí tvůj Cloudflare), nebo poslat předpověď do Google Kalendáře — to ale tato citlivá data sdílí s Googlem (třetí strana); appka tě předtím varuje. Předpovědi
jsou orientační odhad z kalendářního algoritmu — **ne lékařská rada a ne antikoncepce**; přesnost
roste s počtem zaznamenaných cyklů a u nepravidelných cyklů je nižší.

## Vibecoded — přidej si modul přes AI
Tahle appka je **vibecoded** — vznikla po krocích ve spolupráci s AI. Když chceš, můžeš si
snadno vytvořit vlastní modul nebo něco upravit: **popiš, co chceš, vlož do AI všechny
soubory projektu a začni úvodním promptem** v [`PROMPT.md`](PROMPT.md). Ten prompt dá
jakékoli AI architekturu, zvyklosti a pravidla, aby se projektu dobře chytla (jednosouborový
vanilla-JS frontend, Cloudflare Worker + KV, dvojjazyčné UI, jen legální zdroje, data
zůstávají u tebe v Cloudflare). Pak už jen dole do promptu napíšeš svůj modul.

## Licence

MIT, viz [`LICENSE`](LICENSE). Dělej si s tím, co chceš; bez jakékoli záruky.

## Soubory
- `public/index.html` — vzhled a logika webu/appky
- `public/share.html` — prohlížeč sdílených odkazů ke čtení/úpravám (`/s/<kód>`)
- `public/manifest.webmanifest`, `public/sw.js`, `public/icon-*.png` — instalace jako appka
- `src/index.js` — API, kontrola odkazů, kalendář, sdílení, kurzy měn, hlídač
- `wrangler.toml.example` — šablona configu, průvodce z ní vyrobí `wrangler.toml`
- `wrangler.toml` — KV, plán kontroly, push, volitelné secrety/R2 (tvůj, v repozitáři není)
Po úpravách znovu `wrangler deploy`.

## Poznámky
- Přejmenování a mazání: název stránky změníš v Nastavení (výchozí „Rozcestník"); zápatí odkazuje na tvůj Cloudflare; v Nastavení je **Nebezpečná zóna**, která trvale a nevratně smaže všechna data, a panel Cyklus má vlastní tlačítko, které smaže jen data cyklu.
- **Bez hesla:** kdokoli s adresou vidí i mění obsah. Na osobní seznam to obvykle stačí — jen
  adresu nedávej veřejně.
- **Push na rozbité odkazy:** vyplň `NTFY_TOPIC` v `wrangler.toml` a v telefonu se v appce *ntfy*
  přihlas ke stejnému tématu.
- **Data zůstávají u tebe:** vše leží v tvém Cloudflare (KV/R2). Výjimky: favicony se načítají
  z Googlu, kontrola odkazů navštěvuje tvé uložené odkazy a Google Kalendář (když ho propojíš)
  komunikuje s Googlem. K autorovi appky neteče nic.
