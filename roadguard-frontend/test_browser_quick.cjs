const { chromium } = require('playwright-core');

async function main() {
  console.log('Launching installed Microsoft Edge...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });
  console.log('Browser launched successfully!');

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  
  const title = await page.title();
  console.log('Page Title:', title);

  const headerText = await page.locator('header').innerText();
  console.log('Header text:', headerText.replace(/\n/g, ' '));

  await browser.close();
  console.log('Browser test finished cleanly.');
}

main().catch(err => {
  console.error('Error during browser test:', err);
  process.exit(1);
});
