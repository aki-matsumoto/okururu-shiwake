# インストール & 配布手順 — オクルウル仕分け支援ツール

## A. 検証用に読み込む（load unpacked）
1. `chrome://extensions` を開く → 右上「デベロッパーモード」ON
2. 「パッケージ化されていない拡張機能を読み込む」→ この `okururu-shiwake` フォルダを選択
3. ReCORE 買取ケース詳細（/bad/case/<id>）を開く（既に開いていれば再読み込み）

## B. 初回だけ：GitHub リポジトリ作成（アップデート通知の配信元）
アップデート通知は `release/latest.json` を GitHub raw から取得します。初回のみ:

1. GitHub で空リポジトリ `okururu-shiwake` を作成（owner: `aki-matsumoto`）。
   - リポ名/ownerを変える場合は `background.js` の `VERSION_FEED_URL`、`manifest.json` の `host_permissions`、`scripts/*.js` の `REPO_SLUG` を合わせて変更。
2. C:\dev に clone してOneDriveの中身を入れて初回 push:
   ```powershell
   git clone https://github.com/aki-matsumoto/okururu-shiwake C:\dev\okururu-shiwake
   $env:ONEDRIVE_REPO = 'C:\Users\<you>\OneDrive\ドキュメント\Claude\Projects\リコアカタログへ商品リストをインポート\okururu-shiwake'
   [Environment]::SetEnvironmentVariable('ONEDRIVE_REPO', $env:ONEDRIVE_REPO, 'User')
   robocopy $env:ONEDRIVE_REPO C:\dev\okururu-shiwake /E /XD .git node_modules dist
   cd C:\dev\okururu-shiwake
   git add -A; git commit -m "init v0.3.0"; git branch -M main; git push -u origin main
   ```
3. push 後、CI が走り `release/latest.json` が main に置かれます（以降、通知が機能）。

## C. 以降のリリース運用
1. OneDrive 側でコードを編集（拡張のロード元は OneDrive フォルダ）。
2. `manifest.json` の version と `CHANGELOG.md` を更新。
3. リリース:
   ```powershell
   .\scripts\push-feature.ps1 feature/vX.Y.Z-xxx "Add: ..."
   ```
   → PR を作成 → main にマージ。
4. main マージで CI が:
   - JS構文チェック / manifest検証 / node テスト / zipビルド
   - `vX.Y.Z` タグ自動付与
   - `release/latest.json` を自動更新して main に push
5. 各PCの拡張は 30分以内に新版を検知し、上部に通知バナー表示。
   - **全PC即時更新したい場合**：`release/latest.json` の `force_min_version` を上げる（未満のPCは自動 `chrome.runtime.reload()`）。

## 注意
- 拡張のロード元は **OneDrive フォルダ**。C:\dev だけ編集してもブラウザに反映されない。
- 削除ファイルは robocopy では同期されない。削除配布時は C:\dev で `git rm` を別途実行。
- 既存「査定支援拡張」と同時稼働するとマークが重複（重複警告バナーが出る）。どちらか一方をOFFに。
