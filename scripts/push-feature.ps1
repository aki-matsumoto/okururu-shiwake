<#
.SYNOPSIS
    C:\dev\okururu-shiwake を直接編集する運用。現在の変更を feature ブランチで commit & push。

.NOTE
    2026-06 改訂: OneDrive 同期(robocopy)方式を廃止。C:\dev\okururu-shiwake が唯一の作業場所。
    最新 main から始めたい場合は先に:
        git checkout main; git pull
    その後 C:\dev のファイルを編集してから本スクリプトを実行する。

.USAGE
    .\scripts\push-feature.ps1 feature/vX.Y.Z-xxx "Fix: ..."
#>
param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Branch,
    [Parameter(Mandatory = $true, Position = 1)][string]$Message
)
$ErrorActionPreference = 'Continue'
function Fail($m){ Write-Host ""; Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }
function Run-Git { param([string[]]$GitArgs, [string]$FailMsg) & git @GitArgs; if ($LASTEXITCODE -ne 0) { Fail $FailMsg } }

$RepoDir = "C:\dev\okururu-shiwake"
$RepoUrl = "https://github.com/aki-matsumoto/okururu-shiwake"
if (-not (Test-Path $RepoDir)) { Fail "RepoDir not found: $RepoDir" }
Set-Location $RepoDir

Write-Host "[1/4] feature branch: $Branch (carries current edits)" -ForegroundColor Cyan
if (& git branch --list $Branch) { Run-Git @('checkout', $Branch) 'checkout (existing) failed' }
else { Run-Git @('checkout', '-b', $Branch) 'checkout -b failed' }

Write-Host "[2/4] git status" -ForegroundColor Cyan
$status = & git status --short
if (-not $status) { Write-Warning "No changes. Edit files under C:\dev\okururu-shiwake first, then re-run."; exit 0 }
Write-Host $status -ForegroundColor Gray

Write-Host "[3/4] commit" -ForegroundColor Cyan
Run-Git @('add', '-A') 'git add failed'
Run-Git @('commit', '-m', $Message) 'git commit failed'

Write-Host "[4/4] push" -ForegroundColor Cyan
Run-Git @('push', '-u', 'origin', $Branch) 'git push failed'

Write-Host ""
Write-Host "DONE" -ForegroundColor Green
Write-Host "  PR: $RepoUrl/pull/new/$Branch" -ForegroundColor White
Write-Host "  After merge, CI auto-creates the version tag and updates release/latest.json" -ForegroundColor Gray
