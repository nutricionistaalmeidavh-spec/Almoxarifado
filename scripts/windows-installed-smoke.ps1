param(
  [string]$InstallerPath = "dist\ArtiSys-Almoxarifado-Setup-1.0.0.exe",
  [string]$BaseUrl = "http://127.0.0.1:4173"
)

$ErrorActionPreference = 'Stop'
$installer = (Resolve-Path $InstallerPath).Path
if (-not (Test-Path $installer)) { throw "Installer not found: $installer" }
if (-not $env:ALMOX_QA_PASSWORD -or $env:ALMOX_QA_PASSWORD.Length -lt 10) { throw 'ALMOX_QA_PASSWORD must contain at least 10 characters' }
if (-not $env:ALMOX_QA_SKU) { $env:ALMOX_QA_SKU = 'QA-RELEASE-100' }
$env:ALMOX_BASE_URL = $BaseUrl

function Install-App {
  Write-Host "Installing $installer"
  $process = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "NSIS installer failed with exit code $($process.ExitCode)" }
}

function Find-AppExe {
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs'),
    $env:LOCALAPPDATA
  ) | Where-Object { $_ -and (Test-Path $_) }
  foreach ($root in $roots) {
    $found = Get-ChildItem -Path $root -Filter 'ArtiSys Almoxarifado.exe' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  throw 'ArtiSys Almoxarifado.exe was not found after installation'
}

function Wait-Health {
  param([int]$TimeoutSeconds = 60)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $last = $null
  do {
    try {
      $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/health" -TimeoutSec 3
      if ($health.status -eq 'ok') { return }
    } catch { $last = $_ }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)
  throw "Installed application did not become healthy. Last error: $last"
}

function Start-App {
  $exe = Find-AppExe
  Write-Host "Starting $exe"
  Start-Process -FilePath $exe | Out-Null
  Wait-Health
}

function Stop-App {
  & taskkill.exe /IM 'ArtiSys Almoxarifado.exe' /T /F 2>$null | Out-Null
  Start-Sleep -Seconds 2
}

function Run-Smoke {
  param([switch]$VerifyOnly)
  if ($VerifyOnly) { $env:ALMOX_SMOKE_MODE = 'verify-only' } else { $env:ALMOX_SMOKE_MODE = 'full' }
  & npm.cmd run smoke:release
  if ($LASTEXITCODE -ne 0) { throw "release smoke failed with exit code $LASTEXITCODE" }
}

try {
  Install-App
  Start-App
  Run-Smoke
  Stop-App

  # Reinstall the exact same approved package. User data is deliberately not removed.
  Install-App
  Start-App
  Run-Smoke -VerifyOnly
  Write-Host 'Installed/reinstall smoke passed; persisted product and stock survived.'
}
finally {
  Stop-App
  Remove-Item Env:ALMOX_SMOKE_MODE -ErrorAction SilentlyContinue
}
