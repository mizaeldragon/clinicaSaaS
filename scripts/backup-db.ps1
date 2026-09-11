<#
    Backup do banco, com rotação.

    É a única resposta real a ransomware e a erro humano — nenhuma das outras
    defesas recupera dado apagado. Gera um dump comprimido, guarda os últimos
    N e descarta o resto.

    Uso:
      .\scripts\backup-db.ps1                       # banco local
      .\scripts\backup-db.ps1 -Url "postgresql://..." -Keep 30
      .\scripts\backup-db.ps1 -Destino "D:\backups\belezza"

    Restaurar:
      pg_restore --clean --if-exists -d "<URL>" arquivo.dump

    IMPORTANTE: um backup que mora no mesmo lugar que o banco não é backup.
    Ransomware cifra a pasta inteira. Aponte -Destino para outro disco, ou
    sincronize a pasta para uma nuvem depois.
#>
param(
  [string] $Url,
  [string] $Destino = (Join-Path $PSScriptRoot '..\backups'),
  [int]    $Keep = 14
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump nao esta no PATH. Adicione 'C:\Program Files\PostgreSQL\<versao>\bin'."
}

# Sem -Url, lê a DATABASE_URL do backend/.env.
if (-not $Url) {
  $envFile = Join-Path $PSScriptRoot '..\backend\.env'
  if (-not (Test-Path $envFile)) { throw "Informe -Url ou crie o backend/.env." }
  $linha = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if (-not $linha) { throw "DATABASE_URL nao encontrada no backend/.env." }
  $Url = ($linha -replace '^DATABASE_URL=', '').Trim('"', "'")
}

# A DATABASE_URL do Prisma carrega parametros que so ele entende — `schema`,
# `connection_limit`, `pgbouncer`. O pg_dump recusa a URL inteira por causa
# deles, entao ficam de fora.
$conhecidos = @('sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'application_name', 'connect_timeout')
if ($Url -match '\?') {
  $base, $query = $Url -split '\?', 2
  $mantidos = @()
  foreach ($par in ($query -split '&')) {
    $nome = ($par -split '=', 2)[0]
    if ($conhecidos -contains $nome) { $mantidos += $par }
  }
  $Url = if ($mantidos.Count) { "$base`?" + ($mantidos -join '&') } else { $base }
}

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$Destino = (Resolve-Path $Destino).Path

$carimbo = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$arquivo = Join-Path $Destino "belezza_$carimbo.dump"

Write-Host "Gerando $arquivo ..." -ForegroundColor Cyan

# -Fc: formato customizado, comprimido e restaurável seletivamente.
pg_dump --format=custom --no-owner --no-privileges --file="$arquivo" "$Url"
if ($LASTEXITCODE -ne 0) { throw 'pg_dump falhou.' }

$mb = [math]::Round((Get-Item $arquivo).Length / 1MB, 2)
Write-Host "[ok] backup gerado ($mb MB)" -ForegroundColor Green

# --------------------------------------------------------------- rotação
$antigos = Get-ChildItem $Destino -Filter 'belezza_*.dump' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Keep

foreach ($velho in $antigos) {
  Remove-Item $velho.FullName -Force
  Write-Host "[--] removido $($velho.Name)" -ForegroundColor DarkGray
}

$total = (Get-ChildItem $Destino -Filter 'belezza_*.dump').Count
Write-Host "[ok] $total backups guardados em $Destino" -ForegroundColor Green
