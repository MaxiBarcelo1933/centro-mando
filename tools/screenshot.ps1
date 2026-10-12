# Saca una captura de la app a tamaño iPhone 16 Pro Max (440x956), con Chrome invisible
# y un perfil temporal. Opcionalmente ejecuta JavaScript antes (cargar datos, tocar botones).
# Necesita el servidor local corriendo (tools\serve.ps1).
#
# Uso:  powershell -ExecutionPolicy Bypass -File tools\screenshot.ps1 -Out captura.png `
#         [-Path '#hoy'] [-Script 'document.getElementById("fab").click()'] [-Port 8080]

param(
    [Parameter(Mandatory = $true)][string]$Out,
    [string]$Path = '',
    [string]$Script = '',
    [string]$ScriptFile = '',
    [int]$Port = 8080,
    [int]$DebugPort = 9333
)

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profileDir = Join-Path $env:TEMP ("mando-shot-" + [guid]::NewGuid())
$proc = Start-Process -FilePath $chrome -PassThru -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    "--remote-debugging-port=$DebugPort", "--user-data-dir=$profileDir", 'about:blank'
)

if ($ScriptFile) { $Script = Get-Content -Raw -Encoding UTF8 $ScriptFile }

$ws = $null
$script:nextId = 0

# Manda un comando al protocolo de depuración de Chrome y espera su respuesta.
function Send-Cdp([string]$method, $params = @{}) {
    $script:nextId++
    $id = $script:nextId
    $json = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $null = $ws.SendAsync([ArraySegment[byte]]::new($bytes), 'Text', $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $buffer = New-Object byte[] 1048576
    while ($true) {
        $ms = New-Object IO.MemoryStream
        do {
            $result = $ws.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            $ms.Write($buffer, 0, $result.Count)
        } while (-not $result.EndOfMessage)
        $message = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
        if ($message.id -eq $id) { return $message }
    }
}

try {
    # Esperamos a que Chrome abra el puerto de depuración.
    $target = $null
    for ($i = 0; $i -lt 50 -and -not $target; $i++) {
        Start-Sleep -Milliseconds 200
        try { $target = (Invoke-RestMethod "http://127.0.0.1:$DebugPort/json") | Where-Object { $_.type -eq 'page' } | Select-Object -First 1 } catch { }
    }
    if (-not $target) { throw 'No se pudo conectar con Chrome' }

    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $null = $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

    $null = Send-Cdp 'Emulation.setDeviceMetricsOverride' @{ width = 440; height = 956; deviceScaleFactor = 2; mobile = $true }
    $null = Send-Cdp 'Emulation.setUserAgentOverride' @{ userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }
    $null = Send-Cdp 'Page.navigate' @{ url = "http://localhost:$Port/$Path" }
    Start-Sleep -Milliseconds 1500

    if ($Script) {
        $eval = Send-Cdp 'Runtime.evaluate' @{ expression = "(async () => { $Script })()"; awaitPromise = $true }
        if ($eval.result.exceptionDetails) { Write-Host "Error en el script: $($eval.result.exceptionDetails.exception.description)" }
        Start-Sleep -Milliseconds 900
    }

    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes($Out, [Convert]::FromBase64String($shot.result.data))
    Write-Host "Captura guardada en $Out"
} finally {
    if ($ws) { $ws.Dispose() }
    & taskkill /PID $proc.Id /T /F 2>$null | Out-Null
    Start-Sleep -Milliseconds 500
    Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
}
