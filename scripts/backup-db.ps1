<#
    Backup do banco, com rotação.

    É a única resposta real a ransomware e a erro humano — nenhuma das outras
    defesas recupera dado apagado. Gera um dump comprimido, guarda os últimos
    N e descarta o resto.

    Uso:
      .\scripts\backup-db.ps1                       # banco local
      .\scripts\backup-db.ps1 -Url "postgresql://..." -Keep 30
      .\scripts\backup-db.ps1 -Destino "D:\backups\clinistudio"

    Restaurar:
      pg_restore --clean --if-exists -d "<URL>" arquivo.dump

    IMPORTANTE: um backup que mora no mesmo lugar que o banco não é backup.
    Ransomware cifra a pasta inteira. Aponte -Destino para outro disco, ou
    sincronize a pasta para uma nuvem depois.
#>
param(
  [string] $Url,
  # Arquivo contendo só a URL de conexão. Existe para a tarefa agendada: o que
  # vai nos argumentos de uma tarefa é legível por qualquer conta da máquina, e
  # essa URL é a senha do banco de produção. O arquivo, criado pelo
  # agendar-backup.ps1, fica com permissão só para o seu usuário.
  [string] $UrlFile,
  [string] $Destino = (Join-Path $PSScriptRoot '..\backups'),
  [int]    $Keep = 14
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump nao esta no PATH. Adicione 'C:\Program Files\PostgreSQL\<versao>\bin'."
}

if (-not $Url -and $UrlFile) {
  if (-not (Test-Path $UrlFile)) { throw "Arquivo de URL nao encontrado: $UrlFile" }
  $Url = (Get-Content $UrlFile -Raw).Trim().Trim('"', "'")
  if (-not $Url) { throw "O arquivo $UrlFile esta vazio." }
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
$arquivo = Join-Path $Destino "clinistudio_$carimbo.dump"

Write-Host "Gerando $arquivo ..." -ForegroundColor Cyan

# -Fc: formato customizado, comprimido e restaurável seletivamente.
pg_dump --format=custom --no-owner --no-privileges --file="$arquivo" "$Url"
if ($LASTEXITCODE -ne 0) { throw 'pg_dump falhou.' }

$mb = [math]::Round((Get-Item $arquivo).Length / 1MB, 2)
Write-Host "[ok] backup gerado ($mb MB)" -ForegroundColor Green

# ------------------------------------------------------------- conferência
# Backup que nunca foi lido nao e backup — e um arquivo. `pg_restore --list`
# abre o dump e imprime o indice do que ha dentro: se o arquivo estiver
# truncado ou corrompido, falha aqui, hoje, e nao no dia em que for preciso.
$indice = pg_restore --list "$arquivo" 2>&1
if ($LASTEXITCODE -ne 0) {
  Remove-Item $arquivo -Force
  throw "O dump saiu ilegivel e foi descartado. Nenhum backup antigo foi tocado.`n$indice"
}

# Quantas tabelas o dump carrega. A conta importa por causa de um modo de
# falha silencioso: se a DATABASE_URL apontar para um banco vazio — o errado,
# um recem-criado —, o pg_dump termina com sucesso e gera um dump sem nada.
# Rodando agendado, em poucos dias a rotacao teria apagado todos os backups
# bons e sobrado so os vazios.
$tabelas = ($indice | Select-String -Pattern 'TABLE DATA' -SimpleMatch).Count
$MinimoTabelas = 20

if ($tabelas -lt $MinimoTabelas) {
  Remove-Item $arquivo -Force
  throw @"
Backup suspeito: $tabelas tabelas com dados, esperado ao menos $MinimoTabelas.
O arquivo foi descartado e a rotacao NAO rodou — os backups antigos continuam
onde estavam.

Quase sempre significa que -Url aponta para o banco errado (um vazio) ou que o
banco de producao perdeu dados. Confira antes de rodar de novo.
"@
}

Write-Host "[ok] dump conferido: $tabelas tabelas com dados" -ForegroundColor Green

# --------------------------------------------------------------- rotação
# So chega aqui depois do dump novo passar na conferencia: nenhum backup bom e
# descartado em troca de um ruim.
$antigos = Get-ChildItem $Destino -Filter 'clinistudio_*.dump' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Keep

foreach ($velho in $antigos) {
  Remove-Item $velho.FullName -Force
  Write-Host "[--] removido $($velho.Name)" -ForegroundColor DarkGray
}

$total = (Get-ChildItem $Destino -Filter 'clinistudio_*.dump').Count
Write-Host "[ok] $total backups guardados em $Destino" -ForegroundColor Green
