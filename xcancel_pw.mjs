import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  // Test 1: xcancel.com with verification flow
  console.log('=== xcancel.com with verification ===');
  try {
    await page.goto('https://xcancel.com/ClemsM/favorites', { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Wait for JS challenge to resolve
    await page.waitForTimeout(8000);
    console.log('Title:', await page.title());
    console.log('URL:', page.url());
    
    // Try navigating to the verification URL  
    const currentUrl = page.url();
    if (currentUrl.includes('verify')) {
      console.log('On verification page, waiting...');
      await page.waitForTimeout(10000);
      console.log('After more waiting, URL:', page.url());
    }
    
    const links = await page.$$eval('a[href*="/status/"]', els => els.map(e => e.href).slice(0, 20));
    if (links.length > 0) {
      console.log('\n=== FOUND TWEET LINKS on xcancel ===');
      links.forEach((l, i) => console.log(`${i+1}. ${l}`));
    } else {
      const text = await page.textContent('body');
      console.log('Page text:', text?.substring(0, 300));
    }
  } catch (e) {
    console.log('xcancel error:', e.message);
  }
  
  // Test 2: Try twiiit.com (redirects to nitter.tiekoetter.com) with Playwright
  console.log('\n=== twiiit.com / nitter.tiekoetter.com ===');
  try {
    const page2 = await context.newPage();
    await page2.goto('https://nitter.tiekoetter.com/ClemsM/favorites', { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('Title:', await page2.title());
    // Wait for Anubis challenge to solve
    await page2.waitForTimeout(15000);
    console.log('After wait - Title:', await page2.title());
    console.log('URL:', page2.url());
    
    const links = await page2.$$eval('a[href*="/status/"]', els => els.map(e => e.href).slice(0, 20));
    if (links.length > 0) {
      console.log('\n=== FOUND TWEET LINKS on tiekoetter ===');
      links.forEach((l, i) => console.log(`${i+1}. ${l}`));
    } else {
      const text = await page2.textContent('body');
      console.log('Page text:', text?.substring(0, 300));
    }
    await page2.close();
  } catch (e) {
    console.log('tiekoetter error:', e.message);
  }

  // Test 3: Try x.com/ClemsM/likes directly with Playwright
  console.log('\n=== x.com/ClemsM/likes direct ===');
  try {
    const page3 = await context.newPage();
    await page3.goto('https://x.com/ClemsM/likes', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Title:', await page3.title());
    await page3.waitForTimeout(5000);
    
    // Check if we're redirected to login
    console.log('URL:', page3.url());
    const text = await page3.textContent('body');
    console.log('Body text preview:', text?.substring(0, 300));
    
    // Check for tweet articles
    const tweets = await page3.$$eval('[data-testid="tweet"]', els => els.length);
    console.log('Tweet elements found:', tweets);
    await page3.close();
  } catch (e) {
    console.log('x.com error:', e.message);
  }
  
  await browser.close();
}

main().catch(console.error);
