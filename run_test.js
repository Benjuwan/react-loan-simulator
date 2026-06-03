import { chromium } from 'playwright-core';

(async () => {
  console.log("テスト開始...");
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('text=住宅ローン シミュレーション (ペアローン対応)');

    console.log("【P0】デフォルト値での計算確認");
    // テーブルの先頭行の適用期間と金額を確認
    const firstRowPeriod = await page.locator('tbody tr').first().locator('td').first().innerText();
    const firstRowAmount = await page.locator('tbody tr').first().locator('td').nth(1).innerText();
    console.log(`初期状態の合算: ${firstRowPeriod.replace(/\n/g, ' ')} -> ${firstRowAmount}`);
    
    // 夫・妻タブが機能するか
    await page.locator('button:has-text("夫のみ")').click();
    await page.waitForTimeout(500);
    const husbandAmount = await page.locator('tbody tr').first().locator('td').nth(1).innerText();
    console.log(`夫のみタブの支払額: ${husbandAmount}`);

    await page.locator('button:has-text("妻のみ")').click();
    await page.waitForTimeout(500);
    const wifeAmount = await page.locator('tbody tr').first().locator('td').nth(1).innerText();
    console.log(`妻のみタブの支払額: ${wifeAmount}`);

    console.log("\n【P1】支払額調整によるシミュレーション（繰り上げ返済効果）");
    await page.locator('button:has-text("世帯合算")').click();
    
    // 夫の月々の支払額を 55595 -> 60000 に変更
    await page.locator('input[name="husband.monthlyPayment"]').fill('60000');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(1000);
    
    // 最終行（完済タイミング）を取得するために夫のみタブに切り替え
    await page.locator('button:has-text("夫のみ")').click();
    await page.waitForTimeout(500);
    const lastRowPeriod = await page.locator('tbody tr').last().locator('td').first().innerText();
    console.log(`増額後の夫の完済時期（夫のみテーブルの最終行）: ${lastRowPeriod.replace(/\n/g, ' ')}`);

    console.log("\n【P2】UIインタラクション（異常系・バリデーションエラー）");
    // 夫の借入額をマイナスにする
    await page.locator('input[name="husband.principal"]').fill('-100');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(500);
    
    const errorMsg = await page.locator('text=0以上を指定してください').first().innerText();
    console.log(`エラーメッセージ表示確認: ${errorMsg}`);

  } catch (err) {
    console.error("テスト失敗:", err);
  } finally {
    await browser.close();
    console.log("テスト終了。");
  }
})();
