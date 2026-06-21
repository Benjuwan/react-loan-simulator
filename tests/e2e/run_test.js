import { chromium } from 'playwright-core';

(async () => {
  console.log('テスト開始...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();

  const take = async (name) => {
    const path = `./tmp/${name.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(`スクリーンショットを保存: ${path}`);
  };

  try {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('text=住宅ローン シミュレーション (ペアローン対応)');

    console.log('【A-1】デフォルト値のまま再計算');
    const defaultPeriod = (await page.locator('tbody tr').first().locator('td').first().textContent())?.trim() ?? '';
    const defaultAmount = (await page.locator('tbody tr').first().locator('td').nth(2).textContent())?.trim() ?? '';
    console.log(`初期合算: ${defaultPeriod} -> ${defaultAmount}`);
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(800);
    const defaultPeriodAfter = (await page.locator('tbody tr').first().locator('td').first().textContent())?.trim() ?? '';
    const defaultAmountAfter = (await page.locator('tbody tr').first().locator('td').nth(2).textContent())?.trim() ?? '';
    console.log(`再計算後: ${defaultPeriodAfter} -> ${defaultAmountAfter}`);

    console.log('【A-1 結果】', defaultPeriod === defaultPeriodAfter && defaultAmount === defaultAmountAfter ? 'OK' : 'NG');

    console.log('【A-2/A-3】月々の支払額を変更して再計算');
    await page.locator('input[name="husband.monthlyPayment"]').fill('60000');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("夫のみ")').click();
    await page.waitForTimeout(500);
    const lastRowAfterIncrease = (await page.locator('tbody tr').last().locator('td').first().textContent())?.trim() ?? '';
    console.log(`増額後の夫の完済時期: ${lastRowAfterIncrease}`);
    const isShortened = !lastRowAfterIncrease.includes('30年目');
    console.log('完済期間短縮:', isShortened ? 'OK' : 'NG');

    await page.locator('button:has-text("世帯合算")').click();
    await page.waitForTimeout(500);
    await page.locator('input[name="husband.monthlyPayment"]').fill('30000');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(1000);
    const lowPaymentRow = (await page.locator('tbody tr').first().locator('td').nth(2).textContent())?.trim() ?? '';
    console.log(`減額後の世帯合算先頭行支払額: ${lowPaymentRow}`);

    console.log('【A-4】固定モード有効時の挙動');
    await page.locator('input[name="husband.fixedPaymentEnabled"]').check();
    await page.locator('input[name="husband.fixedPaymentAmount"]').fill('70000');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(1000);
    const fixedAmountValue = await page.locator('input[name="husband.fixedPaymentAmount"]').inputValue();
    console.log(`固定額入力値: ${fixedAmountValue}`);
    await page.locator('button:has-text("夫のみ")').click();
    await page.waitForTimeout(500);
    const fixedLastRow = (await page.locator('tbody tr').last().locator('td').first().textContent())?.trim() ?? '';
    console.log(`固定モード後の夫の完済時期: ${fixedLastRow}`);

    console.log('【A-5】固定モード OFF→ON→OFF');
    await page.locator('button:has-text("世帯合算")').click();
    await page.waitForTimeout(200);
    await page.locator('input[name="husband.fixedPaymentEnabled"]').uncheck();
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(800);
    const afterDisableAmount = await page.locator('input[name="husband.monthlyPayment"]').inputValue();
    console.log(`固定OFF後の月々支払額: ${afterDisableAmount}`);

    console.log('【B-1/B-2】借入額変更と支払額非連動');
    await page.locator('input[name="husband.principal"]').fill('3000');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(1000);
    const unpaidWarning = await page.locator('text=未払利息').first().innerText().catch(() => 'なし');
    console.log(`未払利息表示の有無: ${unpaidWarning === 'なし' ? 'なし' : 'あり'}`);
    await page.locator('input[name="husband.monthlyPayment"]').fill('80000');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(1000);
    const recalcAfterPrincipal = (await page.locator('tbody tr').first().locator('td').nth(2).textContent())?.trim() ?? '';
    console.log(`大口借入後に支払額修正後の先頭支払額: ${recalcAfterPrincipal}`);

    console.log('【B-3】UI注釈テキストの確認');
    const annotationText = await page.locator('text=この値は自動更新されません').first().innerText();
    console.log(`注釈テキスト: ${annotationText}`);

    console.log('【C-1/C-2/C-4】固定モードバリデーションと monthlyPayment 0');
    await page.locator('button:has-text("夫のみ")').click();
    await page.waitForTimeout(200);
    await page.locator('input[name="husband.fixedPaymentEnabled"]').check();
    await page.locator('input[name="husband.fixedPaymentAmount"]').fill('');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(500);
    const fixedError = await page.locator('text=固定モードが有効な場合、固定額を入力してください').first().innerText().catch(() => 'なし');
    console.log(`固定モード空入力エラー: ${fixedError}`);

    await page.locator('input[name="husband.fixedPaymentEnabled"]').uncheck();
    await page.locator('input[name="husband.monthlyPayment"]').fill('0');
    await page.locator('button:has-text("この条件で再計算する")').click();
    await page.waitForTimeout(500);
    const monthlyZeroError = await page.locator('text=1円以上を指定してください').first().innerText().catch(() => 'なし');
    console.log(`monthlyPayment 0 のエラー: ${monthlyZeroError}`);

    console.log('【D-1/D-2】夫婦のフォームリセット');
    await page.locator('button:has-text("リセット")').nth(0).click().catch(() => {});
    await page.waitForTimeout(800);
    const husbandPaymentAfterReset = await page.locator('input[name="husband.monthlyPayment"]').inputValue();
    const wifePaymentAfterReset = await page.locator('input[name="wife.monthlyPayment"]').inputValue();
    console.log(`夫リセット後: ${husbandPaymentAfterReset}, 妻影響: ${wifePaymentAfterReset}`);
    await page.locator('button:has-text("妻のみ")').first().click().catch(() => {});
    await page.waitForTimeout(200);
    await page.locator('button:has-text("リセット")').nth(1).click().catch(() => {});
    await page.waitForTimeout(800);
    const wifePaymentAfterReset2 = await page.locator('input[name="wife.monthlyPayment"]').inputValue();
    console.log(`妻リセット後: ${wifePaymentAfterReset2}`);

    console.log('【D-4】ビルド実施');
    await browser.close();
    const { execSync } = await import('node:child_process');
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('ビルド: OK');
    } catch (err) {
      console.error('ビルド: NG', err);
    }
    return;
  } catch (err) {
    console.error('テスト失敗:', err);
  } finally {
    await browser.close();
    console.log('テスト終了。');
  }
})();
