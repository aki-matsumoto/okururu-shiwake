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
1. `C:\dev\okururu-shiwake` でコードを編集（ここが唯一の作業場所）。
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
5. **現場の共有フォルダへ配布（必須）** — 下の「D. 配布」。これをやらないと現場は古いまま。

## D. 配布（現場の共有フォルダへコピー）
現場PCの拡張は OneDrive 共有フォルダから読み込まれています。
`background.js` は **共有フォルダの `manifest.json` の version がロード中より新しいときだけ** 自動 reload します（30分ごと／Chrome起動時）。
つまり共有フォルダにコピーしない限り、main にマージしても現場には届きません。

配布先（仕分け専用）:
`C:\Users\matsu\OneDrive - 株式会社マッチバンク\オクルウル\okururu-shiwake`

```powershell
cd C:\dev\okururu-shiwake
git checkout main; git pull
.\scripts\deploy-field.ps1 -DryRun   # 何が変わるかだけ表示（変更なし）
.\scripts\deploy-field.ps1           # 本番コピー。前後の version が表示される
```

- 配布先は環境変数 `FIELD_ONEDRIVE_SHIWAKE` で変更可（未設定なら上の既定パス）。
  ```powershell
  [Environment]::SetEnvironmentVariable('FIELD_ONEDRIVE_SHIWAKE', '<配布先フォルダ>', 'User')
  ```
- **`FIELD_ONEDRIVE`（査定拡張用）は絶対に使わない。** `/MIR` なので査定拡張が消える。スクリプトはこの変数と同じ先・パスに `okururu-shiwake` を含まない先・manifest名に「査定」を含む先では停止する。
- `robocopy /MIR` なので、リポで消したファイルは共有フォルダからも消える（`git rm` の別作業は不要）。
- 除外（コピーも削除もしない）: `.git` `.github` `tests` `scripts` `node_modules` `dist` `release` `.vscode` `.idea` `_*` と一時ファイル類。共有フォルダ側の `.git` はそのまま残る。
- 完了後、現場PC1台の `chrome://extensions` で版を確認。

## 注意
- 拡張のロード元は **OneDrive 共有フォルダ**。C:\dev を編集・マージしただけではブラウザに反映されない → 必ず「D. 配布」。
- 既存「査定支援拡張」と同時稼働するとマークが重複（重複警告バナーが出る）。どちらか一方をOFFに。
