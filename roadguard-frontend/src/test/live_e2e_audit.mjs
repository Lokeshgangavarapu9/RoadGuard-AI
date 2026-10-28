import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function runAudit() {
  console.log('=== ROADGUARD AI LIVE PRODUCTION E2E AUDIT ===');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const errors = [];
  const networkLogs = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  page.on('response', resp => {
    if (resp.url().includes('/api/v1/')) {
      networkLogs.push({ url: resp.url(), status: resp.status() });
    }
  });

  console.log('1. Loading https://roadguard-frontend.vercel.app/ ...');
  await page.goto('https://roadguard-frontend.vercel.app/', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log(`Page Title: "${title}"`);

  async function openDrawerIfNeeded() {
    const isDrawerOpen = await page.evaluate(() => Boolean(document.querySelector('div[role="dialog"][aria-label="Navigation Menu"]')));
    if (!isDrawerOpen) {
      const menuBtn = await page.$('button[aria-label="Open navigation menu"]');
      if (menuBtn) {
        await menuBtn.click();
        await page.waitForTimeout(600);
      }
    }
  }

  async function navigateTo(targetLabel) {
    await openDrawerIfNeeded();
    const clicked = await page.evaluate((label) => {
      const buttons = Array.from(document.querySelectorAll('nav button'));
      const target = buttons.find(b => b.innerText.toLowerCase().includes(label.toLowerCase()));
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, targetLabel);

    await page.waitForTimeout(1000);
    return clicked;
  }

  // 1. Detected Road Issues View
  console.log('\n2. Testing "Detected Road Issues" View...');
  let ok = await navigateTo('Detected Road Issues');
  console.log(`-> Navigation clicked: ${ok}`);
  const issuesText = await page.evaluate(() => document.body.innerText.substring(0, 200).replace(/\n+/g, ' '));
  console.log(`   Content: ${issuesText}`);

  // 2. Journey History & Redressal View
  console.log('\n3. Testing "Journey History" View & Grievance Tabs...');
  ok = await navigateTo('Journey History');
  console.log(`-> Navigation clicked: ${ok}`);
  const historyText = await page.evaluate(() => document.body.innerText.substring(0, 200).replace(/\n+/g, ' '));
  console.log(`   Content: ${historyText}`);

  // Test switching between History tabs
  const tabSwitched = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const redressalTab = buttons.find(b => b.innerText.includes('Official Redressal Pipeline') || b.innerText.includes('Grievance') || b.innerText.includes('Complaints'));
    if (redressalTab) {
      redressalTab.click();
      return redressalTab.innerText.trim();
    }
    return null;
  });
  console.log(`-> Clicked Tab: "${tabSwitched}"`);
  await page.waitForTimeout(1000);
  const complaintTabContent = await page.evaluate(() => document.body.innerText.substring(0, 200).replace(/\n+/g, ' '));
  console.log(`   Grievance Tab Content: ${complaintTabContent}`);

  // 3. Journey Reports View
  console.log('\n4. Testing "Journey Reports" View...');
  ok = await navigateTo('Journey Reports');
  console.log(`-> Navigation clicked: ${ok}`);
  const reportsText = await page.evaluate(() => document.body.innerText.substring(0, 200).replace(/\n+/g, ' '));
  console.log(`   Content: ${reportsText}`);

  // 4. My Profile & Connected Services
  console.log('\n5. Testing "My Profile & Connected Services" View...');
  ok = await navigateTo('My Profile & Connected Services');
  console.log(`-> Navigation clicked: ${ok}`);
  const profileSummary = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({ name: i.name || i.placeholder || i.type, val: i.value }));
    return {
      inputsCount: inputs.length,
      sample: inputs.slice(0, 4),
      headings: Array.from(document.querySelectorAll('h2, h3, h4')).map(h => h.innerText.trim()).slice(0, 4)
    };
  });
  console.log(`   Profile fields count: ${profileSummary.inputsCount}`);
  console.log(`   Profile sections: ${profileSummary.headings.join(' | ')}`);

  // 5. Settings View
  console.log('\n6. Testing "Settings" View...');
  ok = await navigateTo('Settings');
  console.log(`-> Navigation clicked: ${ok}`);
  const settingsSummary = await page.evaluate(() => {
    const sliders = Array.from(document.querySelectorAll('input[type="range"]')).length;
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.length > 0 && t.length < 25);
    return { sliders, buttonsSample: buttons.slice(0, 6) };
  });
  console.log(`   Settings Sliders: ${settingsSummary.sliders}, Buttons: ${settingsSummary.buttonsSample.join(', ')}`);

  // 6. Help & About Modal
  console.log('\n7. Testing "Help and About" Modal...');
  ok = await navigateTo('Help and About');
  console.log(`-> Clicked Help and About: ${ok}`);
  await page.waitForTimeout(800);
  const modalText = await page.evaluate(() => {
    const modal = document.querySelector('div[role="dialog"]');
    return modal ? modal.innerText.substring(0, 150).replace(/\n+/g, ' ') : 'NO MODAL FOUND';
  });
  console.log(`   Modal text: ${modalText}`);

  // Close modal via Close Button or Escape key
  const closeAboutBtn = await page.$('button[aria-label="Close about dialog"]');
  if (closeAboutBtn) {
    await closeAboutBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(800);

  // 7. Return to Dashboard (Live Monitoring)
  console.log('\n8. Returning to Dashboard...');
  ok = await navigateTo('Live Monitoring');
  console.log(`-> Navigation clicked: ${ok}`);

  // 8. Test Dashboard Controls
  console.log('\n9. Testing Dashboard Controls & Map...');
  const dashboardControls = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t);
    const hasMap = Boolean(document.querySelector('.leaflet-container'));
    const isBackendOnline = document.body.innerText.includes('Backend: Online');
    const isModelLoaded = document.body.innerText.includes('Model: Active') || document.body.innerText.includes('Model Status');
    return {
      buttonsCount: buttons.length,
      sampleButtons: buttons.slice(0, 8),
      hasMap,
      isBackendOnline
    };
  });
  console.log(`   Buttons on Dashboard: ${dashboardControls.buttonsCount}`);
  console.log(`   Sample buttons: ${dashboardControls.sampleButtons.join(' | ')}`);
  console.log(`   Leaflet Map Initialized: ${dashboardControls.hasMap}`);
  console.log(`   Backend Status Online: ${dashboardControls.isBackendOnline}`);

  // 9. Test GPS Toggle on Dashboard
  console.log('\n10. Testing GPS Toggle Switch...');
  const gpsToggled = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('GPS:'));
    if (btn) {
      const before = btn.innerText.trim();
      btn.click();
      return { before };
    }
    return null;
  });
  await page.waitForTimeout(800);
  const gpsAfter = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('GPS:'));
    return btn ? btn.innerText.trim() : null;
  });
  console.log(`   GPS Toggle: was "${gpsToggled?.before}", now "${gpsAfter}"`);

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  console.log(`Total Backend API Calls: ${networkLogs.length}`);
  networkLogs.forEach(l => console.log(`  [${l.status}] ${l.url}`));
  console.log(`\nTotal Console / Page Errors: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach(e => console.error(`  FAIL: ${e}`));
    throw new Error('Audit detected console errors');
  } else {
    console.log('  SUCCESS: 0 console errors, 0 runtime exceptions across all 7 application sections!');
  }

  await browser.close();
}

runAudit().catch(err => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
