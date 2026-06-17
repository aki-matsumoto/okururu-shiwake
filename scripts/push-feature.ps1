<#
.SYNOPSIS
    OneDrive 作業フォルダを C:\dev\okururu-shiwake に同期し、feature ブランチで commit & push。
.DESCRIPTION
    OneDrive パスは ONEDRIVE_REPO 環境変数から読む（日本語パス隔離・このファイルを ASCII 安全に保つ）。

    初回セットアップ（PowerShell）:
        $onedrive = 'C:\Users\<you>\OneDrive\ドキュメント\Claude\Projects\リコアカタログへ商品リストをインポート\okururu-shiwake'
        [Environment]::SetEnvironmentVariable('ONEDRIVE_REPO', $onedrive, 'User')
        $env:ONEDRIVE_REPO = $onedrive

    使い方:
        .\scripts\push-feature.ps1 feature/v0.3.1-fix "Fix: ..."
.PARAMETER Branch  feature ブランチ名
.PARAMETER Message commit メッセージ
#>
param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Branch,
    [Parameter(Mandatory = $true, Position = 1)][string]$Message
)
$ErrorActionPreference = 'Continue'
function Fail($m) { Write-Host ""; Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }
function Run-Git { param([string[]]$GitArgs, [string]$FailMsg) & git @GitArgs; if ($LASTEXITCODE -ne 0) { Fail $FailMsg } }

$RepoDir = "C:\dev\okururu-shiwake"
$RepoUrl = "https://github.com/aki-matsumoto/okururu-shiwake"
$OneDriveDir = $env:ONEDRIVE_REPO
if (-not $OneDriveDir) { Fail "ONEDRIVE_REPO is not set." }
if (-not (Test-Path $RepoDir)) { Fail "RepoDir not found: $RepoDir (初回は INSTALL.md の手順で git clone)" }
if (-not (Test-Path $OneDriveDir)) { Fail "OneDriveDir not found: $OneDriveDir" }

Set-Location $RepoDir
Write-Host "[1/5] checkout main + pull" -ForegroundColor Cyan
Run-Git @('checkout', 'main') 'git checkout main failed'
Run-Git @('pull', '--ff-only') 'git pull failed'

Write-Host "[2/5] feature branch: $Branch" -ForegroundColor Cyan
if (& git branch --list $Branch) { Run-Git @('checkout', $Branch) 'checkout existing failed' }
else { Run-Git @('checkout', '-b', $Branch) 'checkout -b failed' }

Write-Host "[3/5] robocopy OneDrive -> C:\dev (del除外は手動 git rm)" -ForegroundColor Cyan
& robocopy $OneDriveDir $RepoDir /E /XD .git node_modules .vscode .idea dist /XF *.bak Thumbs.db .DS_Store /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -gt 7) { Fail "robocopy failed (exit=$LASTEXITCODE)" }

Write-Host "[4/5] git status" -ForegroundColor Cyan
$status = & git status --short
if (-not $status) { Write-Warning "No changes."; exit 0 }
Write-Host $status -ForegroundColor Gray

Write-Host "[5/5] commit + push" -ForegroundColor Cyan
Run-Git @('add', '-A') 'git add failed'
Run-Git @('commit', '-m', $Message) 'git commit failed'
Run-Git @('push', '-u', 'origin', $Branch) 'git push failed'

Write-Host "DONE" -ForegroundColor Green
Write-Host "PR: $RepoUrl/pull/new/$Branch" -ForegroundColor White
