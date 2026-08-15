# embed-loading-image.ps1
# 把封面/加载页图片（默认 D:\4.jpg）压缩后转为 Base64 并内嵌到 loading.html。
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/embed-loading-image.ps1 -ImagePath D:\4.jpg
param(
  [string]$ImagePath = 'D:\4.jpg',
  [string]$LoadingPath = (Join-Path $PSScriptRoot '..\assets\loading.html'),
  [string]$OutImage = '',
  [int]$MaxWidth = 1920,
  [int]$Quality = 78
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $ImagePath)) { throw "找不到图片: $ImagePath" }
if (-not (Test-Path $LoadingPath)) { throw "找不到 loading.html: $LoadingPath" }

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
      $OutImage = Join-Path ([System.IO.Path]::GetTempPath()) 'dsh-loading-embedded.jpg'
    }
    $codecs = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()
    $jpeg = $codecs | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
    if (-not $jpeg) { throw '系统没有可用的 JPEG 编码器' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    $bmp.Save($OutImage, $jpeg, $ep)

    $bytes = [System.IO.File]::ReadAllBytes($OutImage)
    $b64 = [System.Convert]::ToBase64String($bytes)

    $html = [System.IO.File]::ReadAllText($LoadingPath)
    if ($html -notmatch '__DSH_LOADING_BG_BASE64__') {
      throw 'loading.html 中没有找到占位符 __DSH_LOADING_BG_BASE64__'
    }
    $html = $html.Replace('__DSH_LOADING_BG_BASE64__', $b64)
    [System.IO.File]::WriteAllText($LoadingPath, $html, (New-Object System.Text.UTF8Encoding($false)))

    $kb = [math]::Round($bytes.Length / 1KB, 1)
    Write-Host "完成: 图片 ${w}x${h} -> ${newW}x${newH}, JPEG ${Quality}%, Base64 ${kb} KB"
    Write-Host "内嵌到: $LoadingPath"
    Write-Host "压缩预览: $OutImage"
  } finally {
    $bmp.Dispose()
  }
} finally {
  $src.Dispose()
}
