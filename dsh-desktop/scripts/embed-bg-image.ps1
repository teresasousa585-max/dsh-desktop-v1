# embed-bg-image.ps1
# 把任意本地图片压缩后转为 Base64 data URI，并内嵌进 preload.js。
# 这样图片直接写进代码，随应用一起分发，不需要附带图片文件。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/embed-bg-image.ps1 -ImagePath D:\2.jpg
#
# 可选参数：
#   -ImagePath   源图片路径（默认 D:\2.jpg）
#   -PreloadPath 目标 preload.js（默认 ../preload.js）
#   -OutImage    压缩后图片落盘路径（可选，仅作预览/备份，默认不写）
#   -MaxWidth    压缩最大宽度（默认 1920）
#   -Quality     JPEG 质量 1-100（默认 78）

param(
  [string]$ImagePath = 'D:\2.jpg',
  [string]$PreloadPath = (Join-Path $PSScriptRoot '..\preload.js'),
  [string]$OutImage = '',
  [int]$MaxWidth = 1920,
  [int]$Quality = 78
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $ImagePath)) { throw "找不到图片: $ImagePath" }
if (-not (Test-Path $PreloadPath)) { throw "找不到 preload.js: $PreloadPath" }

$src = [System.Drawing.Image]::FromFile($ImagePath)
try {
  $w = $src.Width
  $h = $src.Height
  if ($w -gt $MaxWidth) {
    $newW = $MaxWidth
    $newH = [int][math]::Round($h * $MaxWidth / $w)
  } else {
    $newW = $w
    $newH = $h
  }

  $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
  try {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.DrawImage($src, 0, 0, $newW, $newH)
    } finally {
      $g.Dispose()
    }

    if (-not $OutImage) {
      $OutImage = Join-Path ([System.IO.Path]::GetTempPath()) 'dsh-bg-embedded.jpg'
    }

    $codecs = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()
    $jpeg = $codecs | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
    if (-not $jpeg) { throw '系统没有可用的 JPEG 编码器' }

    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    $bmp.Save($OutImage, $jpeg, $ep)

    $bytes = [System.IO.File]::ReadAllBytes($OutImage)
    $b64 = [System.Convert]::ToBase64String($bytes)
    $dataUri = "data:image/jpeg;base64,$b64"

    $preload = [System.IO.File]::ReadAllText($PreloadPath)
    if ($preload -notmatch '__DSH_BG_IMAGE_BASE64__') {
      throw 'preload.js 中没有找到占位符 __DSH_BG_IMAGE_BASE64__'
    }
    $preload = $preload.Replace('__DSH_BG_IMAGE_BASE64__', $dataUri)
    [System.IO.File]::WriteAllText($PreloadPath, $preload, (New-Object System.Text.UTF8Encoding($false)))

    $kb = [math]::Round($bytes.Length / 1KB, 1)
    Write-Host "完成: 图片 ${w}x${h} -> ${newW}x${newH}, JPEG ${Quality}%, Base64 ${kb} KB"
    Write-Host "内嵌到: $PreloadPath"
    Write-Host "压缩预览: $OutImage"
  } finally {
    $bmp.Dispose()
  }
} finally {
  $src.Dispose()
}
