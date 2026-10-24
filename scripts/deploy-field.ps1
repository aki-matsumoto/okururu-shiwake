<#
.SYNOPSIS
    Deploy okururu-shiwake (sorting extension) from this repo to the FIELD shared OneDrive folder.

.DESCRIPTION
    Field PCs load the unpacked extension from the shared OneDrive folder.
    background.js (checkDiskVersionAndReload) reloads the extension only when the
    manifest.json ON DISK is newer than the loaded one. So a release reaches the
    field only after the new code is copied into the shared folder. This script
    does that copy (robocopy /MIR) with safety checks.

    Since 2026-06 the OneDrive robocopy step was removed from push-feature.ps1,
    and the shared folder stayed at v0.8.1 while C:\dev was v0.8.4. This script
    is the replacement distribution step.

    Destination:
        $env:FIELD_ONEDRIVE_SHIWAKE  (sorting extension ONLY)
        Default when unset:
          C:\Users\matsu\OneDrive - <company>\<okururu>\okururu-shiwake
        !! Do NOT use FIELD_ONEDRIVE. That variable belongs to the appraisal
        !! extension (okuruuru-mistake-prevention). /MIR into that folder would
        !! wipe the appraisal extension.

    Source:
        Repo root (parent of this script's folder). Override with -RepoDir.

    This file is ASCII only on purpose: Windows PowerShell 5.1 reads BOM-less
    files as ANSI, so Japanese path parts are built from char codes below.

    Usage:
        .\scripts\deploy-field.ps1 -DryRun    # preview only (no file changes)
        .\scripts\deploy-field.ps1            # deploy
#>
param(
    [string]$RepoDir = '',
    [string]$FieldDir = '',
    [switch]$DryRun
)

$ErrorActionPreference = 'Continue'

function Fail($msg) {
    Write-Host ""
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

# Japanese strings from char codes (keeps this file ASCII-safe for PS 5.1)
$JP_COMPANY = -join [char[]](0x682A,0x5F0F,0x4F1A,0x793E,0x30DE,0x30C3,0x30C1,0x30D0,0x30F3,0x30AF)  # kabushiki-gaisha MatchBank
$JP_OKURURU = -join [char[]](0x30AA,0x30AF,0x30EB,0x30A6,0x30EB)                                    # okururu (katakana)
$JP_SATEI   = -join [char[]](0x67FB,0x5B9A)                                                         # satei (appraisal)
$DefaultFieldDir = 'C:\Users\matsu\OneDrive - ' + $JP_COMPANY + '\' + $JP_OKURURU + '\okururu-shiwake'

# ---- resolve source / destination ----
if (-not $RepoDir) { $RepoDir = Split-Path -Parent $PSScriptRoot }
if (-not $FieldDir) { $FieldDir = $env:FIELD_ONEDRIVE_SHIWAKE }
if (-not $FieldDir) {
    $FieldDir = $DefaultFieldDir
    Write-Host "FIELD_ONEDRIVE_SHIWAKE is not set -> using default: $FieldDir" -ForegroundColor Yellow
}

if (-not (Test-Path $RepoDir)) { Fail "RepoDir not found: $RepoDir" }
$RepoDir = (Resolve-Path $RepoDir).Path
$srcManifest = Join-Path $RepoDir 'manifest.json'
if (-not (Test-Path $srcManifest)) { Fail "RepoDir has no manifest.json (not the extension repo): $RepoDir" }
if (-not (Test-Path $FieldDir)) { Fail "Field folder not found: $FieldDir" }
$FieldDir = (Resolve-Path $FieldDir).Path
$destManifest = Join-Path $FieldDir 'manifest.json'

function Get-ManifestField([string]$path, [string]$key) {
    if (-not (Test-Path $path)) { return '' }
    # Regex instead of ConvertFrom-Json: robust against BOM/encoding quirks in PS 5.1.
    # First hit = top-level key (manifest.json lists name/version before nested objects).
    $hit = Select-String -Path $path -Pattern ('"' + $key + '"\s*:\s*"([^"]+)"') -Encoding UTF8 | Select-Object -First 1
    if ($hit) { return $hit.Matches[0].Groups[1].Value }
    return ''
}

# ---- safety checks ----
# 1) destination path must be the sorting extension folder
if ($FieldDir -notmatch 'okururu-shiwake') { Fail "Destination path does not contain 'okururu-shiwake': $FieldDir" }
# 2) destination must not be the appraisal extension folder
if ($FieldDir -match 'mistake-prevention') { Fail "Destination looks like the appraisal extension folder: $FieldDir" }
if ($env:FIELD_ONEDRIVE) {
    $sateiDir = $env:FIELD_ONEDRIVE.TrimEnd('\')
    if ($FieldDir.TrimEnd('\') -ieq $sateiDir) { Fail "Destination equals FIELD_ONEDRIVE (appraisal extension): $FieldDir" }
}
# 3) destination must not be the source itself
if ($FieldDir.TrimEnd('\') -ieq $RepoDir.TrimEnd('\')) { Fail "Destination equals source: $FieldDir" }
# 4) destination must be an extension folder (has manifest.json) or empty
$destHasFiles = [bool](Get-ChildItem -Force $FieldDir | Select-Object -First 1)
if ((-not (Test-Path $destManifest)) -and $destHasFiles) {
    Fail "Destination has files but no manifest.json: $FieldDir"
}
# 5) destination manifest must not be the appraisal extension
$srcName = Get-ManifestField $srcManifest 'name'
$dstName = Get-ManifestField $destManifest 'name'
if ($dstName -and $dstName.Contains($JP_SATEI)) { Fail "Destination manifest is the appraisal extension: $dstName" }
if ($dstName -and ($dstName -ne $srcName)) {
    Fail "Destination manifest name differs from source.`n  source: $srcName`n  dest  : $dstName"
}

$srcVer = Get-ManifestField $srcManifest 'version'
$dstVer = Get-ManifestField $destManifest 'version'
if (-not $dstVer) { $dstVer = '(none)' }

Write-Host ""
Write-Host "Deploy okururu-shiwake to field OneDrive" -ForegroundColor Cyan
Write-Host "  source : $RepoDir (v$srcVer)"
Write-Host "  dest   : $FieldDir (v$dstVer)  <- BEFORE"
if ($DryRun) { Write-Host "  mode   : DRY RUN (no changes)" -ForegroundColor Yellow }
Write-Host ""

# /MIR = copy new/changed + delete files removed from the repo, so the field
# folder matches the runtime set. Items matched by /XD and /XF are excluded from
# BOTH copy and purge: an excluded dir already in the destination (e.g. .git)
# is left untouched by /MIR (it is never an "extra" candidate).
#   .git          : the shared folder has its own .git; must never be touched
#   .github tests scripts node_modules dist release : dev/CI only, not loaded by Chrome
#   .vscode .idea : editor settings
#   _*            : Chrome rejects extensions containing names starting with "_"
#   *.bak *.tmp *.orig *.log *.zip *.lnk Thumbs.db desktop.ini .DS_Store .gitignore .gitattributes : junk/dev files
$flags = @(
    '/MIR',
    '/XD', '.git', '.github', 'tests', 'scripts', 'node_modules', 'dist', 'release', '.vscode', '.idea', '_*',
    '/XF', '*.bak', '*.tmp', '*.orig', '*.log', '*.zip', '*.lnk', 'Thumbs.db', 'desktop.ini', '.DS_Store', '.gitignore', '.gitattributes', '_*',
    '/R:2', '/W:2', '/NDL', '/NJH', '/NJS', '/NP'
)
if ($DryRun) { $flags += '/L' }

& robocopy $RepoDir $FieldDir @flags
$rc = $LASTEXITCODE
# robocopy exit codes: 0-7 = success (bit flags), 8+ = failure.
if ($rc -ge 8) { Fail "robocopy failed (exit code $rc)" }

$afterVer = Get-ManifestField $destManifest 'version'
Write-Host ""
if ($DryRun) {
    Write-Host "DRY RUN complete (robocopy exit $rc). dest still v$dstVer. Re-run without -DryRun to apply." -ForegroundColor Yellow
} else {
    Write-Host "  dest   : $FieldDir (v$afterVer)  <- AFTER" -ForegroundColor Green
    if ($afterVer -ne $srcVer) { Fail "Version after copy (v$afterVer) does not match source (v$srcVer)" }
    Write-Host "Done: v$dstVer -> v$afterVer (robocopy exit $rc)." -ForegroundColor Green
    Write-Host "OneDrive syncs to field PCs; each PC reloads within 30 min (or on Chrome start)." -ForegroundColor Green
    Write-Host "Check on a field PC: chrome://extensions shows v$srcVer." -ForegroundColor Green
}
