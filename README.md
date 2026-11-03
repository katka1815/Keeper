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

## Install: three ways · Instalace: tři cesty

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/katka1815/Keeper)

New to Cloudflare? A step-by-step page: **[katka1815.github.io/Keeper](https://katka1815.github.io/Keeper/)** · Cloudflare neznáš? Stránka krok za krokem: **[katka1815.github.io/Keeper](https://katka1815.github.io/Keeper/)**

| | 🇬🇧 English | 🇨🇿 Česky |
|---|---|---|
| **1. Deploy to Cloudflare** (recommended · doporučeno) | Click the button above. You need free **Cloudflare** and **GitHub** accounts. Confirm the setup page; every optional field can stay empty. Storage (KV) and the hourly job are created for you. Your data lives in your own account and is encrypted from the first save. | Klikni na tlačítko výš. Potřebuješ účet na **Cloudflare** a na **GitHubu** (oba zdarma). Potvrď stránku s nastavením, všechna nepovinná pole můžou zůstat prázdná. Úložiště (KV) a hodinová úloha se založí samy. Data leží na tvém vlastním účtu a jsou šifrovaná od prvního uložení. |
| **2. Installer on your computer** | Download the ZIP, double-click **`Click this to install the app.bat`** (Windows) or **`… (Mac).command`**. Same result as 1, without GitHub; needs Node.js (the wizard helps). See [`INSTALL.md`](INSTALL.md). | Stáhni ZIP a dvojklikni na **`Click this to install the app.bat`** (Windows) nebo **`… (Mac).command`**. Výsledek jako u 1, jen bez GitHubu; potřebuje Node.js (průvodce pomůže). Viz [`INSTALL.md`](INSTALL.md). |
| **3. Only on my computer** | The same installer, option **[2] full privacy**: runs locally, no account at all, but not reachable from your phone. | Stejný průvodce, volba **[2] úplné soukromí**: běží jen u tebe, bez jakéhokoli účtu, ale z telefonu se k ní nedostaneš. |

**Right after installing, open your new address and set a password.** Until then whoever opens
it first sets it. The app then walks you through the phone app, the browser extension and a QR
code for your phone. · **Hned po instalaci otevři svou novou adresu a nastav heslo.** Do té doby
ho nastaví ten, kdo ji otevře první. Appka tě pak provede telefonem, rozšířením do prohlížeče
a QR kódem pro telefon.

Your address (`https://<name>.<your-account>.workers.dev`) is in the Cloudflare dashboard under
**Workers & Pages**. · Svou adresu najdeš v Cloudflare v **Workers & Pages**.

---

# English

On the first visit the app asks you to set a **password**; without it nobody gets to your data
(details under *Using it → Lock*). The **cycle** is additionally encrypted in the browser with
its own password, so not even the server or Cloudflare can read it. The calendar is behind a
PIN; shares can be public-by-link or password-protected.

## Deploy
**Easiest:** unzip and double-click **`Click this to install the app.bat`** (Windows) or **`Click this to install the app (Mac).command`** (macOS) — a wizard walks you through everything. See [`INSTALL.md`](INSTALL.md). Manual steps below.

In a terminal, in the project folder (where `wrangler.toml` is):
```bash
npm install -g wrangler
wrangler login          # or use a scoped API token (CLOUDFLARE_API_TOKEN)
wrangler deploy
```
The config has no KV id: `wrangler deploy` (4.45 or newer) and the Deploy button create the
storage in your own account on the first deploy, and the installer creates it and writes the id in.
Optional secrets (ntfy, calendar, Resend) are listed in `.dev.vars.example`; set them with
`wrangler secret put <NAME>`.
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
   Google Calendar credentials. Each is stored as an encrypted Worker secret.
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

## Android app (APK) with sharing and a widget
The `android/` folder is a thin Android wrapper. It asks once for the address of your
Rozcestník and then:
- **opens the app** in its own window; links that lead elsewhere open in the browser,
- **appears in the Share menu** of every app: share a page, a text or pictures → a small
  "Save to Rozcestník" window with an optional note → the item lands in **To process**
  (pictures are shrunk to about 300 kB first),
- **adds a home-screen widget** "Quick note…" (long-press the home screen → Widgets →
  Rozcestník) and a "Quick note" shortcut on a long-press of the icon. "App address" in the
  same menu changes the address.

A ready-made build is at
[Releases](https://github.com/katka1815/Keeper/releases/latest/download/Rozcestnik.apk).
Its only permission is internet access, and it talks only to the address you enter. Build
it with `bash android/build.sh <version number>` in Git Bash; it needs a portable JDK 17 and
the Android SDK (platform 34, build-tools 34.0.0) in the folder named by `TOOLS`. No Gradle.
The signing key is created on the first build next to the tools — keep it, a build signed
with another key cannot be installed over the old one.

**Example: saving from Instagram.** On a post tap the paper plane (or ⋯) → *Share to…* →
**Rozcestník**, add a note, Save. Instagram shares only the link, not the picture, and gives
no usable title without a login, so the note is what tells you later what it was. For the
picture itself take a screenshot and share it from the gallery. The same works from YouTube,
the browser or anything else with a Share button.

iPhone has no such wrapper; use
*Add to Home Screen* above and the Shortcuts recipe below.

## Quick-capture widget
The home-screen app is full screen; for a **widget** (a capture button) use:
- **iPhone:** Shortcuts → action "Get Contents of URL", POST to
  `https://YOUR-ADDRESS/api/capture`, JSON body `{"type":"point","text":"…"}`. Add the
  shortcut to the home screen (Shortcuts widget). No password header needed.
- **Android:** the app above brings its own widget. Without it: the *HTTP Shortcuts* app →
  POST to the same endpoint, same JSON body, then place the widget on the home screen.
To save links by sharing, set `"type":"link"` and put the shared link in `"url"`.

## Using it
- What comes from the phone appears at the top in "To process" — from there you file it
  into an area or into tasks.
- **Ctrl+V anywhere** puts a clipboard image (e.g. Win+Shift+S) into "To process", shrunk to
  ~300 kB. Pasting a link or text outside a text box saves it there too.
- In "To process", **List / Grid** switches between rows and cards with previews. **Sort**
  goes through the items one by one: keys 1–9 file the item into the numbered area, U moves a
  note to tasks, Enter skips, Delete removes, Esc stops.
- **Search finds everything:** areas (hidden ones too, the matches show as a number in the
  hidden bar), To process, the saved text of web pages and the text in screenshots. Accents
  don't matter (`svickova` finds *Svíčková*) and several words may be in any order.
- **Saved page text:** for every link the app stores the readable text of the page, so it
  stays even when the site disappears. 📄 next to a link opens it. New links get it right
  away; older ones are filled in by the hourly job, a few at a time.
- **Text in images:** screenshots and photos are read in your browser (Tesseract.js, free,
  nothing is sent anywhere; about 10 MB is downloaded once). Can be turned off in Settings.
- **Duplicates:** To process shows "Already in area …"; adding a link by hand that you
  already have asks first; import skips links you already have.
- **Cards with previews:** an area's ⋯ menu → *Cards with previews* shows the links as cards
  with the page's picture.
- **Backup and import** (Settings → Backup and import): *Download backup* saves everything,
  images included, into one JSON file, and the same button restores it (what was there before
  is kept on the server for 30 days). *Download as bookmarks* gives an HTML file any browser
  can import. *Import* reads bookmarks from Firefox or Chrome (folders become areas), CSV from
  Pocket, Raindrop or mymind, or a plain list of addresses.
- **Lock:** on the first visit the app asks for a password (at least 12 characters, a few
  words work best), an optional hint and gives you a **recovery code** to save. The password
  never leaves the browser; the server only gets a key derived from it. When signing in you
  choose *My device* (stays signed in) or *Someone else's device* (signs out after 20 minutes
  idle or when the tab closes). Settings → Security: sign out, sign out other devices, change
  password, new recovery code. Forgot the password? *Forgot password* + the recovery code.
  Sending from the phone, the extension and the widget keeps working without a password (it
  can only add to To process, never read). Shared links have their own access.
- **Content encryption:** new installs encrypt from the start; an existing one turns it on in
  Settings → Security → *Encrypt content* (asks for the password and gives a new recovery code).
  Names, texts, notes, tasks, goals, To process, saved page text and watcher hits are then
  encrypted with a key the server never gets, so not even Cloudflare can read them. Link
  checking, the watcher, saved page text and search keep working. Readable stay: link
  addresses (the server checks them), watcher phrases and addresses, numbers (amounts), settings
  and shared areas (the recipient has to read them). **Images** are encrypted too: a pasted image
  is locked already by the page, one from the phone or the extension by the server on arrival (it
  sees it for a moment, doesn't store it readable); older ones get locked in batches. When sharing
  you choose whether the images are readable for the recipient (then they are readable on the
  server too, and the app warns that Cloudflare gets them) or stay encrypted (the recipient sees
  "🔒 encrypted image"). **Private area** (area ⋯ menu)
  encrypts its addresses too; the server then doesn't check them, save their text or watch
  them, and the app shows only a letter instead of the site icon and no page previews, so the
  address never reaches the server. Watcher alerts via ntfy or e-mail then only say "match found", with no content. The
  backup is encrypted; only this app with your password opens it.
- Quick task: the box above the board drops a task straight to the top of the list — type and hit **+**.
- Areas: add, rename, move ◀ ▶.
- Links: drag on desktop, arrows ▲ ▼ on the phone.
- New area: also from the **+ New area** button in the Links & reminders header.
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

## Look and desk
Settings → **Look**: theme (*Current* black and white, *Dune* warm paper and aubergine ink with
soft corners, *Golden hour* parchment), **dark mode** (follow system / on / off), corners, density
and font (system fonts only, nothing is downloaded).

- **Header and footer image:** like Dune, across the full width, fading into the page. Choose in
  the gallery: 16 public-domain paintings stored inside the app (Mánes, Kaván, Mařák, Monet, Pissarro,
  Sisley, Hokusai, Hiroshige, Turner, Aivazovsky, Friedrich), drawn gradients, or your own photo
  (stored encrypted with content encryption). Top and bottom, top only, bottom only, or none.
  The header shows the upper part of the painting and the footer the lower part; their edge is
  not a straight cut but follows a line in the painting (horizon, ridge, wave crest, slope), so
  the page sits inside the picture. Optionally: **tab colours from the painting** (areas take
  the painting's palette) and a **painting detail next to the title** (Monet's red sun, Turner's
  ship, Friedrich's figures…).
- **Tidy up** (button next to the quick task): every section and module goes into the top bar;
  only the image, the bar, search and the quick task stay. Pressing it again brings the desk back
  as it was. *To process · N* shows waiting items.
- **Sort links by use:** what you click most moves up in its area (old clicks fade). The ▲▼
  arrows or the area's ⋯ menu switch that area to manual order.
- **Tasks** can be dragged by the ⠿ handle above another task (mouse and finger).
- **By time of day** (optional): mornings put tasks on top, evenings golden hour, nights dark mode;
  the painting changes with the part of the day.
- Settings show only Look and Desk; everything else is under **Advanced**. The ⚙ next to Tasks and
  Links jumps straight to their settings.

## Layout: sections, tabs and panels
The page is modular. The main sections (**Goals & periods**, **Tasks & notes**, **Links &
reminders**, **To process**) and the tools in the top bar all follow the same rules:

- **Remove grid** (button above the areas): no rules at all. Grab an area by its header and drop
  it anywhere, even half over another one; the one you grabbed last is on top. Areas don't jump
  when you switch, *Back to grid* returns to the previous layout (your free positions are kept
  for next time). On a phone the areas stay one below the other.

- **Top bar tabs.** Goals, Tasks and Links have their own tabs next to Calendar, Watcher and the
  rest. Each of those three sections can be **expanded on the page**, **collapsed on the page**
  (just its header), or **top bar only**, where it leaves the page and opens as a panel from its tab.
  Switch this with the buttons in the section header or in Settings → Layout.
- **Panels open side by side.** Opening a second panel puts it to the left of the first, and a
  third goes above those two. Every panel has its own × in the top-right corner, and
  **× Close all** sits above them. Hovering any × tints red what it would close. Esc closes the
  most recent panel.
- **Resize any section** by dragging its corner or edges. Only the section body scrolls, so the
  header and the handle stay put. Double-click the corner to reset the size.
- **Drag sections anywhere** by their header. Drop one next to another and it joins that row,
  filling the free space and matching the row height. Drop it above, below or between rows and it
  gets its own row back at the size it had before. Drag a section's corner to make that its own size.
- **On the phone** tap **✥ Edit layout**. Sections shrink to their headers, you drag them with a
  finger and tap **✓ Done** in the corner.

## Browser extension (Firefox, Chrome)

The `extension/` folder is a small add-on that saves into **To process**: the current
page (popup with a title and a note, or Alt+Shift+D without the popup), and via right-click
a selected text, a link, an image, or a **screenshot** of the visible part of the page. In
the popup, Ctrl+V attaches an image from the clipboard (e.g. after Win+Shift+S). Images are
shrunk to WebP in the browser and stored in R2 if you have it, otherwise in KV (`img:<id>`).

- **Try it:** Firefox → `about:debugging` → This Firefox → Load Temporary Add-on → pick
  `extension/manifest.json`. It stays until Firefox restarts.
- **Keep it:** Firefox only installs signed add-ons for good. Signing is free: build the zip
  with `npx web-ext build -s extension`, upload it at addons.mozilla.org → Submit a New
  Add-on → **On your own**, and install the signed `.xpi` you get back. It is not published.
  Already uploaded it once? The signed file waits at addons.mozilla.org → **My Add-ons** →
  Rozcestník → **Manage Status & Versions** → the version → download the `.xpi`.
- **Chrome/Edge/Brave:** `chrome://extensions` → Developer mode → Load unpacked → `extension/`.

On first run it asks for your app address and for permission to send data there — and nowhere else.

**Can't see the icon?** Firefox puts a new add-on under the **puzzle piece** at the right of
the toolbar, not on the toolbar itself. Click the puzzle piece → the cog next to Rozcestník →
**Pin to Toolbar**. If Rozcestník is not under the puzzle piece at all, it is not installed:
a temporary add-on from `about:debugging` disappears when Firefox restarts, so install the
signed `.xpi`. If saving fails, open `about:addons` → Rozcestník → **Options**, enter the
app address again and click **Allow** when Firefox asks.

**What to expect.** Alt+Shift+S opens the popup, Alt+Shift+D saves the page straight away.
After every save the toolbar icon shows ✓ for two seconds, or ! on an error (hover the icon
to read it). The right-click menu offers *Save page*, *Capture page* (screenshot), and on a
selection, a link or an image the matching *Save…* item. If a site does not let the image be
downloaded, the link to it is saved instead. Firefox does not let add-ons run on its own
pages (`about:…`, the new tab, addons.mozilla.org). A shortcut that does nothing is usually
taken by another add-on; change it in `about:addons` → cog → Manage Extension Shortcuts.

**Tidy up.** The **Tidy up** button above the board has three levels. *A little* lines the
areas up in a grid of 6 or 5 equally wide columns (heights stay as they are). *Quite a bit*
first asks which areas to hide, collapse or expand. *Completely* also goes through every
item and asks keep/delete (keys N/Enter, S/Delete, Backspace = back); deleted items go to
the Trash. The grid can be removed again from the same place.

**Everything is a module.** Every panel from the top bar (Calendar, Cycle, Watcher, Items,
Money, Books, Sharing, Quotes, Trash, Settings, FAQ) can live on the page like Tasks: open,
collapsed or only in the bar (the default). Use ⤓ in its header or Settings → Layout. On the
page it can be dragged by its header and resized from its edges.



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

> Both lists live on the main board, behind the app password. With content encryption on, names
> and notes are encrypted; amounts and currencies stay readable. Shares never carry them: a share link only
> ever contains the areas, goals and tasks you ticked.

## Watcher (tell me when it shows up)

> This is an outsourced service via Cloudflare, so the link will be known to them. The watcher
> runs on the server (in your Cloudflare), so the watched addresses and phrases stay readable
> there even with content encryption; the app shows this note when you create a watch.

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
The app can read, create, change and delete events in your Google Calendar.

- **Views:** month, week, **day** and list. Week and day can show **hours** (6–23, events placed
  by time, overlapping ones side by side) or **days only**; a week can have the days **side by
  side** or **below each other** (then the hours run left to right).
- **Drag an event** to another day to move it; in the hours view also to another time (15-minute
  steps). Its length stays. **Delete** is in the event's form (click the event).
- **Tasks:** *Show tasks too* puts tasks with a deadline into the calendar (dashed); dragging one
  to another day changes its deadline, clicking it edits the deadline. The 📆 button next to a task
  creates an all-day event for it in Google Calendar (on its deadline, or asks for a day).

The calendar is **hidden behind a PIN** and the whole feature is
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

## Menstrual cycle tracker (encrypted with its own password)
The toolbar has a **Cycle** button. You log period start (and optional end) dates; the app
computes your **average cycle and period length** and **predicts** upcoming periods, the
fertile window and ovulation, shown in a compact month calendar (weekday columns, like a small Google-Calendar month) (logged days, predicted days, the
prediction's uncertainty window, fertile window and ovulation each marked differently).
To cope with irregular cycles (stress, moving, illness…) it uses a **median** of your recent
cycles instead of a plain average (so one odd cycle barely moves it), shows the prediction as a
**window, not a single day**, labels how **regular** your cycles are and widens/flags the
estimate when they vary a lot, and lets you mark any record as **atypical** so it's excluded
from the stats. Because this is sensitive health data, it is **encrypted in the browser** with its
own **cycle password** (AES-GCM, key from PBKDF2 with 600,000 iterations) before it leaves the page.
The server stores only the ciphertext, so neither the server, Cloudflare nor anyone who gets the
data can read it. The first time you open the panel you set the password and an optional hint;
older unencrypted records are encrypted then and the plain copy is deleted. The password
**cannot be recovered**: without it the records can only be deleted. Closing the panel locks it;
on your own device you can tick *Remember on this device* (the key is kept in IndexedDB as a
non-extractable key, which scripts can use but not read); 🔒 Lock and signing out forget it.
It goes into the backup only encrypted. The cycle no longer needs `CAL_PIN`. You can recolor each phase, and optionally project the
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
- `extension/` — browser add-on, `android/` — Android app (wrapper, sharing, widget)
- `tests/` — tests without libraries, run `node tests/run.js`
- `docs/HANDOVER.md` — project state, decisions and pitfalls (Czech)
- `wrangler.toml` — KV (without an id, created on the first deploy), cron schedule, optional R2.
  In the author’s working copy it is `wrangler.toml.example` and `wrangler.toml` stays out of git.
- `.dev.vars.example` — the optional secrets (ntfy, calendar, Resend)
- `package.json` — only for the Deploy button (field descriptions) and `npm test`
After changes run `wrangler deploy` again.

## Notes
- Rename & wipe: rename the page in Settings (default "Rozcestník"); the footer links to your Cloudflare dashboard; Settings has a **Danger zone** that permanently and irreversibly deletes all data, and the Cycle panel has its own button to wipe only cycle data.
- **Password and encryption:** the app is locked with a password (the server only gets a key
  derived from it), the content is encrypted in the browser (see *Content encryption*), and the
  cycle has its own password on top.
- **Broken-link push:** set the `NTFY_TOPIC` secret (`wrangler secret put NTFY_TOPIC`, or the
  field on the Deploy setup page) and in the phone subscribe to the same topic in the *ntfy* app.
- **Data sovereignty:** everything lives in your Cloudflare (KV/R2). Exceptions: favicons are fetched by your own server straight from the sites (cached for
  30 days, Google learns nothing), link checking visits your saved links, Google Calendar (if connected) talks
  to Google, and reading text from images downloads Tesseract.js once from jsdelivr (the images
  themselves never leave the browser). Nothing goes to the app's author.

---

# Česky

Hostovaná stránka na vlastní adrese, dostupná odkudkoliv. Na telefonu se nainstaluje jako
appka (ikona na ploše, běh na celou obrazovku). Drží odkazy, úkoly, bloky cílů, čtecí oblast,
citáty, volitelně Google Kalendář a výběrové sdílení. Data zůstávají v **tvém** Cloudflare účtu.

Při prvním otevření si appka řekne o **heslo**; bez něj se k tvým datům nikdo nedostane
(podrobnosti v *Použití → Zámek*). **Cyklus** je navíc šifrovaný v prohlížeči vlastním heslem,
takže ho nepřečte ani server, ani Cloudflare. Kalendář je za PINem, sdílení může být veřejné
přes odkaz nebo chráněné heslem.

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
   a údaje ke Google Kalendáři. Každé se uloží jako šifrovaný secret Workeru.
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

## Appka pro Android (APK) se sdílením a widgetem
Složka `android/` je tenký androidí obal. Jednou se zeptá na adresu tvého Rozcestníku
a potom:
- **otevírá appku** ve vlastním okně; odkazy, které vedou jinam, se otevřou v prohlížeči,
- **je v nabídce Sdílet** každé appky: nasdílíš stránku, text nebo obrázky → malé okýnko
  „Uložit do Rozcestníku" s nepovinnou poznámkou → položka přistane v **Ke zpracování**
  (obrázky se napřed zmenší asi na 300 kB),
- **přidá widget na plochu** „Rychlá poznámka…" (podrž prst na ploše → Widgety →
  Rozcestník) a zkratku „Rychlá poznámka" při podržení ikonky. „Adresa appky" ve stejné
  nabídce adresu změní.

Hotový build je ke stažení v
[Releases](https://github.com/katka1815/Keeper/releases/latest/download/Rozcestnik.apk).
Jediné oprávnění je přístup k internetu a appka mluví jen s adresou, kterou zadáš. Staví
se přes `bash android/build.sh <číslo verze>` v Git Bash; chce přenosné JDK 17 a Android
SDK (platform 34, build-tools 34.0.0) ve složce z proměnné `TOOLS`. Bez Gradlu. Podpisový
klíč vznikne při prvním buildu vedle nástrojů — schovej si ho, build podepsaný jiným klíčem
nejde nainstalovat přes starý.

**Příklad: uložení z Instagramu.** U příspěvku ťukni na papírovou vlaštovku (nebo ⋯) →
*Sdílet do…* → **Rozcestník**, připiš poznámku, Uložit. Instagram sdílí jen odkaz, ne
obrázek, a bez přihlášení nedá rozumný název, takže až poznámka ti později řekne, o co šlo.
Když chceš samotný obrázek, udělej screenshot a nasdílej ho z galerie. Stejně to funguje
z YouTube, prohlížeče a čehokoli dalšího s tlačítkem Sdílet.

Pro iPhone takový obal není; použij *Přidat na plochu* výš
a recept se Zkratkami níž.

## Widget na rychlý zápis
Appka z plochy je celá obrazovka; pro **widget** (tlačítko na zápis) použij:
- **iPhone:** Zkratky → akce „Získat obsah URL", POST na `https://TVOJE-ADRESA/api/capture`,
  tělo JSON `{"type":"point","text":"…"}`. Přidej zkratku na plochu (widget Zkratky). Žádná
  hlavička s heslem už není potřeba.
- **Android:** appka výš má vlastní widget. Bez ní: appka *HTTP Shortcuts* → POST na stejný
  endpoint, stejné JSON tělo, pak umísti widget na plochu.
Pro ukládání odkazů sdílením nastav `"type":"link"` a do `"url"` vlož sdílený odkaz.

## Použití
- Co přijde z telefonu, je nahoře v „Ke zpracování" — odtud zařadíš do oblasti nebo mezi úkoly.
  U každé věci (odkaz, obrázek i poznámka) jsou dvě tlačítka: **Mezi úkoly** a **Do oblasti** —
  to druhé ukáže všechny oblasti a klikem vybereš, kam věc patří. Odkaz mezi úkoly dostane
  adresu do poznámky úkolu; poznámka v oblasti odkazů je položka bez adresy (adresu jde
  doplnit přes ✎), a když v poznámce adresa je, stane se z ní rovnou odkaz.
- **Ctrl+V kdekoli** vloží obrázek ze schránky (třeba po Win+Shift+S) do „Ke zpracování",
  zmenšený zhruba na 300 kB. Odkaz nebo text vložený mimo políčko se uloží taky.
- V „Ke zpracování" přepíná **Seznam / Mřížka** řádky a karty s náhledy. **Roztřídit** projde
  věci po jedné: klávesy 1–9 zařadí věc do očíslované oblasti, U pošle cokoli mezi úkoly,
  Enter přeskočí, Delete smaže, Esc konec.
- **Hledání najde všechno:** oblasti (i schované, počet nalezených je vidět v liště schovaných),
  Ke zpracování, uložený text stránek i text na screenshotech. Na diakritice nezáleží
  (`svickova` najde *Svíčková*) a víc slov může být v libovolném pořadí.
- **Uložený text stránky:** ke každému odkazu si appka uschová čitelný text stránky, takže
  zůstane, i když web zmizí. Otevře ho 📄 u odkazu. Nové odkazy ho dostanou hned, starší
  doplňuje hodinový běh po pár kusech.
- **Text z obrázků:** screenshoty a fotky přečte tvůj prohlížeč (Tesseract.js, zdarma, nic se
  nikam neposílá; jednou se stáhne asi 10 MB). Vypnout jde v Nastavení.
- **Duplicity:** Ke zpracování ukáže „Už máš v oblasti …“, ruční přidání odkazu, který už
  máš, se napřed zeptá, a import už uložené odkazy přeskočí.
- **Karty s náhledem:** menu ⋯ oblasti → *Karty s náhledem* ukáže odkazy jako karty
  s obrázkem stránky.
- **Záloha a import** (Nastavení → Záloha a import): *Stáhnout zálohu* uloží všechno i
  s obrázky do jednoho souboru JSON a stejný soubor přes Import zase obnoví (co bylo předtím,
  zůstane 30 dní uschované na serveru). *Stáhnout jako záložky* dá HTML, které naimportuje
  každý prohlížeč. *Import* načte záložky z Firefoxu nebo Chromu (složky se stanou
  oblastmi), CSV z Pocketu, Raindropu nebo mymind, nebo obyčejný seznam adres.
- **Zámek:** při prvním otevření appka chce heslo (aspoň 12 znaků, nejlepší je pár slov),
  nepovinnou nápovědu a dá ti **záchranný kód** k uložení. Heslo neopustí prohlížeč, server
  dostane jen klíč z něj odvozený. Při přihlášení vybereš *Moje zařízení* (pamatuje
  přihlášení), nebo *Cizí zařízení* (odhlásí se po 20 minutách nečinnosti a po zavření karty).
  Nastavení → Zabezpečení: odhlásit, odhlásit ostatní zařízení, změnit heslo, nový záchranný
  kód. Zapomenuté heslo: *Zapomenuté heslo* + záchranný kód. Posílání z telefonu, rozšíření
  a widgetu jde dál bez hesla (umí jen přidat do Ke zpracování, nic nepřečte). Sdílené
  odkazy mají vlastní přístup.
- **Šifrování obsahu:** nová instalace šifruje od začátku, stávající si ho zapne v Nastavení →
  Zabezpečení → *Zašifrovat obsah* (chce heslo a dá nový záchranný kód). Názvy, texty, poznámky,
  úkoly, cíle, Ke zpracování, uložený text stránek a nálezy hlídače se pak šifrují klíčem, který
  server nikdy nedostane, takže je nepřečte ani Cloudflare. Kontrola odkazů, hlídač, uložený
  text stránek i hledání jedou dál. Čitelné zůstávají: adresy odkazů (server je kontroluje),
  fráze a adresy hlídače, čísla (částky), nastavení a sdílené oblasti (příjemce je musí přečíst).
  **Obrázky** se šifrují taky: vložený obrázek zamkne už stránka, obrázek z telefonu nebo
  rozšíření server hned při příchodu (na chvilku ho vidí, čitelně ho neuloží), starší se zamknou
  po dávkách. U sdílení si vybereš, jestli budou obrázky pro příjemce čitelné (pak jsou čitelné
  i na serveru a appka upozorní, že je dostane Cloudflare), nebo zůstanou šifrované (příjemce
  uvidí „🔒 šifrovaný obrázek“). **Soukromá oblast** (menu ⋯ oblasti) šifruje i adresy; server je pak nekontroluje,
  neukládá jejich text a nehlídá je a appka místo ikonky webu ukáže jen písmeno a žádné
  náhledy, aby se adresa na server nedostala ani tak. Upozornění hlídače přes ntfy nebo e-mail pak píše jen
  „našel shodu“, bez obsahu. Záloha je šifrovaná a otevře ji jen tahle appka s tvým heslem.
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

## Vzhled a plocha
Nastavení → **Vzhled**: téma (*Současné* černobílé, *Duna* teplý papír a lilkově černá s měkkými
rohy, *Zlatá hodina* pergamen), **tmavý režim** (podle systému / zapnutý / vypnutý), zaoblení,
hustota a písmo (jen systémová písma, nic se nestahuje).

- **Obrázek v záhlaví a zápatí:** jako u Duny, přes celou šířku, do stránky se rozplyne. Vybíráš
  v galerii: 16 volných děl uložených přímo v appce (Mánes, Kaván, Mařák, Monet, Pissarro, Sisley,
  Hokusai, Hiroshige, Turner, Ajvazovskij, Friedrich), kreslené přechody, nebo vlastní fotka
  (se šifrováním obsahu uložená zašifrovaně). Nahoře i dole, jen nahoře, jen dole, nebo žádný.
  Záhlaví ukáže horní část obrazu a zápatí spodní; jejich hrana není rovný řez, ale jde po linii
  v obraze (horizont, hřeben, vlna, svah), takže stránka leží uvnitř obrazu. Volitelně:
  **barvy záložek podle obrazu** (oblasti dostanou paletu obrazu) a **detail z obrazu u názvu**
  (Monetovo slunce, Turnerova loď, Friedrichovy postavy…).
- **Uklidit** (tlačítko vedle rychlého úkolu): všechny sekce a moduly jdou do horní lišty, zůstane
  jen obrázek, lišta, hledání a rychlý zápis. Druhé kliknutí vrátí plochu, jak byla.
  *Ke zpracování · N* ukáže, co čeká.
- **Řadit odkazy podle používání:** na co klikáš nejvíc, jde v oblasti nahoru (staré klikání
  slábne). Šipky ▲▼ nebo menu ⋯ oblasti přepnou oblast na ruční pořadí.
- **Úkoly** chytíš za úchyt ⠿ a přesuneš nad jiný úkol (myší i prstem).
- **Podle denní doby** (volitelné): ráno jsou nahoře úkoly, večer zlatá hodina, v noci tmavý
  režim; obraz se mění podle části dne.
- V Nastavení je nahoře jen Vzhled a Plocha, zbytek je pod **Pokročilé**. ⚙ u Úkolů a Odkazů
  skočí rovnou na jejich nastavení.

## Rozložení: sekce, záložky a panely
Plocha je modulární. Hlavní sekce (**Cíle a období**, **Úkoly a poznámky**, **Odkazy a
připomínky**, **Ke zpracování**) i nástroje v horní liště se řídí stejnými pravidly:

- **Rozdělit desku** (výběr ▦ nad oblastmi): deska se rozdělí na **poloviny**, **třetiny**,
  **čtvrtiny vedle sebe** nebo **čtvrtiny 2 × 2**. Každá část má svůj **název** (klikni na něj),
  **barvu pozadí** (barevný čtvereček, × ji zruší) a vlastní rozložení: **Volně (chaoticky)** —
  oblasti v ní chytneš za hlavičku a položíš kamkoli — nebo **1–4 stejně široké sloupce**.
  Oblast přestěhuješ do jiné části přetažením (za ⠿, ve volné části i za hlavičku), nebo
  v menu ⋯ oblasti → *Do části*. Tlačítko + v hlavičce části založí oblast rovnou v ní.
  **Velikosti jdou měnit libovolně:** táhni za okraj mezi částmi (šířka), za spodní okraj části
  (výška řady, u 2 × 2 zvlášť horní a dolní) nebo za předěl mezi sloupci uvnitř části.
  Dvojklik na úchyt vrátí stejné šířky nebo výšku podle obsahu.
  *Nerozdělovat* vrátí původní desku; části, jejich názvy i rozmístění zůstanou uložené na příště.
  Na telefonu jsou části pod sebou.
- **Zrušit mřížku** (tlačítko nad oblastmi): žádná pravidla. Oblast chytneš za hlavičku a položíš
  kamkoli, klidně napůl přes jinou; navrch je ta naposled chycená. Při přepnutí nic neposkočí,
  *Zpět do mřížky* vrátí předchozí rozložení (volné pozice si appka pamatuje na příště). Na
  telefonu zůstávají oblasti pod sebou.

- **Záložky v horní liště.** Cíle, Úkoly a Odkazy mají svoje tlačítka vedle Kalendáře, Hlídače
  a dalších. Každá z těch tří sekcí může být **rozbalená na ploše**, **sbalená na ploše** (jen
  nadpis), nebo **jen v liště**, kdy z plochy zmizí a otevírá se tlačítkem jako panel. Přepíná se to
  tlačítky v nadpisu sekce nebo v Nastavení → Rozložení.
- **Panely vedle sebe.** Druhý otevřený panel se otevře vlevo od prvního a třetí nad nimi.
  Každý má vpravo nahoře svůj ×, nad panely je **× Zavřít vše**. Při najetí na křížek zčervená,
  co se zavře. Esc zavře naposledy otevřený panel.
- **Velikost jde měnit u každé sekce** tažením za roh nebo kraj. Roluje jen obsah, nadpis
  i úchyt zůstanou na místě. Dvojklik na roh velikost vrátí.
- **Sekce jde přetáhnout kamkoliv** za nadpis. Pustíš ji vedle jiné a přidá se do její řady:
  zabere volné místo a srovná se s řadou na výšku. Pustíš ji nad, pod nebo mezi řady a dostane
  vlastní řadu a rozměry, které měla předtím. Když za roh natáhneš jinou velikost, stane se jejím
  vlastním rozměrem.
- **Na telefonu** klepni na **✥ Upravit plochu**. Sekce se zmenší na nadpisy, přetáhneš je
  prstem a skončíš tlačítkem **✓ Hotovo** v rohu.
- **Novou oblast** založíš i tlačítkem **+ Nová oblast** v hlavičce Odkazů a připomínek.

## Rozšíření do prohlížeče (Firefox, Chrome)

Složka `extension/` je malý doplněk, který ukládá do **Ke zpracování**: aktuální stránku
(okýnko s názvem a poznámkou, nebo Alt+Shift+D bez okýnka) a přes pravé tlačítko označený
text, odkaz, obrázek nebo **screenshot** viditelné části stránky. V okýnku Ctrl+V přiloží
obrázek ze schránky (třeba po Win+Shift+S). Obrázky se v prohlížeči zmenší do WebP a uloží
do R2, když ho máš, jinak do KV (`img:<id>`).

- **Vyzkoušet:** Firefox → `about:debugging` → Tento Firefox → Načíst dočasný doplněk →
  vyber `extension/manifest.json`. Vydrží do restartu Firefoxu.
- **Natrvalo:** Firefox natrvalo nainstaluje jen podepsaný doplněk. Podpis je zdarma: zabal
  zip přes `npx web-ext build -s extension`, nahraj ho na addons.mozilla.org → Submit a New
  Add-on → **On your own** a nainstaluj podepsaný `.xpi`, který dostaneš zpět. Nikde se nezveřejní.
  Už jsi ho jednou nahrála? Podepsaný soubor čeká na addons.mozilla.org → **My Add-ons** →
  Rozcestník → **Manage Status & Versions** → verze → stáhni `.xpi`.
- **Chrome/Edge/Brave:** `chrome://extensions` → Režim pro vývojáře → Načíst rozbalené → `extension/`.

Při prvním spuštění se zeptá na adresu appky a na povolení posílat tam data — a nikam jinam.

**Nevidíš ikonku?** Firefox dává nový doplněk pod **dílek puzzle** vpravo na liště, ne přímo
na lištu. Klikni na dílek puzzle → ozubené kolo u Rozcestníku → **Připnout na lištu**. Když
tam Rozcestník vůbec není, není nainstalovaný: dočasný doplněk z `about:debugging` po restartu
Firefoxu zmizí, takže nainstaluj podepsaný `.xpi`. Když ukládání nejde, otevři `about:addons`
→ Rozcestník → **Možnosti**, zadej znovu adresu appky a na dotaz Firefoxu dej **Povolit**.

**Co čekat.** Alt+Shift+S otevře okýnko, Alt+Shift+D uloží stránku rovnou. Po každém uložení
se na ikonce v liště na dvě vteřiny ukáže ✓, při chybě ! (text chyby je vidět po najetí myší
na ikonku). Pravé tlačítko nabízí *Uložit stránku*, *Vyfotit stránku* (screenshot) a na
označeném textu, odkazu nebo obrázku příslušné *Uložit…*. Když web stažení obrázku nedovolí,
uloží se aspoň odkaz na něj. Na vlastních stránkách Firefoxu (`about:…`, nová karta,
addons.mozilla.org) doplňky běžet nesmějí. Zkratku, která nic nedělá, má nejspíš zabranou
jiný doplněk; změníš ji v `about:addons` → ozubené kolo → Spravovat klávesové zkratky.

**Pořádek.** Tlačítko **Pořádek** nad deskou má tři stupně. *Udělej trochu pořádek* srovná
oblasti do mřížky 6 nebo 5 stejně širokých sloupců (výška zůstane). *Udělej celkem pořádek*
se napřed zeptá, které oblasti schovat, sbalit nebo rozbalit. *Udělej úplný pořádek* k tomu
projde každou položku a zeptá se nechat/smazat (klávesy N/Enter, S/Delete, Backspace = zpět);
smazané jdou do Koše. Mřížka se dá na stejném místě zase zrušit.

**Všechno je modul.** Každý panel z horní lišty (Kalendář, Cyklus, Hlídač, Věci, Peníze,
Knihy, Sdílení, Citáty, Koš, Nastavení, FAQ) může ležet na ploše jako Úkoly: rozbalený,
sbalený, nebo jen v liště (výchozí). Přepne se tlačítkem ⤓ v jeho nadpisu nebo v Nastavení →
Rozložení. Na ploše se táhne za nadpis a velikost se mění za kraje.



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

> Oba seznamy jsou součástí hlavní desky, a ta je za heslem appky. Se zapnutým šifrováním jsou
> jména a poznámky šifrované, částky a měny zůstávají čitelné. Do sdílení se nikdy nedostanou: sdílený
> odkaz nese jen ty oblasti, cíle a úkoly, které do něj vybereš.

## Hlídač (dej vědět, až se to objeví)

> Tohle je outsourced služba přes Cloudflare, takže odkaz bude jim známý. Hlídač běží na
> serveru (v tvém Cloudflare), takže hlídané adresy a fráze tam zůstávají čitelné i se
> šifrováním obsahu; appka tuhle připomínku ukáže při zakládání hlídání.

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
Appka umí číst, zakládat, měnit i mazat události v tvém Google Kalendáři.

- **Pohledy:** měsíc, týden, **den** a seznam. Týden a den umí **hodiny** (6–23, události podle
  času, překrývající se vedle sebe), nebo **jen dny**; týden může mít dny **vedle sebe**, nebo
  **pod sebou** (hodiny pak běží zleva doprava).
- **Událost přetáhneš** na jiný den a tím ji přesuneš; v hodinách i na jiný čas (po 15 minutách).
  Délka zůstává. **Smazat** je ve formuláři události (klikni na ni).
- **Úkoly:** *Propisovat i úkoly* ukáže úkoly s termínem v kalendáři (čárkovaně); přetažením na
  jiný den změníš termín, kliknutím ho upravíš. Tlačítko 📆 u úkolu z něj udělá celodenní událost
  v Google Kalendáři (v den termínu, bez termínu se zeptá).

Kalendář je **schovaný za PINem** a celá funkce je **vypnutá, dokud PIN
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

## Sledování menstruačního cyklu (šifrované vlastním heslem)
V liště je tlačítko **Cyklus**. Zaznamenáváš začátky menstruace (a volitelně konce); appka
spočítá **průměrnou délku cyklu a menstruace** a **předpoví** další menstruace, plodné okno
a ovulaci, to vše v kompaktním měsíčním kalendáři (sloupce = dny v týdnu, jako malý Google-kalendář) (zaznamenané dny, předpověď, okno nejistoty, plodné okno
a ovulace mají různé značení). Aby zvládl nepravidelné cykly (stres, stěhování, nemoc…), počítá
z **mediánu** posledních cyklů místo prostého průměru (jeden divný cyklus jím skoro nehne),
předpověď ukazuje jako **okno, ne jediný den**, označí, jak **pravidelné** cykly jsou, a při
velkém kolísání odhad rozšíří a upozorní na to; každý záznam můžeš označit jako **atypický**, aby
se do statistik nezapočítával. Protože jde o citlivá zdravotní data, **šifrují se přímo
v prohlížeči** vlastním **heslem k cyklu** (AES-GCM, klíč z PBKDF2 s 600 000 iteracemi), ještě než
opustí stránku. Server má jen šifru, takže je nepřečte server, Cloudflare ani nikdo, kdo by data
získal. Při prvním otevření panelu nastavíš heslo a nepovinnou nápovědu; starší nešifrované
záznamy se tehdy zašifrují a čitelná kopie se smaže. Heslo **nejde obnovit**: bez něj jdou
záznamy jen smazat. Zavřením panelu se cyklus zamkne; na svém zařízení můžeš zaškrtnout
*Pamatovat na tomhle zařízení* (klíč se uloží do IndexedDB jako nevyexportovatelný, skript ho
umí použít, ale ne přečíst); 🔒 Zamknout a odhlášení ho zapomenou. Do zálohy jde jen
zašifrovaný. Cyklus už nepotřebuje `CAL_PIN`. Barvy jednotlivých fází si můžeš změnit a fáze volitelně promítnout buď do appkového kalendáře (nic neopustí tvůj Cloudflare), nebo poslat předpověď do Google Kalendáře — to ale tato citlivá data sdílí s Googlem (třetí strana); appka tě předtím varuje. Předpovědi
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
- `extension/` — rozšíření do prohlížeče, `android/` — appka pro Android (obal, sdílení, widget)
- `tests/` — testy bez knihoven, pouštět `node tests/run.js`
- `docs/HANDOVER.md` — stav projektu, rozhodnutí a pasti
- `wrangler.toml` — KV (bez id, založí se při prvním nasazení), plán kontroly, volitelně R2.
  V autorčině pracovní kopii je to `wrangler.toml.example` a `wrangler.toml` zůstává mimo git.
- `.dev.vars.example` — nepovinné secrets (ntfy, kalendář, Resend)
- `package.json` — jen pro tlačítko Deploy (popisky polí) a `npm test`
Po úpravách znovu `wrangler deploy`.

## Poznámky
- Přejmenování a mazání: název stránky změníš v Nastavení (výchozí „Rozcestník"); zápatí odkazuje na tvůj Cloudflare; v Nastavení je **Nebezpečná zóna**, která trvale a nevratně smaže všechna data, a panel Cyklus má vlastní tlačítko, které smaže jen data cyklu.
- **Heslo a šifrování:** appka je zamčená heslem (server dostane jen klíč z něj odvozený),
  obsah je šifrovaný v prohlížeči (viz *Šifrování obsahu*) a cyklus má navíc vlastní heslo.

- **Push na rozbité odkazy:** nastav secret `NTFY_TOPIC` (`wrangler secret put NTFY_TOPIC` nebo
  pole na stránce tlačítka Deploy) a v telefonu se v appce *ntfy* přihlas ke stejnému tématu.
- **Data zůstávají u tebe:** vše leží v tvém Cloudflare (KV/R2). Výjimky: ikonky webů stahuje tvůj server přímo z těch webů (drží je 30 dní, Google
  se nedozví nic), kontrola odkazů navštěvuje tvé uložené odkazy, Google Kalendář (když ho propojíš)
  komunikuje s Googlem a čtení textu z obrázků si jednou stáhne Tesseract.js z jsdelivr
  (obrázky samotné prohlížeč neopustí). K autorovi appky neteče nic.
