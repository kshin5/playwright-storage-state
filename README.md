# Playwright Storage State 生成ツール

Playwright MCP で Splunk にアクセスする際、事前にログイン済みのセッション（Storage State）を生成するためのツールです。認証情報を MCP の引数やログに載せずに、Storage State ファイルだけを渡して利用できます。

Windows / Linux / macOS / WSL2 に対応しています。

## なぜ JavaScript か

- 実行環境には **Node.js のみ** を前提とし、`tsx` や `ts-node` の導入は不要にしています。
- ランタイム依存を最小限にし、`node generate-storage-state.js` でそのまま実行できるようにしています。

## 前提条件

- **Node.js**（LTS 推奨）

## インストール

zip を任意の場所に展開し、展開先で以下を実行してください。`npm install` 時に Chromium ブラウザも自動でダウンロードされます。配置場所に制約はありません。

```bash
cd playwright-storage-state
npm install
```

> Chromium が自動インストールされない場合は、`npx playwright install chromium` を手動で実行してください。

## .env ファイルの作成

認証情報は `.env` 形式のファイルに記載します。プロジェクト内の `playwright/.auth/` ディレクトリに配置してください（[Playwright 公式の推奨パターン](https://playwright.dev/docs/auth#core-concepts)に準拠）。

```bash
mkdir -p playwright/.auth
```

`playwright/.auth/splunk-myenv.env` を以下の内容で作成します:

```
SPLUNK_URL=https://your-splunk-server:8000
SPLUNK_USER=your-username
SPLUNK_PASS=your-password
```

## セキュリティ上の注意

- `.env` ファイルには **パスワードが平文** で保存されます。
- `playwright/.auth/` は `.gitignore` で除外済みのため、git にはコミットされません。
- Linux / macOS / WSL2 では、`.env` ファイルのアクセス権限を制限してください:
  ```bash
  chmod 600 playwright/.auth/splunk-myenv.env
  ```
- 生成された Storage State ファイル（JSON）も認証情報に相当します。
  - Linux / macOS / WSL2 ではスクリプトが自動で `chmod 600` を設定します。
  - Windows ではスクリプト実行後にアクセス権限を手動で確認してください。

## 使用方法

プロジェクトディレクトリ内で実行します。

```bash
node generate-storage-state.js <env-file> <output-path>
```

例:

```bash
node generate-storage-state.js \
  playwright/.auth/splunk-myenv.env \
  playwright/.auth/splunk-myenv-storage.json
```

- 出力先のディレクトリが存在しない場合は自動作成されます（作成時にはログに `Created directory: ...` と出ます）。

## Cursor MCP 設定

`~/.cursor/mcp.json`（Windows: `%USERPROFILE%\.cursor\mcp.json`）に Playwright MCP を登録し、`--storage-state` で生成したファイルの**絶対パス**を指定します。

```json
"playwright-myenv": {
  "command": "npx",
  "args": [
    "-y", "@playwright/mcp@latest",
    "--browser", "chromium",
    "--headless",
    "--ignore-https-errors",
    "--isolated",
    "--storage-state", "<絶対パス>/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json"
  ]
}
```

絶対パスの例:

| 環境 | パスの例 |
|------|---------|
| Linux / WSL2 | `/home/<USER>/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json` |
| macOS | `/Users/<USER>/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json` |
| Windows | `C:\\Users\\<USER>\\playwright-storage-state\\playwright\\.auth\\splunk-myenv-storage.json` |

> `--storage-state` には **絶対パス** を指定してください。`~` や相対パスは MCP 起動時に正しく解決されない場合があります。

## セッション期限切れ時の再生成

Splunk のセッションは一定時間で切れます。ログイン画面に飛ばされたり MCP が認証エラーになる場合は、同じコマンドで Storage State を再生成してください。

```bash
node generate-storage-state.js \
  playwright/.auth/splunk-myenv.env \
  playwright/.auth/splunk-myenv-storage.json
```

再生成後、Cursor の MCP を OFF/ON するか、Cursor を再起動すると新しいセッションが使われます。

## トラブルシューティング

### Splunk サーバーに接続できない

- `SPLUNK_URL` が正しいか、スキーム（`https://`）を含むか確認してください。
- サーバーが起動しているか、ファイアウォールやネットワークでポートが開いているか確認してください。
- 自己署名証明書の環境では、Playwright MCP の起動引数に `--ignore-https-errors` を付けます（上記 MCP 設定例に含まれています）。

### ログインに失敗する

- `SPLUNK_USER` と `SPLUNK_PASS` が正しいか確認してください。
- スクリプトがログイン後の URL（`**/app/**`）への遷移を待ちます。タイムアウトする場合は、認証エラーや多要素認証（MFA）の可能性があります。画面に表示されるエラーメッセージがログに転記されていれば、その内容を確認してください。

### 証明書エラー（ERR_CERT_AUTHORITY_INVALID 等）

- 本ツールは `ignoreHTTPSErrors: true` で Splunk にアクセスするため、スクリプト単体では証明書エラーで止まりません。
- MCP 利用時は、上記のとおり `--ignore-https-errors` を MCP の起動引数に含めてください。

### Chromium が見つからない

- `npx playwright install chromium` を実行してブラウザをインストールしてください。

## ファイル構成

```
playwright-storage-state/
├── generate-storage-state.js   # 本スクリプト
├── package.json                # 依存関係
├── package-lock.json           # バージョン固定
├── .npmrc                      # npm レジストリ設定
├── .gitignore                  # playwright/.auth/ と node_modules/ を除外
├── README.md                   # このファイル
└── playwright/
    └── .auth/                  # 認証ファイルの配置先（自分で作成）
        ├── splunk-myenv.env              # 認証情報
        └── splunk-myenv-storage.json     # 生成された Storage State
```
