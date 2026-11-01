# Rozšíření na addons.mozilla.org: veřejné vydání

Podklady pro nahrání rozšíření jako **veřejného** (On this site). Nahrává autorka ručně.

## Postup

1. Zabal rozšíření: `npx web-ext build -s extension` → `web-ext-artifacts/rozcestnik-1.0.0.zip`
   (předtím `npx web-ext lint -s extension`; jediné varování o `background.service_worker`
   je v pořádku, je tam kvůli Chromu a Firefox ho přeskočí).
2. https://addons.mozilla.org/developers/addon/rozcestnik@katka1815/versions/submit/
   (stejné id jako dřív, verze musí být vyšší než 0.1.0) → **On this site** → nahrát ZIP.
3. Na otázku po zdrojovém kódu odpovědět **Ne**: nic se nesestavuje ani neminifikuje.
4. Vyplnit texty níž (obě jazykové verze, přepínač jazyka je nahoře u popisu).
5. Kategorie: **Bookmarks** (záložky), případně i **Tabs**. Licence: **MIT**.
6. Snímky obrazovky: okýnko rozšíření nad nějakou stránkou a nastavení s adresou. Velikost 1280×800.
7. Po schválení zkontrolovat adresu stránky doplňku. Appka na ni odkazuje z průvodce po
   prvním spuštění (`GD_AMO` v `public/index.html`, teď `…/firefox/addon/rozcestnik/`).
   Kdyby AMO přidělilo jinou, opravit `GD_AMO` a README.

## Název

Rozcestník

## Shrnutí / Summary (max. 250 znaků)

**cs:** Uloží stránku, odkaz, označený text, obrázek nebo screenshot do tvého vlastního
Rozcestníku. Data jdou jen na adresu tvé appky, nikam jinam.

**en:** Saves a page, link, selected text, image or screenshot to your own Rozcestník. Data goes
only to your own app's address, nowhere else.

## Popis / Description

**cs:**

Rozcestník je osobní nástěnka s odkazy, úkoly a poznámkami, kterou si každý provozuje na svém
vlastním účtu Cloudflare (zdarma, otevřený kód: https://github.com/katka1815/Keeper).
Tohle rozšíření do něj posílá věci z prohlížeče:

- celou stránku, označený text, odkaz nebo obrázek (pravým tlačítkem nebo z ikonky),
- screenshot viditelné části stránky,
- vlastní název a poznámku.

Všechno dorazí do *Ke zpracování* a odtud se třídí do oblastí.

Bez vlastního Rozcestníku rozšíření nic nedělá. Po instalaci se otevře nastavení, kam vložíš
adresu své appky. Prohlížeč se zeptá na povolení jen pro tuhle jednu adresu; na žádnou jinou
rozšíření nic neposílá. Nemá žádnou analytiku ani cizí služby.

Zkratky: Alt+Shift+S otevře okýnko, Alt+Shift+D uloží stránku rovnou.

**en:**

Rozcestník is a personal board for links, tasks and notes that everyone runs on their own
Cloudflare account (free, open source: https://github.com/katka1815/Keeper). This extension
sends things to it from the browser:

- the whole page, selected text, a link or an image (right-click or the toolbar icon),
- a screenshot of the visible part of the page,
- your own title and note.

Everything lands in *To process* and you sort it into areas from there.

Without your own Rozcestník the extension does nothing. After installing, its settings open
and you paste your app's address. The browser asks for permission for that one address only;
the extension sends nothing anywhere else. No analytics, no third-party services.

Shortcuts: Alt+Shift+S opens the popup, Alt+Shift+D saves the page straight away.

## Zásady ochrany soukromí / Privacy policy

**cs:** Rozšíření posílá adresu, název a text stránky, označený text, odkazy, obrázky a
screenshoty, které sám/sama uložíš, **jen na adresu Rozcestníku, kterou zadáš v nastavení**
(tvůj vlastní server na tvém účtu Cloudflare). Autorka rozšíření k těmto datům nemá přístup,
nic nesbírá, nepoužívá analytiku ani cizí služby. V prohlížeči si rozšíření pamatuje jen adresu
tvého Rozcestníku. Obrázek z cizí stránky stáhne z jeho původní adresy, aby ho mohlo poslat dál.

**en:** The extension sends the page address, title and text, selected text, links, images and
screenshots that you choose to save **only to the Rozcestník address you enter in its settings**
(your own server on your own Cloudflare account). The extension's author has no access to this
data, collects nothing, and uses no analytics or third-party services. The extension stores only
your Rozcestník address in the browser. To save an image from a page it downloads that image
from its original address so it can pass it on.

## Poznámka pro kontrolu / Notes to reviewer

The add-on talks only to a self-hosted server whose address the user enters in the options page
(optional host permission requested for that single origin). To test it you can run the server
locally: clone https://github.com/katka1815/Keeper, run `npx wrangler dev`, open
http://localhost:8787 once to set a password, then enter `http://localhost:8787` in the add-on
options. Saved items appear in the app under "Ke zpracování" / "To process".
No remote code, no minified code, no build step: the uploaded files are the source.
