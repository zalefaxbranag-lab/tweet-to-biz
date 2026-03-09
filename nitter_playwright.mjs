import { chromium } from 'playwright';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  // Try nitter.poast.org
  console.log('Navigating to nitter.poast.org...');
  try {
    await page.goto('https://nitter.poast.org/ClemsM/favorites', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page title:', await page.title());
    console.log('URL:', page.url());
    
    // Wait for possible PoW challenge to complete
    await page.waitForTimeout(5000);
    console.log('After wait - Title:', await page.title());
    console.log('After wait - URL:', page.url());
    
    const content = await page.content();
    console.log('Content length:', content.length);
    
    // Look for tweet links
    const links = await page.$$eval('a[href*="/status/"]', els => els.map(e => e.href).slice(0, 20));
    if (links.length > 0) {
      console.log('\n=== FOUND TWEET LINKS ===');
      links.forEach((l, i) => console.log(`${i+1}. ${l}`));
    } else {
      // Check what we got
      const text = await page.textContent('body');
      console.log('Page text preview:', text?.substring(0, 500));
    }
  } catch (e) {
    console.log('nitter.poast.org error:', e.message);
  }
  
  // Try xcancel.com
  console.log('\n\n=== Trying xcancel.com ===');
  try {
    await page.goto('https://xcancel.com/ClemsM/favorites', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page title:', await page.title());
    await page.waitForTimeout(5000);
    console.log('After wait - Title:', await page.title());
    console.log('URL:', page.url());
    
    const links = await page.$$eval('a[href*="/status/"]', els => els.map(e => e.href).slice(0, 20));
    if (links.length > 0) {
      console.log('\n=== FOUND TWEET LINKS ===');
      links.forEach((l, i) => console.log(`${i+1}. ${l}`));
    } else {
      const text = await page.textContent('body');
      console.log('Page text preview:', text?.substring(0, 500));
    }
  } catch (e) {
    console.log('xcancel.com error:', e.message);
  }
  
  await browser.close();
}

main().catch(console.error);
