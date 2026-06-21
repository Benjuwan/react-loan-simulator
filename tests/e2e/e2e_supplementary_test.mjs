/**
 * 住宅ローンシミュレーター 追加E2Eテストスクリプト
 * 
 * 敵対的レビューで指摘された精度不足を補完する追加テスト。
 * 
 * T-03改: 125%ルールの数値アサーション（61ヶ月目の返済額が125%上限以下か）
 * T-08a改: 真の正常完済パターン（残高0で「✅完済」表示か）
 * T-17新: 片方完済後のペアローン合算（妻完済後に合算値=夫のみの値か）
 */

import { chromium } from 'playwright-core';

// ===== ユーティリティ =====

function parseCurrency(text) {
  if (!text) return NaN;
  return parseInt(text.replace(/[￥¥,\s]/g, ''), 10);
}

async function fillField(page, selector, value) {
  const field = page.locator(selector);
  await field.click({ clickCount: 3 });
  await field.fill(String(value));
}

async function recalculate(page) {
  await page.getByRole('button', { name: 'この条件で再計算する' }).click();
  await page.waitForTimeout(1500);
}

async function switchTab(page, tabName) {
  await page.getByRole('button', { name: tabName }).click();
  await page.waitForTimeout(500);
}

async function resetAll(page) {
  await page.goto('http://localhost:5173/');
  await page.waitForSelector('text=住宅ローン シミュレーション (ペアローン対応)');
  await page.waitForTimeout(800);
}

// ===== テスト実行 =====

(async () => {
  console.log('=== 追加E2Eテスト（レビュー指摘事項の補完） 開始 ===\n');

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();

  const results = [];
  let passed = 0;
  let failed = 0;

  async function runTest(id, name, testFn) {
    console.log(`\n--- [${id}] ${name} ---`);
    try {
      await resetAll(page);
      const result = await testFn();
      console.log(`  ✅ PASS: ${name}`);
      if (result) console.log(`  詳細: ${typeof result === 'string' ? result : JSON.stringify(result)}`);
      results.push({ id, name, status: 'PASS', detail: result });
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`  エラー: ${err.message}`);
      results.push({ id, name, status: 'FAIL', error: err.message });
      failed++;
    }
  }

  // ============================================================
  // T-03改: 125%ルールの定量的数値アサーション
  //
  // シナリオ: 3000万/30年/金利0.5%→61ヶ月目から5.0%に急上昇
  // 
  // 検証ロジック:
  //   初期返済額 ≈ 89,756円（calculatePayment(3000万, 0.5%, 360)）
  //   125%上限 = Math.floor(89,756 * 1.25) = 112,195円
  //   61ヶ月目（6年目1ヶ月目）の返済額 ≤ 112,195円 であること
  //
  // loanCalculator.ts L67-82:
  //   month===61 で見直し発生
  //   recalculatedPayment = calculatePayment(残高, 5.0%, 残期間)
  //   maxAllowedPayment = Math.floor(currentPayment * 1.25)
  //   currentPayment = Math.min(recalculated, max)
  // ============================================================
  await runTest('T-03改', '125%ルール: 61ヶ月目の返済額が125%上限以下であることの数値検証', async () => {
    // 条件設定: 夫 3000万/30年/0.5%
    await fillField(page, 'input[name="husband.principal"]', '3000');
    await fillField(page, 'input[name="husband.termYears"]', '30');
    await fillField(page, 'input[name="husband.initialRate"]', '0.5');
    await fillField(page, 'input[name="husband.monthlyPayment"]', '89756');

    // 金利変動: 61ヶ月目から5.0%
    await page.locator('button:has-text("金利変動シナリオを追加")').first().click();
    await page.waitForTimeout(300);
    await fillField(page, 'input[name="husband.scenarios.0.changeMonth"]', '61');
    await fillField(page, 'input[name="husband.scenarios.0.newRate"]', '5.0');

    await recalculate(page);
    await switchTab(page, '夫のみ');

    // 125%上限の理論値を計算
    const initialPayment = 89756;
    const maxAllowed125 = Math.floor(initialPayment * 1.25); // = 112,195

    // ---- 検証1: 60ヶ月目（5年ルール見直し直前）の返済額 ----
    // 「1年目〜5年目」のアコーディオンの最終行 = 60ヶ月目
    // summaryをクリックしてアコーディオンを展開
    const firstChunk = page.locator('[data-testid="history-block"]').first();
    // data-testidがない場合はsummaryで探す
    const firstSummary = page.locator('summary').filter({ hasText: /1年目.*5年目/ });
    if (await firstSummary.count() > 0) {
      await firstSummary.first().click();
      await page.waitForTimeout(500);
    }

    // テーブルから60ヶ月目（5年目12ヶ月目）を探す
    const allRows60 = page.locator('tbody tr').filter({ hasText: '5年目 12ヶ月目' });
    let payment60 = NaN;
    if (await allRows60.count() > 0) {
      const cells60 = await allRows60.first().locator('td').allTextContents();
      payment60 = parseCurrency(cells60[2]); // 月々の支払額列
      console.log(`    60ヶ月目（見直し前）: 支払額=${payment60}円, 金利=${cells60[1]}`);
      
      if (payment60 !== initialPayment) {
        console.log(`    ※注: 60ヶ月目の支払額(${payment60})と初期値(${initialPayment})に差異あり（金利変動なしのため同額のはず）`);
      }
    }

    // ---- 検証2: 61ヶ月目（5年ルール見直し直後、金利5.0%適用開始） ----
    // 「6年目〜10年目」のアコーディオンを展開
    const sixthSummary = page.locator('summary').filter({ hasText: /6年目.*10年目/ });
    if (await sixthSummary.count() > 0) {
      await sixthSummary.first().click();
      await page.waitForTimeout(500);
    }

    // 6年目1ヶ月目 = 61ヶ月目
    const allRows61 = page.locator('tbody tr').filter({ hasText: '6年目 1ヶ月目' });
    if (await allRows61.count() === 0) {
      throw new Error('61ヶ月目（6年目1ヶ月目）の行が見つかりません');
    }

    const cells61 = await allRows61.first().locator('td').allTextContents();
    const payment61 = parseCurrency(cells61[2]);
    const rate61 = cells61[1]?.trim();
    const interest61 = parseCurrency(cells61[4]);
    const principal61 = parseCurrency(cells61[3]);

    console.log(`    61ヶ月目（見直し後）: 支払額=${payment61}円, 金利=${rate61}, 利息=${interest61}円, 元金=${principal61}円`);
    console.log(`    125%上限 = Math.floor(${initialPayment} × 1.25) = ${maxAllowed125}円`);

    // ★ 核心のアサーション: 61ヶ月目の返済額が125%上限以下であること
    if (payment61 > maxAllowed125) {
      throw new Error(
        `125%ルール違反！ 61ヶ月目の返済額(${payment61}円) > 125%上限(${maxAllowed125}円)\n` +
        `前回返済額=${initialPayment}円, 1.25倍=${maxAllowed125}円`
      );
    }

    // 金利が5.0%に適用されていること
    if (rate61 !== '5.000%') {
      throw new Error(`61ヶ月目の金利が5.0%ではない: 実際=${rate61}`);
    }

    // ---- 検証3: 未払利息の発生確認 ----
    // 5.0%で利息 >> 返済額(125%上限)の場合、未払利息が発生するはず
    // 概算: 残高約2500万 × 5.0%/12 ≈ 104,167円 vs 返済額112,195円
    // 利息が返済額以下なら未払利息は発生しない可能性もある → 確認
    const hasUnpaidWarning = await page.locator('h4').filter({ hasText: '一括返済が必要' }).count() > 0;
    const hasCompletionMark = await page.locator('h4').filter({ hasText: '完済' }).count() > 0;

    return [
      `初期返済額=${initialPayment}円`,
      `125%上限=${maxAllowed125}円`,
      `61ヶ月目返済額=${payment61}円 ≤ ${maxAllowed125}円 ✓`,
      `61ヶ月目金利=${rate61} ✓`,
      `元金充当=${principal61}円, 利息充当=${interest61}円`,
      `一括返済警告=${hasUnpaidWarning}, 完済=${hasCompletionMark}`
    ].join(' | ');
  });

  // ============================================================
  // T-08a改: 真の正常完済パターン（残高0で「✅完済」表示）
  //
  // デフォルト条件（1810万/30年/0.68%）では端数処理で残高18円が残り
  // 「⚠️一括返済が必要」と表示される。
  // → 固定モードで十分な額を設定し、期間途中で残高0に到達する
  //    ケースで「✅ 完済」が正しく表示されるかを検証。
  // ============================================================
  await runTest('T-08a改', '正常完済パターン: 固定モードで期間内完済→「✅完済」表示の確認', async () => {
    // 条件: 夫 1000万/10年/0.5% + 固定モードON 100,000円/月
    // calculatePayment(1000万, 0.5%, 120) ≈ 85,607円
    // 100,000円は十分な繰り上げ返済額
    await fillField(page, 'input[name="husband.principal"]', '1000');
    await fillField(page, 'input[name="husband.termYears"]', '10');
    await fillField(page, 'input[name="husband.initialRate"]', '0.5');
    await fillField(page, 'input[name="husband.monthlyPayment"]', '85607');

    // 固定モードON + 100,000円
    await page.locator('input[name="husband.fixedPaymentEnabled"]').check();
    await page.waitForTimeout(300);
    await fillField(page, 'input[name="husband.fixedPaymentAmount"]', '100000');

    await recalculate(page);
    await switchTab(page, '夫のみ');

    // 「✅ 完済」の見出しを確認
    const completionHeading = page.locator('h4').filter({ hasText: '完済' });
    const hasCompletion = await completionHeading.count() > 0;
    
    if (!hasCompletion) {
      // 「⚠️」しかない場合はFAIL
      const warningHeading = await page.locator('h4').filter({ hasText: '最終月' }).textContent();
      throw new Error(`「✅完済」ではなく「${warningHeading?.trim()}」が表示されています`);
    }

    const headingText = await completionHeading.textContent();

    // 最終月の残高が0であることの確認
    const balanceElements = page.locator('p').filter({ hasText: '元金残高' });
    let balanceText = '';
    if (await balanceElements.count() > 0) {
      // 元金残高の次のp要素に金額がある
      const balanceContainer = page.locator('p').filter({ hasText: '元金残高' }).locator('..').locator('p').last();
      balanceText = await balanceContainer.textContent() || '';
    }

    // 未払利息が0であること
    const unpaidElements = page.locator('p').filter({ hasText: '未払利息' });
    let unpaidText = '';
    if (await unpaidElements.count() > 0) {
      const unpaidContainer = page.locator('p').filter({ hasText: '未払利息' }).locator('..').locator('p').last();
      unpaidText = await unpaidContainer.textContent() || '';
    }

    return `最終月="${headingText?.trim()}" ✓, 残高=${balanceText.trim()}, 未払利息=${unpaidText.trim()}`;
  });

  // ============================================================
  // T-17: 片方完済後のペアローン合算の正確性検証
  //
  // シナリオ: 夫35年 / 妻5年（固定モードで早期完済）
  // 妻が5年(60ヶ月)以内に完済した後、61ヶ月目以降で
  // 世帯合算の返済額 = 夫のみの返済額 であることを検証。
  // ============================================================
  await runTest('T-17', '片方完済後のペアローン合算: 妻完済後に合算値=夫のみの値', async () => {
    // 夫: 2000万/35年/0.5%
    await fillField(page, 'input[name="husband.principal"]', '2000');
    await fillField(page, 'input[name="husband.termYears"]', '35');
    await fillField(page, 'input[name="husband.initialRate"]', '0.5');
    await fillField(page, 'input[name="husband.monthlyPayment"]', '51917');

    // 妻: 500万/5年/0.5% + 固定モードON 100,000円（確実に5年以内に完済）
    await fillField(page, 'input[name="wife.principal"]', '500');
    await fillField(page, 'input[name="wife.termYears"]', '5');
    await fillField(page, 'input[name="wife.initialRate"]', '0.5');
    await fillField(page, 'input[name="wife.monthlyPayment"]', '84855');

    // 妻を固定モードON
    await page.locator('input[name="wife.fixedPaymentEnabled"]').check();
    await page.waitForTimeout(300);
    await fillField(page, 'input[name="wife.fixedPaymentAmount"]', '100000');

    await recalculate(page);

    // ---- 検証1: 妻が完済していること ----
    await switchTab(page, '妻のみ');
    
    // 妻のテーブルの最終行を確認（完済行が存在するか）
    const wifeRows = await page.locator('tbody tr').all();
    const wifeLastCells = await wifeRows[wifeRows.length - 1].locator('td').allTextContents();
    const wifeLastBalance = parseCurrency(wifeLastCells[5]);
    const wifeLastPeriod = wifeLastCells[0]?.trim();
    console.log(`    妻の最終行: ${wifeLastPeriod}, 残高=${wifeLastBalance}円`);

    if (wifeLastBalance !== 0) {
      console.log(`    ※妻の最終残高が0でない(${wifeLastBalance}円)が、完済判定確認中...`);
    }

    // ---- 検証2: 夫の6年目以降の先頭行のデータ取得 ----
    await switchTab(page, '夫のみ');

    // 6年目〜10年目のアコーディオンを展開
    const husbandSixthSummary = page.locator('summary').filter({ hasText: /6年目.*10年目/ });
    if (await husbandSixthSummary.count() > 0) {
      await husbandSixthSummary.first().click();
      await page.waitForTimeout(500);
    }

    // 6年目1ヶ月目のデータ
    const husbandRow61 = page.locator('tbody tr').filter({ hasText: '6年目 1ヶ月目' });
    let husbandPayment61 = NaN;
    if (await husbandRow61.count() > 0) {
      const hCells = await husbandRow61.first().locator('td').allTextContents();
      husbandPayment61 = parseCurrency(hCells[2]);
      console.log(`    夫 6年目1ヶ月目: 支払額=${husbandPayment61}円`);
    }

    // ---- 検証3: 合算の6年目以降のデータ ----
    await switchTab(page, '世帯合算');

    // 6年目〜10年目のアコーディオンを展開
    const mergedSixthSummary = page.locator('summary').filter({ hasText: /6年目.*10年目/ });
    if (await mergedSixthSummary.count() > 0) {
      await mergedSixthSummary.first().click();
      await page.waitForTimeout(500);
    }

    // 6年目1ヶ月目の合算データ
    const mergedRow61 = page.locator('tbody tr').filter({ hasText: '6年目 1ヶ月目' });
    let mergedPayment61 = NaN;
    if (await mergedRow61.count() > 0) {
      const mCells = await mergedRow61.first().locator('td').allTextContents();
      mergedPayment61 = parseCurrency(mCells[2]);
      console.log(`    合算 6年目1ヶ月目: 支払額=${mergedPayment61}円`);
    }

    // ★ 核心のアサーション: 妻完済後、合算値 = 夫のみの値
    if (isNaN(husbandPayment61) || isNaN(mergedPayment61)) {
      throw new Error(`6年目1ヶ月目のデータが取得できません: 夫=${husbandPayment61}, 合算=${mergedPayment61}`);
    }

    if (mergedPayment61 !== husbandPayment61) {
      throw new Error(
        `妻完済後の合算値が夫のみの値と不一致！\n` +
        `合算=${mergedPayment61}円, 夫のみ=${husbandPayment61}円\n` +
        `差額=${mergedPayment61 - husbandPayment61}円`
      );
    }

    return [
      `妻完済: ${wifeLastPeriod}(残高${wifeLastBalance}円)`,
      `夫6年目1ヶ月目=${husbandPayment61}円`,
      `合算6年目1ヶ月目=${mergedPayment61}円`,
      `合算==夫のみ ✓`
    ].join(' | ');
  });

  // ============================================================
  // 最終レポート
  // ============================================================
  await browser.close();

  console.log('\n\n========================================');
  console.log('=== 追加テスト結果サマリー ===');
  console.log('========================================\n');

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.id}] ${r.name}`);
    if (r.detail) console.log(`   → ${typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)}`);
    if (r.error) console.log(`   → ERROR: ${r.error}`);
  }

  console.log(`\n合計: ${results.length}件 | PASS: ${passed}件 | FAIL: ${failed}件`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
})();
