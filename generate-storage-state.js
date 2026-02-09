'use strict';

const { chromium } = require('playwright');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

/**
 * ホームディレクトリを取得する（Windows / Linux / macOS / WSL2 対応）
 * @returns {string} ホームディレクトリのパス
 */
function getHomeDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    console.error('Error: HOME (or USERPROFILE on Windows) environment variable is not set.');
    process.exit(1);
  }
  return home;
}

/**
 * パス先頭の ~ のみをホームディレクトリに展開する（パス内の ~ は置換しない）
 * @param {string} filePath - 入力パス
 * @returns {string} 展開後のパス
 */
function expandTilde(filePath) {
  if (filePath === '~' || filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return getHomeDir() + filePath.slice(1);
  }
  return filePath;
}

/**
 * Splunk にログインして Storage State を生成する
 */
async function generateStorageState() {
  const envFile = process.argv[2];
  const outputPath = process.argv[3];

  if (!envFile || !outputPath) {
    console.error('Usage: node generate-storage-state.js <env-file> <output-path>');
    console.error('Example: node generate-storage-state.js playwright/.auth/splunk-myenv.env playwright/.auth/splunk-myenv-storage.json');
    process.exit(1);
  }

  const envPath = path.resolve(expandTilde(envFile));
  if (!fs.existsSync(envPath)) {
    console.error(`Error: Env file not found: ${envPath}`);
    process.exit(1);
  }

  dotenv.config({ path: envPath });
  console.log(`Loaded env from: ${envPath}`);

  const splunkUrl = process.env.SPLUNK_URL;
  const username = process.env.SPLUNK_USER;
  const password = process.env.SPLUNK_PASS;

  if (!splunkUrl || !username || !password) {
    console.error('Missing required environment variables in env file:');
    console.error('  SPLUNK_URL, SPLUNK_USER, SPLUNK_PASS');
    process.exit(1);
  }

  const resolvedOutputPath = path.resolve(expandTilde(outputPath));
  const outputDir = path.dirname(resolvedOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    console.log(`Logging in to: ${splunkUrl}`);
    try {
      await page.goto(splunkUrl, { timeout: 30000 });
    } catch (err) {
      console.error('Splunk サーバーに接続できません。URL とサーバーの状態を確認してください。');
      console.error(err.message);
      throw err;
    }

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('input[type="submit"]');

    try {
      await page.waitForURL('**/app/**', { timeout: 10000 });
    } catch (err) {
      const errorSelectors = [
        '.error-message',
        '.login-error',
        '[class*="error"]',
        '.alert-error',
        '#error-message'
      ];
      let errorText = null;
      for (const selector of errorSelectors) {
        const el = await page.$(selector);
        if (el) {
          const text = await el.textContent();
          if (text && text.trim()) {
            errorText = text.trim();
            break;
          }
        }
      }
      console.error('ログインに失敗しました。');
      if (errorText) {
        console.error(`画面のエラー: ${errorText}`);
      } else {
        console.error('認証情報（SPLUNK_USER / SPLUNK_PASS）が正しいか確認してください。');
      }
      throw new Error('Login failed');
    }

    await context.storageState({ path: resolvedOutputPath });
    if (process.platform !== 'win32') {
      fs.chmodSync(resolvedOutputPath, 0o600);
    } else {
      console.log('Note: Windows ではファイルのアクセス権限を手動で確認してください。');
    }
    console.log(`Storage state saved to: ${resolvedOutputPath}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

generateStorageState().catch((err) => {
  console.error(err);
  process.exit(1);
});
