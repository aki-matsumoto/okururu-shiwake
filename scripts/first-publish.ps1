<#
.SYNOPSIS
    初回公開（1回だけ）: GitHub に okururu-shiwake リポを作成し main へ push。
    以降の更新は scripts/push-feature.ps1 を使用。

.PREREQ
    - git インストール済み
    - GitHub CLI (gh) インストール&ログイン済み（`gh auth login`）
    - 環境変数 ONEDRIVE_REPO に OneDrive 側の okururu-shiwake フォルダのパスを設定
        $env:ONEDRIVE_REPO = 'C:\Users\<you>\OneDrive\...\okururu-shiwake'
        [Environment]::SetEnvironmentVariable('ONEDRIVE_REPO', $env:ONEDRIVE_REPO, 'User')

.NOTE
    gh が無い場合は、GitHub サイトで空リポ aki-matsumoto/okururu-shiwake (Public) を作成後、
    末尾の手動コマンド部分（gh の行を git remote add + push に置換）を実行してください。
#>
$ErrorActionPreference = 'Continue'
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

$OneDrive = $env:ONEDRIVE_REPO
$RepoDir  = "C:\dev\okururu-shiwake"
$Slug     = "aki-matsumoto/okururu-shiwake"
if(-not $OneDrive){ Fail "ONEDRIVE_REPO not set" }
if(-not (Test-Path $OneDrive)){ Fail "OneDrive path not found: $OneDrive" }

Write-Host "[1/4] sync to C:\dev" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $RepoDir | Out-Null
robocopy $OneDrive $RepoDir /E /XD .git node_modules dist .vscode /XF *.bak Thumbs.db .DS_Store /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if($LASTEXITCODE -gt 7){ Fail "robocopy failed (exit=$LASTEXITCODE)" }

Set-Location $RepoDir
Write-Host "[2/4] git init + initial commit" -ForegroundColor Cyan
if(-not (Test-Path ".git")){ git init | Out-Null }
git add -A
git commit -m "Release v0.6.0 (initial public)" | Out-Null
git branch -M main

Write-Host "[3/4] create GitHub repo + push (gh)" -ForegroundColor Cyan
$hasGh = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)
if($hasGh){
    gh repo create $Slug --public --source=. --remote=origin --push
    if($LASTEXITCODE -ne 0){ Fail "gh repo create failed. If repo exists, do: git remote add origin + git push -u origin main" }
} else {
    Write-Host "  gh not installed. Create Public repo $Slug on GitHub, then run:" -ForegroundColor Yellow
    Write-Host "    git remote add origin https://github.com/$Slug.git" -ForegroundColor White
    Write-Host "    git push -u origin main" -ForegroundColor White
    exit 0
}

Write-Host "[4/4] done" -ForegroundColor Green
Write-Host "  repo: https://github.com/$Slug" -ForegroundColor White
Write-Host "  feed: https://raw.githubusercontent.com/$Slug/main/release/latest.json" -ForegroundColor White
Write-Host "  next releases: use scripts/push-feature.ps1" -ForegroundColor Gray
