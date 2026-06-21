import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import http from 'http';

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Server start timeout'));
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  });
}

(async () => {
  console.log('devサーバーを起動しています...');
  const server = spawn('npm.cmd', ['run', 'dev'], { stdio: 'pipe', shell: true });
  
  try {
    await waitForServer('http://localhost:5173');
    console.log('devサーバーの起動を確認しました。テストを開始します。');

    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage();
    
    const results = [];
    
    const runTest = async (name, testFn) => {
      console.log(`\n--- テスト開始: ${name} ---`);
      try {
        await page.goto('http://localhost:5173');
        await page.waitForSelector('text=住宅ローン シミュレーション (ペアローン対応)');
        // リセットボタンがあれば押す
        const resets = await page.locator('button:has-text("リセット")').all();
        for (const reset of resets) {
          if (await reset.isVisible()) await reset.click();
        }
        await page.waitForTimeout(500);

        await testFn();
        results.push({ name, status: 'OK' });
        console.log(`[OK] ${name}`);
      } catch (err) {
        console.error(`[NG] ${name}`, err.message);
        results.push({ name, status: 'NG', error: err.message });
      }
    };

    // 1. シングル/ペアローン 現実的数値
    await runTest('1. シングル/ペアローン 現実的数値の挙動', async () => {
      // 夫: 3500万, 35年, 金利0.5%
      await page.locator('input[name="husband.principal"]').fill('3500');
      await page.locator('input[name="husband.termYears"]').fill('35');
      await page.locator('input[name="husband.initialRate"]').fill('0.5');
      
      // 妻: 2000万, 35年, 金利0.5%
      await page.locator('input[name="wife.principal"]').fill('2000');
      await page.locator('input[name="wife.termYears"]').fill('35');
      await page.locator('input[name="wife.initialRate"]').fill('0.5');
      
      await page.locator('button:has-text("この条件で再計算する")').click();
      await page.waitForTimeout(1000);
      
      // テーブルとグラフの確認
      const tableRows = await page.locator('tbody tr').count();
      if (tableRows === 0) throw new Error('テーブルが表示されていません');
      
      const chartExists = await page.locator('.recharts-wrapper').count();
      if (chartExists === 0) throw new Error('グラフが描画されていません');
    });

    // 2. 途中で金利が上昇するケース
    await runTest('2. 途中で金利が上昇するケース', async () => {
      await page.locator('button:has-text("金利変動シナリオを追加")').first().click();
      await page.locator('input[name="husband.scenarios.0.changeMonth"]').fill('61');
      await page.locator('input[name="husband.scenarios.0.newRate"]').fill('4.0'); // 急上昇
      await page.locator('button:has-text("この条件で再計算する")').click();
      await page.waitForTimeout(1000);
      
      await page.locator('button:has-text("夫のみ")').click();
      await page.waitForTimeout(500);
      
      const tableContent = await page.locator('tbody').first().textContent();
      if (!tableContent.includes('4.000%')) {
        throw new Error('金利上昇がテーブルに反映されていません');
      }
    });

    // 3. 極端な繰り上げ返済（増額固定）
    await runTest('3. 極端な繰り上げ返済（増額固定）', async () => {
      await page.locator('input[name="husband.fixedPaymentEnabled"]').check();
      await page.locator('input[name="husband.fixedPaymentAmount"]').fill('300000'); // 30万
      await page.locator('button:has-text("この条件で再計算する")').click();
      await page.waitForTimeout(1000);
      
      await page.locator('button:has-text("夫のみ")').click();
      await page.waitForTimeout(500);
      
      const lastRowText = await page.locator('tbody tr').last().innerText();
      if (lastRowText.includes('30年目')) {
        throw new Error('極端な繰り上げ返済にもかかわらず期間が短縮されていません');
      }
    });

    // 4. 手動入力モード（monthlyPayment 指定）
    await runTest('4. ユーザー金額指定（monthlyPayment 指定）', async () => {
      // 一旦固定モード解除
      if (await page.locator('input[name="husband.fixedPaymentEnabled"]').isChecked()) {
        await page.locator('input[name="husband.fixedPaymentEnabled"]').uncheck();
      }
      await page.locator('input[name="husband.monthlyPayment"]').fill('70000'); // 増額
      await page.locator('button:has-text("この条件で再計算する")').click();
      await page.waitForTimeout(1000);
      
      await page.locator('button:has-text("夫のみ")').click();
      await page.waitForTimeout(1000); // 描画を待つ
      
      const tableRowsText = await page.locator('tbody tr').first().textContent();
      if (!tableRowsText.includes('70,000') && !tableRowsText.includes('70000')) {
         throw new Error(`月々の支払額が反映されていません。先頭行の内容: ${tableRowsText}`);
      }
    });

    // 5. わざと未払利息が発生するような数値入力（極端な低月額返済）
    await runTest('5. 未払利息の発生確認（低月額返済）', async () => {
      await page.locator('input[name="husband.principal"]').fill('3000'); // 3000万
      await page.locator('input[name="husband.monthlyPayment"]').fill('10000'); // 1万円（利息すら払えない）
      await page.locator('button:has-text("この条件で再計算する")').click();
      await page.waitForTimeout(1000);
      
      await page.locator('button:has-text("夫のみ")').click();
      await page.waitForTimeout(500);
      
      const warningVisible = await page.locator('text=未払利息').first().isVisible();
      if (!warningVisible) {
        throw new Error('未払利息の警告が表示されていません');
      }
    });

    // 6. 支払最終年で一括精算分がある場合と無い場合
    await runTest('6. 最終月の一括清算', async () => {
      // 一括精算が発生する状況＝未払利息が残っている、または残高が払い切れない
      await page.locator('input[name="husband.principal"]').fill('3000');
      await page.locator('input[name="husband.initialRate"]').fill('5.0'); // 高金利
      await page.locator('input[name="husband.monthlyPayment"]').fill('30000'); // 少額返済
      await page.locator('button:has-text("この条件で再計算する")').click();
      await page.waitForTimeout(1000);
      
      const lumpSumWarning = await page.locator('text=一括返済が必要').first().isVisible();
      if (!lumpSumWarning) {
        throw new Error('一括返済の警告が表示されていません');
      }
    });

    // 7. 基本UI表示 (シミュレーターとして適切か)
    await runTest('7. 全体UI検証', async () => {
      const formVisible = await page.locator('form').first().isVisible();
      const tableVisible = await page.locator('table').first().isVisible();
      const summaryVisible = await page.locator('text=合算（概算）').first().isVisible();
      
      if (!formVisible || !tableVisible || !summaryVisible) {
        throw new Error('シミュレーターの基本的なUIコンポーネントが不足しています');
      }
    });

    await browser.close();

    console.log('\n=== テスト結果サマリー ===');
    let allOk = true;
    results.forEach(r => {
      console.log(`[${r.status}] ${r.name}`);
      if (r.status === 'NG') allOk = false;
      if (r.error) console.log(`      -> ${r.error}`);
    });
    
    if (allOk) {
       console.log('\nすべてのテストが成功しました。');
    }

  } catch (err) {
    console.error('致命的なエラー:', err);
  } finally {
    console.log('devサーバーを終了します...');
    server.kill();
    process.exit(0);
  }
})();
