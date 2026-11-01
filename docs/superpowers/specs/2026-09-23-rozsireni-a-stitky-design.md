# Rozšíření do prohlížeče, screenshoty a štítky (návrh, zatím nestavěno)

Datum: 2026-09-23
Stav: domluvený návrh, stavět se bude v dalším sezení.

Inspirace: aplikace a rozšíření **mymind**. Rozcestník už umí skoro totéž,
chybí mu rychlé ukládání z libovolné stránky, obrázky a třídění.

---

## 1. Rozšíření do prohlížeče

Složka `extension/` v repu (`manifest.json` MV3 + pár JS souborů). Funguje
v Chromu, Edgi a Braveu, po drobné úpravě i ve Firefoxu. Instaluje se přes
„Načíst rozbalené“ v `chrome://extensions`, **zdarma**. Chrome Web Store stojí
jednorázově 5 $ a je potřeba jen pro veřejné vydání.

Umí:
- **Klik na ikonku:** okýnko s názvem a URL stránky, políčkem na poznámku a
  štítky, tlačítkem Uložit.
- **Pravé tlačítko myši:** „Uložit do Rozcestníku“ na stránce, označeném textu,
  odkazu nebo obrázku.
- **Klávesová zkratka** (návrh Alt+S) pro uložení bez okýnka.
- **„Vyfotit stránku“:** `chrome.tabs.captureVisibleTab`, uloží screenshot
  viditelné části záložky i s URL a názvem.
- **Ctrl+V v okýnku:** vloží obrázek ze schránky.
- Volitelně: **nová karta = Rozcestník**.

Posílá na existující `POST /api/capture` (ukládá do Inboxu). Obrázky půjdou
novým endpointem (viz bod 2).

### Zabezpečení: přidat token
API teď **nemá žádné heslo**, takže kdo zná URL, může zapisovat. Společně
s rozšířením přidat jednoduchý token (secret ve Workeru, v rozšíření se zadá
jednou v nastavení). Podle konvencí projektu ho protáhnout i instalátorem
(`install.*`, `setup/wizard.*`) a README.

## 2. Vkládání screenshotů (i přímo v appce)

- **Ctrl+V kdekoli v Rozcestníku** (Win+Shift+S → Ctrl+V) vloží obrázek do
  Inboxu jako kartu s náhledem. Teď appka vkládání obrázků vůbec neumí.
- Před uložením v prohlížeči zmenšit a převést do WebP (cíl 100–300 kB).
- **Úložiště:** když je nastavené R2 (`BOOKS`), použít ho (10 GB zdarma, ale
  Cloudflare při zapnutí chce kartu). Jinak **KV** (1 GB zdarma, už ho appka
  má). Každý obrázek dostane vlastní klíč (`img:<id>`), žádné vkládání do
  JSONu desky, aby `/api/state` zůstal rychlý.
- Bez R2 se to musí samo přepnout na KV a nic nesmí rozbít (pravidlo
  „volitelné věci se vypínají samy“).

## 3. Štítky a třídění

Přání od Katky: štítky si člověk nastavuje sám, ale některé se přidají
automaticky. Uložené věci padají do jedné složky a musí existovat snadný
způsob, jak je roztřídit.

- **Složka „Nezařazené“:** sem padá všechno uložené z rozšíření, přes Ctrl+V i
  z Inboxu. Dá se na to buď přejmenovat, nebo rozšířit současný Inbox. Při
  stavbě rozhodnout podle toho, co je v kódu míň invazivní.
- **Vlastní štítky:** vytvářet, přejmenovat, obarvit (v rámci pravidel
  vzhledu z HANDOVER) a mazat. Přiřadit je jde už při ukládání v okýnku
  rozšíření.
- **Automatické štítky** (dají se odebrat a pravidla vypnout):
  - podle typu: `odkaz`, `obrázek`, `text`, `screenshot`,
  - podle domény: youtube/vimeo → `video`, github → `kód`, e-shopy → `nákup`
    a podobně. Pravidla doména → štítek si uživatel upraví a přidá sám.
- **Snadné třídění:** režim „Roztřídit“, který projde Nezařazené po jedné
  kartě. Štítek se dá klávesou 1–9 nebo kliknutím na čip, Enter = hotovo a
  další, Del = smazat. K tomu hromadný výběr (zaškrtnout víc karet →
  štítek/přesun) a přetažení karty na čip štítku.
- **Filtrování:** čipy štítků nahoře a klik = filtr. Hledání v textu, URL i
  štítcích.

**Modularita:** nová sekce (Uložené/Nezařazené) musí od začátku mít všechny
společné ovládací prvky: resize, sbalení, přesun do záložek v horní liště a
přetahování (`SECS`, `PLACE`, `LAY`, po přepsání `innerHTML` volat
`applySecSizes()`).

## Otevřené otázky na příště

- Nezařazené = přejmenovaný Inbox, nebo nová sekce vedle něj?
- Vizuální mřížka uložených věcí (jako mymind) místo seznamu, nebo přepínač?
- Firefox hned, nebo až později?
