# Servidor local para probar la app en la compu (sin instalar nada).
# Uso:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1
#       (opcional: -Port 8081 si el 8080 está ocupado)
# Después abrí http://localhost:8080/ en Chrome. Para cortarlo: Ctrl+C.

param([int]$Port = 8080)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\') + '\'
$mime = @{
    '.html'        = 'text/html; charset=utf-8'
    '.js'          = 'text/javascript; charset=utf-8'
    '.css'         = 'text/css; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.svg'         = 'image/svg+xml'
    '.png'         = 'image/png'
    '.ico'         = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Centro de Mando corriendo en http://localhost:$Port/   (Ctrl+C para cortar)"

try {
    while ($listener.IsListening) {
        # Esperamos de a ratitos para que Ctrl+C funcione.
        $task = $listener.GetContextAsync()
        while (-not $task.AsyncWaitHandle.WaitOne(300)) { }
        $ctx = $task.GetAwaiter().GetResult()
        $req = $ctx.Request
        $res = $ctx.Response
        try {
            $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
            if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
            $full = [IO.Path]::GetFullPath((Join-Path $root $rel))

            # Solo servimos archivos de la carpeta del proyecto, y nunca carpetas ocultas (.git).
            $inside = $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)
            $hidden = $rel -match '(^|/)\.'
            if (-not $inside -or $hidden -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
                $res.StatusCode = 404
                $res.ContentType = 'text/plain; charset=utf-8'
                $bytes = [Text.Encoding]::UTF8.GetBytes('No encontrado')
            } else {
                $ext = [IO.Path]::GetExtension($full).ToLower()
                $type = $mime[$ext]
                if (-not $type) { $type = 'application/octet-stream' }
                $res.ContentType = $type
                $bytes = [IO.File]::ReadAllBytes($full)
            }
            $res.Headers['Cache-Control'] = 'no-cache'
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host ('{0} {1}' -f $res.StatusCode, $req.Url.AbsolutePath)
        } catch {
            Write-Host "Error: $_"
        } finally {
            $res.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
