# Instalace pro každého / Easy install

## 🇨🇿 Česky

Tahle appka se nasazuje do **tvého vlastního Cloudflare účtu**. Aby to zvládl i někdo, kdo
nikdy neviděl příkazovou řádku, stačí spustit jeden soubor a průvodce tě vším provede.

Na začátku si vybereš: **dostupné odkudkoliv** (běží v tvém Cloudflare — soukromé, kdykoliv smazatelné, otevřeš i z mobilu), nebo **úplné soukromí** (běží jen na tomhle počítači — nepůjde zobrazit z mobilu ani jiného noťasu, běží jen dokud běží okno).

### Windows
1. Rozbal celou složku.
2. Dvojklikni na **`Click this to install the app.bat`**.
3. Průvodce postupně: zkontroluje (a případně doinstaluje) **Node.js**, přihlásí tě do
   **Cloudflare** (otevře prohlížeč), vytvoří ti **vlastní úložiště (KV)** a id rovnou doplní
   do nastavení, nepovinně se zeptá na **PIN** a téma upozornění, **nasadí** appku a na konci
   ukáže (a otevře) tvou adresu `…workers.dev`.

> Když Windows zobrazí modré okno „Windows ochránil váš počítač", klikni na **Další informace
> → Přesto spustit** (objeví se to jen proto, že soubor není podepsaný certifikátem).

### macOS
Dvojklikni na **`Click this to install the app (Mac).command`**. Při prvním spuštění tě
macOS nejspíš zarazí — klikni pravým → **Otevřít → Otevřít**.

### Linux
V terminálu ve složce appky: `bash setup/wizard.sh`

### Co je potřeba
Jen účet na **Cloudflare** (zdarma) a **Node.js** (na Windows ho průvodce umí doinstalovat).
KV, nasazení i adresu zařídí průvodce.

### Chci doslova soubor `.exe` (s ikonou)
Spouštěč už se chová jako instalátor (dvojklik a nech se vést). Když chceš opravdový `.exe`,
vyrobíš ho **na Windows** z průvodce nástrojem PS2EXE (jednorázově):
```powershell
Install-Module ps2exe -Scope CurrentUser
ps2exe .\setup\wizard.ps1 .\Rozcestnik-Installer.exe -title "Rozcestnik Installer"
```
Vznikne `Rozcestnik-Installer.exe`, který dělá přesně totéž. (Kompilace `.exe` jde jen na
Windows; instalátor navíc stejně potřebuje Node kvůli nástroji `wrangler`, takže spouštěč dává
stejný výsledek jako `.exe`.)

---

## 🇬🇧 English

This app deploys into **your own Cloudflare account**. So that even someone who has never used
a command line can do it, just run one file and a wizard walks you through everything.

At the start you choose: **from anywhere** (runs in your Cloudflare — private, wipeable anytime, open it from your phone too), or **full privacy** (runs only on this computer — not viewable from a phone or another laptop, runs only while the window is open).

### Windows
1. Unzip the whole folder.
2. Double-click **`Click this to install the app.bat`**.
3. The wizard will: check (and optionally install) **Node.js**, log you into **Cloudflare**
   (opens a browser), create **your own storage (KV)** and write its id into the config,
   optionally ask for a **PIN** and an alert topic, **deploy** the app and finally show (and
   open) your `…workers.dev` address.

> If Windows shows a blue "Windows protected your PC" box, click **More info → Run anyway**
> (it only appears because the file isn't signed with a certificate).

### macOS
Double-click **`Click this to install the app (Mac).command`**. On first run macOS may block
it — right-click → **Open → Open**.

### Linux
In a terminal, inside the app folder: `bash setup/wizard.sh`

### What you need
Just a **Cloudflare** account (free) and **Node.js** (the wizard can install it on Windows).
KV, deploy and the address are handled for you.

### I literally want an `.exe` (with an icon)
The launcher already behaves like an installer (double-click and follow along). For a real
`.exe`, build it **on Windows** from the wizard with PS2EXE (one-time):
```powershell
Install-Module ps2exe -Scope CurrentUser
ps2exe .\setup\wizard.ps1 .\Rozcestnik-Installer.exe -title "Rozcestnik Installer"
```
This produces `Rozcestnik-Installer.exe` that does exactly the same. (Compiling an `.exe` only
works on Windows, and the installer needs Node for `wrangler` anyway, so the launcher gives the
same result.)
