param(
  [switch]$SkipLaunch
)

$ErrorActionPreference = 'Stop'

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  $argsList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  if ($SkipLaunch) { $argsList += '-SkipLaunch' }
  Start-Process -FilePath powershell.exe -ArgumentList $argsList -Verb RunAs
  exit
}

$InstallerDir = Split-Path -Parent $PSCommandPath
$Root = Split-Path -Parent $InstallerDir
$Payload = Join-Path $Root 'pacote'
$InstallDir = Join-Path $env:ProgramFiles 'Ordem de Corte'
$DataDir = Join-Path $env:ProgramData 'Ordem de Corte\dados'
$Desktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
$Programs = [Environment]::GetFolderPath('CommonPrograms')
$StartMenuDir = Join-Path $Programs 'Ordem de Corte'
$DesktopLink = Join-Path $Desktop 'Ordem de Corte.lnk'

# Reinstalação limpa: encerra o servidor anterior e remove instalação, atalhos e dados.
$OldInstallDir = $InstallDir
$oldProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.CommandLine -and $_.CommandLine -like "*$OldInstallDir*"
}
foreach ($oldProcess in $oldProcesses) {
  Stop-Process -Id $oldProcess.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 300
Remove-Item -LiteralPath $DesktopLink -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $StartMenuDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Split-Path $DataDir -Parent) -Recurse -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $Payload)) {
  throw "A pasta pacote não foi encontrada. Mantenha o instalador junto com a pasta pacote."
}

New-Item -ItemType Directory -Force -Path $InstallDir, $DataDir, $StartMenuDir | Out-Null

robocopy $Payload $InstallDir /MIR /XD dados /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -gt 7) {
  throw "Falha ao copiar os arquivos do aplicativo."
}

$SeedData = Join-Path $Payload 'dados'
$DbFile = Join-Path $DataDir 'ordem-de-corte.sqlite'
if ((Test-Path $SeedData) -and -not (Test-Path $DbFile)) {
  robocopy $SeedData $DataDir /E /R:2 /W:1 | Out-Null
  if ($LASTEXITCODE -gt 7) {
    throw "Falha ao preparar o banco de dados inicial."
  }
}

$Uninstall = Join-Path $InstallDir 'Desinstalar-Ordem-de-Corte.ps1'
$UninstallText = @'
$ErrorActionPreference = 'Stop'
function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if (-not (Test-Admin)) {
  Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"") -Verb RunAs
  exit
}
$InstallDir = Join-Path $env:ProgramFiles 'Ordem de Corte'
$DesktopLink = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'Ordem de Corte.lnk'
$StartMenuDir = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'Ordem de Corte'
Remove-Item -LiteralPath $DesktopLink -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $StartMenuDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show('Ordem de Corte foi desinstalado. Os dados foram preservados em ProgramData\Ordem de Corte\dados.', 'Ordem de Corte') | Out-Null
'@
Set-Content -LiteralPath $Uninstall -Encoding UTF8 -Value $UninstallText

$Exe = Join-Path $InstallDir 'Ordem de Corte.exe'
$Icon = Join-Path $InstallDir 'ordem-de-corte.ico'
$StartLink = Join-Path $StartMenuDir 'Ordem de Corte.lnk'
$UninstallLink = Join-Path $StartMenuDir 'Desinstalar Ordem de Corte.lnk'

$Shell = New-Object -ComObject WScript.Shell
foreach ($LinkPath in @($DesktopLink, $StartLink)) {
  $Shortcut = $Shell.CreateShortcut($LinkPath)
  $Shortcut.TargetPath = $Exe
  $Shortcut.WorkingDirectory = $InstallDir
  $Shortcut.IconLocation = $Icon
  $Shortcut.Description = 'Abrir Ordem de Corte'
  $Shortcut.Save()
}

$Shortcut = $Shell.CreateShortcut($UninstallLink)
$Shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Uninstall`""
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.IconLocation = $Icon
$Shortcut.Description = 'Desinstalar Ordem de Corte'
$Shortcut.Save()

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Ordem de Corte foi instalado com sucesso.`n`nAtalho criado na Área de Trabalho e no Menu Iniciar.", "Ordem de Corte") | Out-Null

if (-not $SkipLaunch) {
  Start-Process -FilePath $Exe -WorkingDirectory $InstallDir
}
