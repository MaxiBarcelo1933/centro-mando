# Corre las pruebas automáticas (tests/smoke.html) en Chrome invisible, con un perfil
# temporal para no tocar tus datos. Necesita el servidor local corriendo (tools\serve.ps1).
# Uso:  powershell -ExecutionPolicy Bypass -File tools\test.ps1  [-Port 8080]

param([int]$Port = 8080)

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resultFile = Join-Path $root 'tests\last-result.txt'
$profileDir = Join-Path $env:TEMP ("mando-test-" + [guid]::NewGuid())

Remove-Item $resultFile -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath $chrome -PassThru -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-first-run', "--user-data-dir=$profileDir",
    "http://localhost:$Port/tests/smoke.html"
)
try {
    # La página de pruebas manda el resultado al servidor, que lo guarda en tests\last-result.txt.
    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-Path $resultFile) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 300 }
    if (Test-Path $resultFile) {
        Get-Content $resultFile -Encoding UTF8 | ForEach-Object { Write-Host $_ }
    } else {
        Write-Host 'Las pruebas no terminaron en 60 segundos.'
    }
} finally {
    # Cerramos Chrome (y sus procesos hijos) y borramos el perfil temporal.
    & taskkill /PID $proc.Id /T /F 2>$null | Out-Null
    Start-Sleep -Milliseconds 500
    Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
}
