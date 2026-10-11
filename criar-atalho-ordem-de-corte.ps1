$ErrorActionPreference = 'Stop'
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop 'Ordem de Corte.lnk'
$Starter = Join-Path $AppDir 'iniciar-ordem-de-corte.ps1'
$IconPath = Join-Path $AppDir 'ordem-de-corte.ico'

if (-not (Test-Path $IconPath)) {
  Add-Type -AssemblyName System.Drawing
  $bitmap = New-Object System.Drawing.Bitmap 256, 256
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(15,31,61))
  $font = New-Object System.Drawing.Font 'Segoe UI Symbol', 128, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString([string][char]0x2702, $font, $brush, (New-Object System.Drawing.RectangleF 0, 0, 256, 256), $format)
  $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
  $stream = [System.IO.File]::Create($IconPath)
  $icon.Save($stream)
  $stream.Close()
  $graphics.Dispose()
  $bitmap.Dispose()
  $font.Dispose()
  $brush.Dispose()
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Starter`""
$shortcut.WorkingDirectory = $AppDir
$shortcut.IconLocation = $IconPath
$shortcut.Description = 'Inicia o servidor local e abre o sistema Ordem de Corte'
$shortcut.Save()

Write-Host "Atalho criado em: $ShortcutPath"
