<#
    Prepara o ambiente local contra a instalação nativa do PostgreSQL.

    Cria o banco se ele não existir, grava a senha na DATABASE_URL do
    backend/.env, aplica as migrations e popula o seed. A senha é pedida na
    hora e não fica no histórico do terminal.

    Uso:  .\scripts\setup-local.ps1
          .\scripts\setup-local.ps1 -Database belezza -Port 5432 -SkipSeed
#>
param(
  [string] $Database = 'belezza',
  [string] $DbUser   = 'postgres',
  [string] $DbHost   = 'localhost',
  [int]    $Port      = 5432,
  [switch] $SkipSeed
)

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$envFile = Join-Path $backend '.env'

# ---------------------------------------------------------------- pré-requisitos
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql não está no PATH. Adicione 'C:\Program Files\PostgreSQL\<versao>\bin' ao PATH."
}

$secure = Read-Host "Senha do usuário '$DbUser' no PostgreSQL" -AsSecureString
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if (-not $plain) { throw 'Senha vazia.' }

$env:PGPASSWORD = $plain
try {
  # ------------------------------------------------------------ cria o banco
  $exists = psql -U $DbUser -h $DbHost -p $Port -d postgres -tAc `
    "SELECT 1 FROM pg_database WHERE datname = '$Database'"
  if ($LASTEXITCODE -ne 0) { throw 'Não consegui conectar no PostgreSQL — senha errada ou serviço parado.' }

  if ($exists -eq '1') {
    Write-Host "[ok] banco '$Database' já existe" -ForegroundColor DarkGray
  } else {
    psql -U $DbUser -h $DbHost -p $Port -d postgres -c "CREATE DATABASE `"$Database`"" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Falhei ao criar o banco '$Database'." }
    Write-Host "[ok] banco '$Database' criado" -ForegroundColor Green
  }

  # ------------------------------------------------- grava a DATABASE_URL no .env
  # A senha vai codificada: um '@', ':' ou '#' cru quebraria a URL.
  $encoded = [Uri]::EscapeDataString($plain)
  $url     = "postgresql://${DbUser}:${encoded}@${DbHost}:${Port}/${Database}?schema=public"

  if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $backend '.env.example') $envFile }
  $lines = Get-Content $envFile
  if ($lines -match '^DATABASE_URL=') {
    $lines = $lines -replace '^DATABASE_URL=.*', "DATABASE_URL=`"$url`""
  } else {
    $lines += "DATABASE_URL=`"$url`""
  }
  # Sem BOM: o Set-Content do PowerShell 5.1 carimba um e ele sujaria a
  # primeira chave do .env se algum dia ela deixar de ser um comentário.
  [IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding $false))
  Write-Host '[ok] DATABASE_URL gravada em backend/.env' -ForegroundColor Green

  # ------------------------------------------------------ migrations e seed
  Push-Location $backend
  try {
    $env:DATABASE_URL = $url
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy falhou.' }
    Write-Host '[ok] migrations aplicadas' -ForegroundColor Green

    if (-not $SkipSeed) {
      npm run seed
      if ($LASTEXITCODE -ne 0) { throw 'seed falhou.' }
      Write-Host '[ok] seed aplicado' -ForegroundColor Green
    }
  } finally {
    Pop-Location
    Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
  }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  $plain = $null
}

Write-Host ''
Write-Host 'Pronto. Agora, em dois terminais:' -ForegroundColor Cyan
Write-Host '  cd backend  ; npm run dev'
Write-Host '  cd frontend ; npm run dev'
