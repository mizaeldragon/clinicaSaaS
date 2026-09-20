<#
    Agenda o backup diário do banco de produção no Windows.

    Roda uma vez. Cria a tarefa no Agendador do Windows, guarda a URL do banco
    num arquivo protegido e deixa o backup acontecendo sozinho todo dia.

    Uso:
      .\scripts\agendar-backup.ps1 -Url "<DATABASE_PUBLIC_URL do Railway>" -Destino "D:\backups\clinistudio"

      # trocar o horário (padrão 03:00)
      .\scripts\agendar-backup.ps1 -Url "..." -Destino "D:\..." -Hora "22:30"

      # conferir / remover depois
      Get-ScheduledTask -TaskName 'CliniStudio - backup do banco'
      Get-ScheduledTaskInfo -TaskName 'CliniStudio - backup do banco'   # LastTaskResult 0 = ok
      Unregister-ScheduledTask -TaskName 'CliniStudio - backup do banco'

    LIMITE QUE VOCÊ PRECISA CONHECER: isto depende deste computador estar
    ligado. O agendador tem `StartWhenAvailable`, então uma execução perdida
    roda assim que a máquina voltar — mas se o PC passar uma semana desligado,
    é uma semana sem backup. Para um cliente pagante de verdade, o certo é um
    backup gerenciado rodando fora daqui.

    NÃO use o GitHub Actions para isto: este repositório é público, e o dump
    subiria como artifact baixável por qualquer pessoa. Seria vazar o banco
    inteiro de clínica — dado de saúde — para a internet.
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $Url,

  [Parameter(Mandatory = $true)]
  [string] $Destino,

  [string] $Hora = '03:00',
  [int]    $Keep = 14,
  [string] $NomeTarefa = 'CliniStudio - backup do banco'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump nao esta no PATH. Adicione 'C:\Program Files\PostgreSQL\<versao>\bin' e abra o PowerShell de novo."
}

$scriptBackup = Join-Path $PSScriptRoot 'backup-db.ps1'
if (-not (Test-Path $scriptBackup)) { throw "Nao achei o backup-db.ps1 ao lado deste script." }

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$Destino = (Resolve-Path $Destino).Path

# ------------------------------------------------- a URL, fora da vista
# Guardada ao lado dos backups, nao no repositorio: um .ps1 com a senha do
# banco dentro da pasta do projeto acaba num `git add -A` distraido.
$arquivoUrl = Join-Path $Destino '.database-url'
Set-Content -Path $arquivoUrl -Value $Url -Encoding utf8 -NoNewline

# Permissao so para o seu usuario. Sem isto o arquivo herda as permissoes da
# pasta, e qualquer conta da maquina le a senha do banco de producao.
$acl = Get-Acl $arquivoUrl
$acl.SetAccessRuleProtection($true, $false)   # para de herdar; limpa o herdado
$acl.SetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
  "$env:USERDOMAIN\$env:USERNAME", 'FullControl', 'Allow'
)))
Set-Acl -Path $arquivoUrl -AclObject $acl

Write-Host "[ok] URL guardada em $arquivoUrl (so o seu usuario le)" -ForegroundColor Green

# ------------------------------------------------------------- a tarefa
$logBackup = Join-Path $Destino 'backup.log'

# `-File` em vez de `-Command`: assim o codigo de saida do script vira o
# resultado da tarefa, e o LastTaskResult passa a valer alguma coisa.
$argumentos = @(
  '-NoProfile'
  '-NonInteractive'
  '-ExecutionPolicy', 'Bypass'
  '-File', "`"$scriptBackup`""
  '-UrlFile', "`"$arquivoUrl`""
  '-Destino', "`"$Destino`""
  '-Keep', $Keep
) -join ' '

$acao = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument $argumentos `
  -WorkingDirectory $PSScriptRoot

$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora

# StartWhenAvailable: PC desligado na hora marcada roda assim que ligar.
# DontStopIfGoingOnBatteries: notebook no cabo ou não, o backup acontece.
$config = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $NomeTarefa `
  -Action $acao `
  -Trigger $gatilho `
  -Settings $config `
  -Description 'Dump diario do banco de producao do CliniStudio, com conferencia e rotacao.' `
  -Force | Out-Null

Write-Host "[ok] tarefa '$NomeTarefa' agendada para todo dia as $Hora" -ForegroundColor Green

# --------------------------------------------------- provar que funciona
# Agendamento que nunca rodou nao vale nada: o erro aparece daqui a um mes, na
# noite em que o backup fizer falta. Roda agora, na sua frente.
Write-Host "`nRodando uma vez para conferir..." -ForegroundColor Cyan

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptBackup `
  -UrlFile $arquivoUrl -Destino $Destino -Keep $Keep 2>&1 | Tee-Object -FilePath $logBackup

if ($LASTEXITCODE -ne 0) {
  throw "O backup de teste falhou (veja $logBackup). A tarefa ficou agendada, mas conserte isto antes de confiar nela."
}

Write-Host "`n[ok] backup de teste gerado em $Destino" -ForegroundColor Green
Write-Host @"

Falta uma coisa, e ela e a que importa:

  TESTE A RESTAURACAO. Um backup que nunca foi restaurado e uma suposicao.
  Num banco descartavel:

    pg_restore --clean --if-exists -d "<url-de-um-banco-vazio>" "<arquivo>.dump"

  E mande a pasta $Destino para fora deste computador — outro disco ja ajuda,
  uma nuvem e melhor. Backup que mora junto do que ele protege morre junto.

"@ -ForegroundColor Yellow
