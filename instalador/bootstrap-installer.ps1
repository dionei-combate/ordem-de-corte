$ErrorActionPreference = 'Stop'

$archive = Join-Path $PSScriptRoot 'Ordem-de-Corte-Instalador-Excelencia.zip'
$work = Join-Path $env:TEMP ('OrdemDeCorteSetup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $work | Out-Null

try {
  Expand-Archive -LiteralPath $archive -DestinationPath $work -Force
  $installer = Join-Path $work 'instalador\Instalar-Ordem-de-Corte.ps1'
  $argsList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$installer`"")
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $argsList -Verb RunAs -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "A instalação terminou com código $($process.ExitCode)."
  }
} finally {
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
