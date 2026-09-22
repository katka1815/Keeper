# Rozcestnik - pruvodce instalaci / installation wizard
# Spousti se pres install.bat (dvojklik) nebo: powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Pause-End($msg){ Write-Host ""; Read-Host $msg | Out-Null }

Write-Host ""
Write-Host "  ============================================"
Write-Host "   Rozcestnik - pruvodce instalaci / installer"
Write-Host "  ============================================"
Write-Host ""
$lang = Read-Host "  Jazyk / Language:  [1] Cestina   [2] English"
$cs = ($lang -ne "2")
function T($czech, $eng){ if($cs){ return $czech } else { return $eng } }

Write-Host ""
Write-Host (T "  Tento pruvodce te provede instalaci tve VLASTNI kopie appky." "  This wizard will guide you through installing YOUR OWN copy of the app.")
Write-Host (T "  Vse pobezi ve tvem vlastnim Cloudflare uctu - data zustavaji u tebe." "  It all runs in your own Cloudflare account - your data stays with you.")
Write-Host (T "  Cloudflare ma zdarma tarif, ktery na tohle bohate staci." "  Cloudflare has a free plan that is more than enough for this.")
Write-Host ""
$go = Read-Host (T "  Pokracovat? (a/n)" "  Continue? (y/n)")
if($go -notmatch '^(a|y|A|Y)'){ exit }

if(-not (Test-Path "wrangler.toml")){
  Write-Host (T "  CHYBA: spust tento soubor ve slozce, kde je wrangler.toml." "  ERROR: run this from the folder that contains wrangler.toml.")
  Pause-End (T "  Enter pro konec" "  Press Enter to exit"); exit
}

# --- 1) Node.js ---
Write-Host ""
Write-Host (T "[1/6] Kontroluji Node.js..." "[1/6] Checking Node.js...")
$node = Get-Command node -ErrorAction SilentlyContinue
if(-not $node){
  Write-Host (T "  Node.js neni nainstalovany. Je potreba (kvuli nastroji wrangler)." "  Node.js is not installed. It is required (for the wrangler tool).")
  $w = Read-Host (T "  Zkusit ho nainstalovat pres winget? (a/n)" "  Try installing it via winget? (y/n)")
  if($w -match '^(a|y|A|Y)'){
    try { winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements } catch {}
    Write-Host (T "  Hotovo. ZAVRI tohle okno a spust install.bat znovu (aby se nacetl novy Node)." "  Done. CLOSE this window and run install.bat again (to pick up Node).")
  } else {
    Write-Host (T "  Oteviram stranku pro stazeni Node LTS. Po instalaci spust install.bat znovu." "  Opening the Node LTS download page. After installing, run install.bat again.")
    Start-Process "https://nodejs.org/en/download"
  }
  Pause-End (T "  Enter pro konec" "  Press Enter to exit"); exit
}
Write-Host ("  OK: Node " + (node -v))

# helper: run wrangler via npx (no global install needed)
function Wrangler { npx --yes wrangler@latest @args }

# --- 2) Prihlaseni do Cloudflare ---
Write-Host ""
Write-Host (T "[2/6] Prihlaseni do Cloudflare (otevre se prohlizec)..." "[2/6] Logging in to Cloudflare (a browser will open)...")
Write-Host (T "  Pokud uz jsi prihlasen/a, jen to potvrdis." "  If you are already logged in, just confirm.")
try { Wrangler login } catch { Write-Host (T "  Prihlaseni se nepovedlo." "  Login failed.") ; Pause-End (T "  Enter pro konec" "  Press Enter to exit"); exit }

# --- 3) Vlastni nazev workeru (nepovinne) ---
Write-Host ""
Write-Host (T "[3/6] Nazev appky (cast adresy)." "[3/6] App name (part of the address).")
$name = Read-Host (T "  Nazev workeru [Enter = rozcestnik]" "  Worker name [Enter = rozcestnik]")
if($name){
  $name = ($name -replace '[^a-zA-Z0-9-]','-').ToLower()
  $toml = Get-Content -Raw "wrangler.toml"
  $toml = [regex]::Replace($toml, '(?m)^name\s*=\s*".*?"', 'name = "' + $name + '"')
  Set-Content -Path "wrangler.toml" -Value $toml -NoNewline
  Write-Host ("  OK: " + $name)
} else { $name = "rozcestnik" }

# --- 4) Vlastni KV uloziste + zapis id do wrangler.toml ---
Write-Host ""
Write-Host (T "[4/6] Vytvarim tve vlastni uloziste dat (KV)..." "[4/6] Creating your own data storage (KV)...")
$kvout = ""
try { $kvout = (Wrangler kv namespace create KV *>&1 | Out-String) }
catch { try { $kvout = (Wrangler kv:namespace create KV *>&1 | Out-String) } catch { $kvout = "" } }
$m = [regex]::Match($kvout, 'id\s*=\s*"([0-9a-fA-F]{32})"')
if(-not $m.Success){ $m = [regex]::Match($kvout, '"id"\s*:\s*"([0-9a-fA-F]{32})"') }
if($m.Success){
  $kvid = $m.Groups[1].Value
  $toml = Get-Content -Raw "wrangler.toml"
  $toml = [regex]::Replace($toml, '(?m)^id\s*=\s*".*?"', 'id = "' + $kvid + '"')
  Set-Content -Path "wrangler.toml" -Value $toml -NoNewline
  Write-Host ("  OK: KV id " + $kvid)
} else {
  Write-Host (T "  Nepodarilo se automaticky precist KV id. Vypis vyse:" "  Could not auto-read the KV id. Output above:")
  Write-Host $kvout
  $kvid = Read-Host (T "  Vloz rucne 'id' z radku [[kv_namespaces]] (32 znaku)" "  Paste the 'id' from the [[kv_namespaces]] line (32 chars)")
  if($kvid){
    $toml = Get-Content -Raw "wrangler.toml"
    $toml = [regex]::Replace($toml, '(?m)^id\s*=\s*".*?"', 'id = "' + ($kvid.Trim()) + '"')
    Set-Content -Path "wrangler.toml" -Value $toml -NoNewline
  } else { Pause-End (T "  Bez KV nelze pokracovat. Enter pro konec." "  Cannot continue without KV. Press Enter."); exit }
}

# --- 5) Nepovinne: PIN a push ---
Write-Host ""
Write-Host (T "[5/6] Nepovinne nastaveni (vse muzes preskocit Enterem)." "[5/6] Optional settings (press Enter to skip each).")
$pin = Read-Host (T "  PIN pro kalendar a cyklus (zapne tyto funkce)" "  PIN for calendar and cycle (enables those features)")
if($pin){ try { $pin | Wrangler secret put CAL_PIN } catch {} }
$ntfy = Read-Host (T "  ntfy.sh tema pro upozorneni na rozbite odkazy" "  ntfy.sh topic for broken-link alerts")
if($ntfy){
  $toml = Get-Content -Raw "wrangler.toml"
  $toml = [regex]::Replace($toml, '(?m)^NTFY_TOPIC\s*=\s*".*?"', 'NTFY_TOPIC = "' + ($ntfy.Trim()) + '"')
  Set-Content -Path "wrangler.toml" -Value $toml -NoNewline
}
$go2 = Read-Host (T "  Nastavit ted i Google Kalendar? (a/n) [doporuceno az pozdeji dle README]" "  Set up Google Calendar now? (y/n) [easier later per README]")
if($go2 -match '^(a|y|A|Y)'){
  $cid = Read-Host "  GOOGLE_CLIENT_ID"
  if($cid){ try { $cid | Wrangler secret put GOOGLE_CLIENT_ID } catch {} }
  $csec = Read-Host "  GOOGLE_CLIENT_SECRET"
  if($csec){ try { $csec | Wrangler secret put GOOGLE_CLIENT_SECRET } catch {} }
}

# --- 6) Nasazeni ---
Write-Host ""
Write-Host (T "[6/6] Nasazuji appku do tveho Cloudflare..." "[6/6] Deploying the app to your Cloudflare...")
$dep = ""
try { $dep = (Wrangler deploy *>&1 | Out-String) } catch { $dep = $_ | Out-String }
Write-Host $dep
$u = [regex]::Match($dep, 'https://[^\s]+\.workers\.dev')
Write-Host ""
Write-Host "  ============================================"
if($u.Success){
  Write-Host (T "   HOTOVO! Tvuj Rozcestnik bezi na adrese:" "   DONE! Your Rozcestnik is live at:")
  Write-Host ("   " + $u.Value)
  try { Start-Process $u.Value } catch {}
} else {
  Write-Host (T "   Nasazeni probehlo (adresu najdes ve vypisu vyse)." "   Deploy finished (find the address in the output above).")
}
Write-Host "  ============================================"
Write-Host (T "   Tip: appku si na telefonu pridas pres prohlizec -> Pridat na plochu." "   Tip: on your phone add it via browser -> Add to Home screen.")
Write-Host (T "   Postup ke Google Kalendari je v souboru README." "   Google Calendar setup is in the README file.")
Pause-End (T "  Enter pro zavreni" "  Press Enter to close")
