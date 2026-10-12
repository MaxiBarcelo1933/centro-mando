# Genera los íconos PNG de la app (sin instalar nada: usa System.Drawing de Windows).
# Uso:  powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
#
# Diseño: fondo #0E1116, cuadrado redondeado de trazo ámbar y un check ámbar adentro.
# Se dibuja en una grilla de 512x512 y se escala a cada tamaño.

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
$bg = [System.Drawing.ColorTranslator]::FromHtml('#0E1116')
$amber = [System.Drawing.ColorTranslator]::FromHtml('#F5A524')

function New-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $d = $r * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

# $zoom < 1 achica el dibujo (los íconos "maskable" necesitan margen porque Android los recorta).
function New-Icon([int]$size, [float]$zoom, [string]$name) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bg)

    # Pasamos a coordenadas de 512x512 centradas.
    $scale = ($size / 512.0) * $zoom
    $g.TranslateTransform($size / 2.0, $size / 2.0)
    $g.ScaleTransform($scale, $scale)
    $g.TranslateTransform(-256, -256)

    $boxPen = New-Object System.Drawing.Pen $amber, 26
    $boxPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $box = New-RoundedRect 113 113 286 286 69
    $g.DrawPath($boxPen, $box)

    $checkPen = New-Object System.Drawing.Pen $amber, 30
    $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $points = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF 193, 262),
        (New-Object System.Drawing.PointF 239, 305),
        (New-Object System.Drawing.PointF 322, 216)
    )
    $g.DrawLines($checkPen, $points)

    $path = Join-Path $outDir $name
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $boxPen.Dispose(); $checkPen.Dispose(); $box.Dispose()
    Write-Host "Creado $name ($size x $size)"
}

New-Icon 180 1.0 'apple-touch-icon-180.png'
New-Icon 192 1.0 'icon-192.png'
New-Icon 512 1.0 'icon-512.png'
New-Icon 512 0.8 'icon-512-maskable.png'
