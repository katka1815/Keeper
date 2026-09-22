# Rozcestnik - pruvodce instalaci / installation wizard
# Spousti se pres install.bat (dvojklik) nebo: powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
while($dir -and -not (Test-Path (Join-Path $dir 'wrangler.toml'))){ $dir = Split-Path -Parent $dir }
if(-not $dir){ Write-Host "wrangler.toml nenalezen / not found"; Read-Host "Enter"; exit }
Set-Location -Path $dir

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
Write-Host (T "  Tento pruvodce te provede zprovoznenim tve VLASTNI kopie appky." "  This wizard will get YOUR OWN copy of the app running.")
Write-Host (T "  Data zustavaji jen u tebe. Za chvili si vyberes, jak to chces provozovat." "  Your data stays only with you. In a moment you'll choose how to run it.")
Write-Host ""
$go = Read-Host (T "  Pokracovat? (a/n)" "  Continue? (y/n)")
if($go -notmatch '^(a|y|A|Y)'){ exit }

if(-not (Test-Path "wrangler.toml")){
  if(Test-Path "wrangler.toml.example"){
    Copy-Item "wrangler.toml.example" "wrangler.toml"
    Write-Host (T "  Vytvoren wrangler.toml ze sablony." "  Created wrangler.toml from the template.")
  } else {
    Write-Host (T "  CHYBA: spust tento soubor ve slozce, kde je wrangler.toml." "  ERROR: run this from the folder that contains wrangler.toml.")
    Pause-End (T "  Enter pro konec" "  Press Enter to exit"); exit
  }
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

# --- Volba rezimu / run mode ---
Write-Host ""
Write-Host (T "  Jak to chces provozovat?" "  How do you want to run it?")
Write-Host (T "   [1] DOSTUPNE ODKUDKOLIV - pobezi v tvem Cloudflare uctu." "   [1] FROM ANYWHERE - runs in your Cloudflare account.")
Write-Host (T "       Soukrome (je to jen tvuj ucet) a kdykoliv to muzes celé smazat." "       Private (it's only your account) and you can wipe it all anytime.")
Write-Host (T "       Otevres na mobilu i jinem pocitaci, da se pridat jako appka na plochu." "       Open it on your phone and other computers, can add to home screen.")
Write-Host (T "   [2] UPLNE SOUKROMI - pobezi jen na tomhle pocitaci (lokalne)." "   [2] FULL PRIVACY - runs only on this computer (locally).")
Write-Host (T "       Nic neodchazi nikam ven, ale NEPUJDE to zobrazit z mobilu ani z jineho notasu" "       Nothing leaves your machine, but it will NOT be viewable from a phone or another laptop")
Write-Host (T "       a bezi to jen dokud bezi tohle okno." "       and it runs only while this window is open.")
$mode = Read-Host (T "  Volba (1/2)" "  Choice (1/2)")

if($mode -eq "2"){
  Write-Host ""
  Write-Host (T "[lokalne] Spoustim appku jen na tomhle pocitaci..." "[local] Starting the app on this computer only...")
  Write-Host (T "  Az se rozbehne, otevri v prohlizeci:  http://localhost:8787" "  Once it starts, open in your browser:  http://localhost:8787")
  Write-Host (T "  Zastavis to zavrenim okna nebo Ctrl+C. Data jsou ulozena lokalne ve slozce .wrangler." "  Stop it by closing the window or Ctrl+C. Data is stored locally in the .wrangler folder.")
  Write-Host ""
  try { Start-Process "http://localhost:8787" } catch {}
  Wrangler dev
  Pause-End (T "  Konec. Enter pro zavreni." "  Done. Press Enter to close.")
  exit
}

# ====== Rezim 1: nasazeni do Cloudflare ======
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
$rsnd = Read-Host (T "  Resend API klic (e-mail z Hlidace, Enter = preskocit)" "  Resend API key (Watcher e-mail, Enter to skip)")
if($rsnd){ try { $rsnd | Wrangler secret put RESEND_KEY } catch {} }
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
