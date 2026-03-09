import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  // Test 1: Try nitter.tiekoetter.com for likes/favorites explicitly
  console.log('=== nitter.tiekoetter.com /ClemsM/likes ===');
  try {
    const page = await context.newPage();
    await page.goto('https://nitter.tiekoetter.com/ClemsM/likes', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(15000);
    console.log('Title:', await page.title());
    console.log('URL:', page.url());
    const text = await page.textContent('body');
    console.log('Body:', text?.substring(0, 200));
    const links = await page.$$eval('a[href*="/status/"]', els => els.map(e => e.href).slice(0, 5));
    console.log('Links:', links.length);
    await page.close();
  } catch (e) { console.log('Error:', e.message); }

  // Test 2: Try nitter.tiekoetter.com search for "liked by ClemsM"
  console.log('\n=== nitter.tiekoetter.com search ===');
  try {
    const page2 = await context.newPage();
    await page2.goto('https://nitter.tiekoetter.com/search?q=from%3AClemsM&f=tweets', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page2.waitForTimeout(15000);
    console.log('Title:', await page2.title());
    const text = await page2.textContent('body');
    console.log('Body:', text?.substring(0, 200));
    await page2.close();
  } catch (e) { console.log('Error:', e.message); }

  // Test 3: Check x.com/ClemsM/likes with x.com login page - get error message
  console.log('\n=== x.com likes - what error appears ===');
  try {
    const page3 = await context.newPage();
    // Don't wait for networkidle
    await page3.goto('https://x.com/ClemsM/likes', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page3.waitForTimeout(8000);
    console.log('Final URL:', page3.url());
    const text = await page3.textContent('body');
    const cleaned = text?.replace(/\s+/g, ' ').trim();
    console.log('Full text:', cleaned?.substring(0, 500));
    await page3.close();
  } catch (e) { console.log('Error:', e.message); }
  
  await browser.close();
}

main().catch(console.error);
