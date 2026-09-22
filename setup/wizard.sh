#!/usr/bin/env bash
# Rozcestnik - pruvodce instalaci / installation wizard (macOS / Linux)
# Spust:  bash install.sh    (nebo dvojklik na install.command na macu)
set -e
cd "$(dirname "$0")"
while [ ! -f wrangler.toml ] && [ "$PWD" != "/" ]; do cd ..; done
[ -f wrangler.toml ] || { echo "wrangler.toml nenalezen / not found"; exit 1; }

echo ""
echo "  ============================================"
echo "   Rozcestnik - pruvodce instalaci / installer"
echo "  ============================================"
echo ""
read -r -p "  Jazyk / Language:  [1] Cestina   [2] English  " LANG
CS=1; [ "$LANG" = "2" ] && CS=0
t(){ if [ "$CS" = "1" ]; then echo "$1"; else echo "$2"; fi; }

echo ""
echo "$(t '  Pruvodce zprovozni tvou VLASTNI kopii appky. Data zustavaji jen u tebe.' '  This wizard gets YOUR OWN copy running. Your data stays only with you.')"
echo "$(t '  Za chvili si vyberes, jak to chces provozovat.' '  In a moment you will choose how to run it.')"
echo ""
read -r -p "$(t '  Pokracovat? (a/n) ' '  Continue? (y/n) ')" GO
case "$GO" in a*|y*|A*|Y*) ;; *) exit 0;; esac

if [ ! -f wrangler.toml ]; then
  if [ -f wrangler.toml.example ]; then
    cp wrangler.toml.example wrangler.toml
    echo "$(t '  Vytvoren wrangler.toml ze sablony.' '  Created wrangler.toml from the template.')"
  else
    echo "$(t '  CHYBA: spust ve slozce s wrangler.toml.' '  ERROR: run inside the folder with wrangler.toml.')"; exit 1
  fi
fi

echo ""; echo "$(t '[1/6] Kontrola Node.js...' '[1/6] Checking Node.js...')"
if ! command -v node >/dev/null 2>&1; then
  echo "$(t '  Node.js neni nainstalovany. Nainstaluj LTS z https://nodejs.org a spust znovu.' '  Node.js is missing. Install LTS from https://nodejs.org and run again.')"
  echo "$(t '  (macOS s Homebrew: brew install node)' '  (macOS with Homebrew: brew install node)')"
  exit 1
fi
echo "  OK: Node $(node -v)"

WR(){ npx --yes wrangler@latest "$@"; }

echo ""
echo "$(t '  Jak to chces provozovat?' '  How do you want to run it?')"
echo "$(t '   [1] DOSTUPNE ODKUDKOLIV - pobezi v tvem Cloudflare uctu (soukrome, kdykoliv smazatelne, otevres i z mobilu).' '   [1] FROM ANYWHERE - runs in your Cloudflare account (private, wipeable anytime, open it from your phone too).')"
echo "$(t '   [2] UPLNE SOUKROMI - jen na tomhle pocitaci; NEPUJDE zobrazit z mobilu ani jineho notasu, bezi jen dokud bezi okno.' '   [2] FULL PRIVACY - this computer only; NOT viewable from a phone or another laptop, runs only while this window is open.')"
read -r -p "$(t '  Volba (1/2): ' '  Choice (1/2): ')" MODE

if [ "$MODE" = "2" ]; then
  echo ""
  echo "$(t '[lokalne] Spoustim jen na tomhle pocitaci. Otevri:  http://localhost:8787' '[local] Starting on this computer only. Open:  http://localhost:8787')"
  echo "$(t '  Zastavis Ctrl+C. Data jsou lokalne ve slozce .wrangler.' '  Stop with Ctrl+C. Data is stored locally in the .wrangler folder.')"
  echo ""
  (sleep 2; (command -v open >/dev/null && open http://localhost:8787) || (command -v xdg-open >/dev/null && xdg-open http://localhost:8787) || true) &
  WR dev
  exit 0
fi

# ====== Rezim 1: nasazeni do Cloudflare ======
echo ""; echo "$(t '[2/6] Prihlaseni do Cloudflare (otevre se prohlizec)...' '[2/6] Logging in to Cloudflare (a browser will open)...')"
WR login || { echo "$(t '  Prihlaseni selhalo.' '  Login failed.')"; exit 1; }

echo ""; echo "$(t '[3/6] Nazev appky (cast adresy).' '[3/6] App name (part of the address).')"
read -r -p "$(t '  Nazev workeru [Enter = rozcestnik]: ' '  Worker name [Enter = rozcestnik]: ')" NAME
if [ -n "$NAME" ]; then
  NAME=$(echo "$NAME" | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9-]/-/g')
  sed -i.bak -E "s/^name = \".*\"/name = \"$NAME\"/" wrangler.toml && rm -f wrangler.toml.bak
  echo "  OK: $NAME"
fi

echo ""; echo "$(t '[4/6] Vytvarim tve vlastni uloziste dat (KV)...' '[4/6] Creating your own data storage (KV)...')"
KVOUT=$(WR kv namespace create KV 2>&1 || WR kv:namespace create KV 2>&1 || true)
KVID=$(echo "$KVOUT" | grep -oE '[0-9a-fA-F]{32}' | head -n1)
if [ -n "$KVID" ]; then
  sed -i.bak -E "s/^id = \".*\"/id = \"$KVID\"/" wrangler.toml && rm -f wrangler.toml.bak
  echo "  OK: KV id $KVID"
else
  echo "$KVOUT"
  read -r -p "$(t '  Vloz rucne id (32 znaku): ' '  Paste id manually (32 chars): ')" KVID
  [ -n "$KVID" ] && { sed -i.bak -E "s/^id = \".*\"/id = \"$KVID\"/" wrangler.toml && rm -f wrangler.toml.bak; } || exit 1
fi

echo ""; echo "$(t '[5/6] Nepovinne (Enter = preskocit).' '[5/6] Optional (Enter to skip).')"
read -r -p "$(t '  PIN pro kalendar a cyklus: ' '  PIN for calendar and cycle: ')" PIN
[ -n "$PIN" ] && printf '%s' "$PIN" | WR secret put CAL_PIN || true
read -r -p "$(t '  ntfy.sh tema pro upozorneni: ' '  ntfy.sh topic for alerts: ')" NTFY
[ -n "$NTFY" ] && { sed -i.bak -E "s/^NTFY_TOPIC = \".*\"/NTFY_TOPIC = \"$NTFY\"/" wrangler.toml && rm -f wrangler.toml.bak; }
read -r -p "$(t '  Resend API klic (e-mail z Hlidace): ' '  Resend API key (Watcher e-mail): ')" RSND
[ -n "$RSND" ] && printf '%s' "$RSND" | WR secret put RESEND_KEY || true

echo ""; echo "$(t '[6/6] Nasazuji...' '[6/6] Deploying...')"
DEP=$(WR deploy 2>&1 || true); echo "$DEP"
URL=$(echo "$DEP" | grep -oE 'https://[^ ]+\.workers\.dev' | head -n1)
echo ""; echo "  ============================================"
if [ -n "$URL" ]; then echo "$(t '   HOTOVO! Bezi na:' '   DONE! Live at:')"; echo "   $URL"; else echo "$(t '   Nasazeno (adresa je ve vypisu vyse).' '   Deployed (address is in the output above).')"; fi
echo "  ============================================"
echo "$(t '   Postup ke Google Kalendari je v README.' '   Google Calendar setup is in the README.')"
