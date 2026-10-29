# Avisos de Windows 30 y 5 minutos antes de cada tarea de taller de Leadership (ADR-W016).
#
# Lee de Leadership las tareas abiertas de hoy y mañana que creó Work (descripción que empieza
# con [work-ws:<id>:<clave>]) y lanza una notificación de Windows cuando faltan 30 y 5 minutos
# para su hora de inicio. Corre cada minuto desde el Programador de tareas; recuerda lo que ya
# avisó en %LOCALAPPDATA%\NeurOPS\avisos_leadership.json para no repetir.
#
#   .\scripts\avisos_leadership.ps1 -Instalar    registra la tarea programada (cada minuto)
#   .\scripts\avisos_leadership.ps1 -Quitar      la borra
#   .\scripts\avisos_leadership.ps1 -Probar      lanza un aviso de prueba
#   .\scripts\avisos_leadership.ps1              una pasada (lo que ejecuta la tarea)
#   -Ahora '2026-11-02 11:30'                    pasada como si fuera esa hora, sin recordar avisos
#
# Necesita LEADERSHIP_URL y LEADERSHIP_TOKEN como variables de entorno de usuario. La hora de las
# tareas es de reloj: se compara con el reloj de esta PC (la zona de Windows debe ser la de Kerwin).
param(
    [switch]$Instalar,
    [switch]$Quitar,
    [switch]$Probar,
    [datetime]$Ahora
)

$ErrorActionPreference = 'Stop'
$Nombre = 'NeurOPS - avisos de Leadership'
$Avisos = @(30, 5)
$Estado = Join-Path $env:LOCALAPPDATA 'NeurOPS\avisos_leadership.json'
$AppId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'

function Enviar-Aviso([string]$Titulo, [string]$Texto) {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $t = [Security.SecurityElement]::Escape($Titulo)
    $x = [Security.SecurityElement]::Escape($Texto)
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$t</text><text>$x</text></binding></visual><audio src='ms-winsoundevent:Notification.Reminder'/></toast>")
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)
}

if ($Instalar) {
    $script = $MyInvocation.MyCommand.Path
    $accion = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
    $disparo = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
    $ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
    Register-ScheduledTask -TaskName $Nombre -Action $accion -Trigger $disparo -Settings $ajustes -Force | Out-Null
    Write-Output "Tarea '$Nombre' registrada: corre cada minuto."
    return
}
if ($Quitar) {
    Unregister-ScheduledTask -TaskName $Nombre -Confirm:$false
    Write-Output "Tarea '$Nombre' borrada."
    return
}
if ($Probar) {
    Enviar-Aviso 'Prueba de avisos' 'Si ves esto, los avisos de Leadership llegan a Windows.'
    return
}

$url = [Environment]::GetEnvironmentVariable('LEADERSHIP_URL', 'User')
$token = [Environment]::GetEnvironmentVariable('LEADERSHIP_TOKEN', 'User')
if (-not $url -or -not $token) { throw 'Faltan LEADERSHIP_URL y LEADERSHIP_TOKEN (variables de usuario).' }

$simulado = $PSBoundParameters.ContainsKey('Ahora')
$ahora = if ($simulado) { $Ahora } else { Get-Date }
$desde = $ahora.Date.ToString('yyyy-MM-dd')
$hasta = $ahora.Date.AddDays(1).ToString('yyyy-MM-dd')
$resp = Invoke-WebRequest -UseBasicParsing -Headers @{ Authorization = "Bearer $token"; Accept = 'application/json' } `
    -Uri "$($url.TrimEnd('/'))/api/v1/me/tasks?status=open&due_from=$desde&due_to=$hasta"
# Sin charset en la respuesta, PowerShell 5.1 la lee como Latin-1: se decodifica a mano.
$cuerpo = [Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
$tareas = ($cuerpo | ConvertFrom-Json).data

$avisado = @{}
if (-not $simulado -and (Test-Path $Estado)) {
    (Get-Content $Estado -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $avisado[$_.Name] = $_.Value }
}

foreach ($t in $tareas) {
    if (-not $t.start_time -or -not ($t.description -match '^\[work-ws:\d+:\w+\]')) { continue }
    $inicio = [datetime]::ParseExact("$($t.due_date) $($t.start_time)", 'yyyy-MM-dd HH:mm', $null)
    $faltan = ($inicio - $ahora).TotalMinutes
    if ($faltan -le 0 -or $faltan -gt $Avisos[0]) { continue }
    # El umbral más chico que ya se alcanzó: si la PC estuvo apagada y falta menos de 5, solo ese aviso.
    $umbral = ($Avisos | Where-Object { $faltan -le $_ } | Measure-Object -Minimum).Minimum
    $clave = "$($t.id)|$($t.due_date) $($t.start_time)|$umbral"
    if ($avisado.ContainsKey($clave)) { continue }
    foreach ($u in $Avisos) { if ($u -ge $umbral) { $avisado["$($t.id)|$($t.due_date) $($t.start_time)|$u"] = $ahora.ToString('s') } }
    $minutos = [math]::Max(1, [math]::Ceiling($faltan))
    Enviar-Aviso "En $minutos min - $($inicio.ToString('HH:mm'))" $t.title
    Write-Output "Aviso: [$umbral] $($t.title)"
}

if (-not $simulado) {
    # Se olvidan los avisos de más de 2 días.
    $limite = $ahora.AddDays(-2)
    foreach ($k in @($avisado.Keys)) { if ([datetime]$avisado[$k] -lt $limite) { $avisado.Remove($k) } }
    New-Item -ItemType Directory -Force -Path (Split-Path $Estado) | Out-Null
    $avisado | ConvertTo-Json | Set-Content -Path $Estado -Encoding UTF8
}
