$ErrorActionPreference = 'Stop'
try {
  Set-Location -LiteralPath $PSScriptRoot
  $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
  $node = [Environment]::ExpandEnvironmentVariables($config.node)
  if (-not (Test-Path -LiteralPath $node)) {
    $found = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($found) { $node = $found.Source }
  }
  if (-not (Test-Path -LiteralPath $node)) { throw 'Node nao encontrado. Edite node em config.json.' }
  & $node --no-warnings (Join-Path $PSScriptRoot 'verificar-node.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Use o Node portatil 22.14.0 ou superior com node:sqlite.' }
  $pidFile = Join-Path $PSScriptRoot 'processo.pid'
  if (Test-Path -LiteralPath $pidFile) {
    $old = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $existing = Get-Process -Id $old.id -ErrorAction SilentlyContinue
    if ($existing -and $existing.StartTime.ToUniversalTime().Ticks -eq $old.ticks) { throw 'Ja existe uma execucao. Consulte VER-PROGRESSO.bat.' }
  }
  $cancel = Join-Path $PSScriptRoot 'cancelar.flag'
  Remove-Item -LiteralPath $cancel -Force -ErrorAction SilentlyContinue
  $script = Join-Path $PSScriptRoot 'build-lidx.mjs'
  $cfg = Join-Path $PSScriptRoot 'config.json'
  $arguments = '"' + $script + '" "' + $cfg + '"'
  $p = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'progresso.log') -RedirectStandardError (Join-Path $PSScriptRoot 'erros.log') -PassThru
  try { $p.PriorityClass = 'BelowNormal' } catch {}
  @{id=$p.Id;ticks=$p.StartTime.ToUniversalTime().Ticks} | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding ASCII
  Write-Host 'Iniciado em segundo plano. Esta janela pode ser fechada.'
  Write-Host 'VER-PROGRESSO.bat mostra os logs. PARAR.bat solicita cancelamento.'
} catch { Write-Host ('[ERRO] ' + $_.Exception.Message); exit 1 }
