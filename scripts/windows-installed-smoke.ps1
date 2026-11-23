param(
  [string]$InstallerPath = "dist\ArtiSys-Almoxarifado-Setup-1.0.3.exe",
  [string]$PreviousInstallerPath,
  [string]$BaseUrl = "http://127.0.0.1:4173"
)

$ErrorActionPreference = 'Stop'
$installer = (Resolve-Path $InstallerPath).Path
if (-not (Test-Path $installer)) { throw "Installer not found: $installer" }
if (-not $env:ALMOX_QA_PASSWORD -or $env:ALMOX_QA_PASSWORD.Length -lt 10) { throw 'ALMOX_QA_PASSWORD must contain at least 10 characters' }
if (-not $env:ALMOX_QA_SKU) { $env:ALMOX_QA_SKU = 'QA-RELEASE-100' }
$env:ALMOX_BASE_URL = $BaseUrl

function Install-App {
  param([string]$Setup = $installer)
  Write-Host "Installing $Setup"
  $process = Start-Process -FilePath $Setup -ArgumentList '/S' -Wait -PassThru
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
  param([switch]$PreviousVersion)
  $exe = Find-AppExe
  Write-Host "Starting $exe"
  $appProcess = Start-Process -FilePath $exe -PassThru
  Wait-Health
  if ($PreviousVersion) { return }
  $license = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/license/status" -TimeoutSec 5
  if ($license.required -isnot [bool] -or $license.required -or $license.active -ne $true) {
    throw "O instalador do canal público precisa abrir sem ativação."
  }
  $deadline = (Get-Date).AddSeconds(45)
  do {
    $appProcess.Refresh()
    if ($appProcess.HasExited) { throw "Desktop process exited before showing its window" }
    if ($appProcess.MainWindowHandle -ne [IntPtr]::Zero -and $appProcess.MainWindowTitle -match 'Almoxarifado') { return }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  throw "Installed application has no visible Almoxarifado window"
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
  if ($PreviousInstallerPath) {
    Install-App -Setup (Resolve-Path $PreviousInstallerPath).Path
    Start-App -PreviousVersion
    Run-Smoke
    Stop-App
  }
  Install-App
  Start-App
  Run-Smoke -VerifyOnly:([bool]$PreviousInstallerPath)
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
