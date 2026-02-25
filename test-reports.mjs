import { chromium } from 'playwright';

const SCREENSHOTS_DIR = '.playwright-mcp';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(2000);
  await page.fill('input[type="text"], input[name="username"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('Logged in, current URL:', page.url());

  // Navigate to Reports
  console.log('Navigating to /reports...');
  await page.goto('http://localhost:5173/reports');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/reports-overview.png`, fullPage: true });
  console.log('Screenshot: reports-overview.png');

  // Click Revenue tab
  console.log('Clicking Revenue tab...');
  await page.click('button:has-text("Revenue")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/reports-revenue.png`, fullPage: true });
  console.log('Screenshot: reports-revenue.png');

  // Click Time tab
  console.log('Clicking Time tab...');
  await page.click('button:has-text("Time")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/reports-time.png`, fullPage: true });
  console.log('Screenshot: reports-time.png');

  // Click Pipeline tab
  console.log('Clicking Pipeline tab...');
  await page.click('button:has-text("Pipeline")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/reports-pipeline.png`, fullPage: true });
  console.log('Screenshot: reports-pipeline.png');

  // Test date range change - go back to Overview and click 12mo
  console.log('Testing 12mo date range on Overview...');
  await page.click('button:has-text("Overview")');
  await page.waitForTimeout(2000);
  await page.click('button:has-text("12mo")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/reports-overview-12mo.png`, fullPage: true });
  console.log('Screenshot: reports-overview-12mo.png');

  // Check sidebar has Reports entry
  const sidebarReports = await page.$('a[href="/reports"]');
  console.log('Sidebar "Reports" link found:', !!sidebarReports);

  // Check console for errors
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.waitForTimeout(1000);
  if (errors.length > 0) {
    console.log('Page errors:', errors);
  } else {
    console.log('No page errors detected');
  }

  await browser.close();
  console.log('\nDone! All screenshots saved to .playwright-mcp/');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
