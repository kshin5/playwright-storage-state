# Playwright Storage State 生成ツール（Splunk 向け）

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

[English README](README.md)

[Playwright MCP](https://github.com/microsoft/playwright/tree/main/packages/playwright-mcp) で Splunk にアクセスする際、事前にログイン済みのセッション（Storage State）を生成するためのツールです。認証情報を MCP の引数やログに載せずに、Storage State ファイルだけを渡して利用できます。

## 前提条件

- [Node.js](https://nodejs.org/) 18 以上（LTS 推奨）

## インストール

```bash
git clone https://github.com/kshin5/playwright-storage-state.git
cd playwright-storage-state
npm install
npx playwright install --with-deps chromium
```

## セットアップ

同梱のテンプレートをコピーし、認証情報を記入してください（[Playwright の認証ガイド](https://playwright.dev/docs/auth#core-concepts)のディレクトリ構成を参考にしています）。

```bash
cp playwright/.auth/splunk-myenv.env.example playwright/.auth/splunk-myenv.env
# .env ファイルを編集して認証情報を記入
```

`.env` ファイルの内容:

```ini
SPLUNK_URL=https://your-splunk-server:8000
SPLUNK_USER=your-username
SPLUNK_PASS='your-password'
```

> **注意:** パスワードに `#` や `$` などの特殊文字が含まれる場合、シングルクォート (`'...'`) で囲んでください。クォートなしの場合、`#` 以降がコメントとして無視され、ログインに失敗します。

## セキュリティ上の注意

- `.env` ファイルには **パスワードが平文** で保存されます。他のユーザーからアクセスできないよう権限を設定してください。
- `playwright/.auth/` 内の認証ファイルは `.gitignore` で除外済みです。Git で管理されるのは `.env.example` テンプレートのみです。
- 生成された Storage State ファイル（JSON）も認証情報に相当します。スクリプトは保存後に自動でファイル権限を制限します（Windows ではアクセス権限を手動で確認してください）。

## 使用方法

プロジェクトディレクトリ内で実行します。

```bash
node generate-storage-state.js <env-file> [output-path]
```

例:

```bash
node generate-storage-state.js playwright/.auth/splunk-myenv.env
```

> **Windows ユーザー向け:** パス区切りは `/` と `\` のどちらでも動作します。

- `output-path` を省略すると、`.env` を `-storage.json` に置換して自動生成されます（例: `splunk-myenv.env` → `splunk-myenv-storage.json`）。
- 出力先を明示的に指定することもできます:
  ```bash
  node generate-storage-state.js playwright/.auth/splunk-myenv.env playwright/.auth/custom-output.json
  ```
- 出力先のディレクトリが存在しない場合は自動作成されます。

### 複数の Splunk 環境を管理する

環境ごとに `.env` ファイルを作成します:

```bash
# 開発環境
node generate-storage-state.js playwright/.auth/splunk-dev.env

# 本番環境
node generate-storage-state.js playwright/.auth/splunk-prod.env
```

```
playwright/.auth/
├── splunk-dev.env               # 開発環境の認証情報
├── splunk-dev-storage.json      # 開発環境のセッション
├── splunk-prod.env              # 本番環境の認証情報
└── splunk-prod-storage.json     # 本番環境のセッション
```

MCP 設定も環境ごとに登録すれば、複数の Splunk に接続できます。

## Playwright MCP での使用

生成した Storage State ファイルを Playwright MCP サーバーの `--storage-state` オプションに**絶対パス**で渡します:

```
@playwright/mcp ... --storage-state /absolute/path/to/splunk-myenv-storage.json
```

> `--storage-state` には **絶対パス** を指定してください。`~` や相対パスは MCP 起動時に正しく解決されない場合があります。

<details>
<summary>例: Cursor IDE での設定</summary>

まず、Storage State ファイルの絶対パスを確認します:

```bash
# プロジェクトディレクトリで実行
cd playwright-storage-state
echo "$(pwd)/playwright/.auth/splunk-myenv-storage.json"
```

`~/.cursor/mcp.json`（Windows: `%USERPROFILE%\.cursor\mcp.json`）に以下を追加します。`mcpServers` オブジェクトの中に記述し、`--storage-state` の値を上記で確認したパスに置き換えてください:

```json
{
  "mcpServers": {
    "playwright-myenv": {
      "command": "npx",
      "args": [
        "-y", "@playwright/mcp@latest",
        "--headless",
        "--ignore-https-errors",
        "--isolated",
        "--storage-state", "/your/absolute/path/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json"
      ]
    }
  }
}
```

> **Windows の場合:** `--storage-state` のパスは `/` でも `\\` でも動作します（例: `"C:/Users/..."` または `"C:\\Users\\..."`）。

</details>

## セッション期限切れ時の再生成

Splunk のセッションは一定時間で切れます。認証エラーが発生したら、同じコマンドで Storage State を再生成してください。

## 制限事項

- 本ツールは Splunk の **デフォルトログインページ**（ユーザー名/パスワードのフォーム）を前提としています。SSO、SAML、カスタムログインページには対応していません。
- タイムアウト値はスクリプト内で固定です（初回ページ読み込み 30 秒、ログイン後のリダイレクト待ち 10 秒）。遅いネットワークではスクリプト内の値を調整してください。

## トラブルシューティング

### Splunk サーバーに接続できない

- `SPLUNK_URL` が正しいか、スキーム（`https://`）を含むか確認してください。
- サーバーが起動しているか、ファイアウォールやネットワークでポートが開いているか確認してください。
- 自己署名証明書の環境では、Playwright MCP の起動引数に `--ignore-https-errors` を付けます（上記設定例に含まれています）。

### ログインに失敗する

- `SPLUNK_USER` と `SPLUNK_PASS` が正しいか確認してください。
- スクリプトがログイン後の URL（`**/app/**`）への遷移を待ちます。タイムアウトする場合は、認証エラーや多要素認証（MFA）の可能性があります。出力されるエラーメッセージを確認してください。

### 証明書エラー（ERR_CERT_AUTHORITY_INVALID 等）

- 本ツールは `ignoreHTTPSErrors: true` で Splunk にアクセスするため、スクリプト単体では証明書エラーで止まりません。
- MCP 利用時に証明書エラーが出る場合は、`--ignore-https-errors` を起動引数に追加してください（上記設定例に含まれています）。

### ログインやページ読み込みでタイムアウトする

- スクリプト内のタイムアウトは固定です（ページ読み込み 30 秒、ログイン後 10 秒）。遅いネットワークではスクリプト内の `timeout` 値を調整してください。

## ファイル構成

```
playwright-storage-state/
├── generate-storage-state.js   # メインスクリプト
├── package.json                # 依存関係
├── package-lock.json           # バージョン固定
├── .gitignore                  # 認証ファイルと node_modules/ を除外
├── README.md                   # 英語版 README
├── README.ja.md                # このファイル（日本語版）
└── playwright/
    └── .auth/
        ├── splunk-myenv.env.example      # テンプレート（Git 管理）
        ├── splunk-myenv.env              # 認証情報（Git 除外）
        └── splunk-myenv-storage.json     # 生成された Storage State（Git 除外）
```

## ライセンス

Apache License 2.0 - 詳細は [LICENSE](LICENSE) を参照してください。
