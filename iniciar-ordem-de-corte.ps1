param(
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Url = 'http://127.0.0.1:4180/'
$HealthUrl = 'http://127.0.0.1:4180/api/health'

function Test-OrdemDeCorte {
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-OrdemDeCorte)) {
  $node = (Get-Command node -ErrorAction Stop).Source
  Start-Process -FilePath $node -ArgumentList @('launcher.cjs') -WorkingDirectory $AppDir -WindowStyle Hidden

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-OrdemDeCorte) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "Nao foi possivel iniciar o servidor da Ordem de Corte. Abra o PowerShell na pasta do sistema e execute npm start para ver os detalhes.",
      "Ordem de Corte",
      "OK",
      "Error"
    ) | Out-Null
    exit 1
  }
}

if (-not $NoOpen) {
  Start-Process $Url
}
