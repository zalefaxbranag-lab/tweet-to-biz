import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  // Test: x.com with just domcontentloaded (not networkidle) to avoid timeout
  console.log('=== x.com/ClemsM/likes (fast load) ===');
  try {
    const page = await context.newPage();
    await page.goto('https://x.com/ClemsM/likes', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);
    console.log('Title:', await page.title());
    console.log('URL:', page.url());
    
    // Check for login redirect or prompt
    const loginButton = await page.$('[data-testid="loginButton"], [href="/login"], a[href*="/i/flow/login"]');
    console.log('Login prompt detected:', !!loginButton);
    
    // Look for any tweet content
    const tweets = await page.$$('[data-testid="tweet"]');
    console.log('Tweet elements:', tweets.length);
    
    // Check for "These are private" or similar messages
    const body = await page.textContent('body');
    if (body.includes('private') || body.includes('Private') || body.includes("can't see") || body.includes('log in') || body.includes('Log in')) {
      console.log('Privacy/login message found');
    }
    console.log('Body snippet:', body?.replace(/\s+/g, ' ').substring(0, 300));
    await page.close();
  } catch (e) {
    console.log('x.com error:', e.message);
  }
  
  // Test: nitter.tiekoetter.com for TIMELINE (not favorites) - to verify it works at all
  console.log('\n=== nitter.tiekoetter.com timeline (baseline test) ===');
  try {
    const page2 = await context.newPage();
    await page2.goto('https://nitter.tiekoetter.com/ClemsM', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page2.waitForTimeout(15000); // Wait for Anubis
    console.log('Title:', await page2.title());
    console.log('URL:', page2.url());
    
    const links = await page2.$$eval('a[href*="/status/"]', els => els.map(e => e.href).slice(0, 5));
    console.log('Tweet links found:', links.length);
    links.forEach((l, i) => console.log(`  ${i+1}. ${l}`));
    
    if (links.length === 0) {
      const text = await page2.textContent('body');
      console.log('Body:', text?.substring(0, 200));
    }
    await page2.close();
  } catch (e) {
    console.log('tiekoetter timeline error:', e.message);
  }
  
  // Test: Try nitter.poast.org for timeline
  console.log('\n=== nitter.poast.org timeline (baseline test) ===');
  try {
    const page3 = await context.newPage();
    await page3.goto('https://nitter.poast.org/ClemsM', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page3.waitForTimeout(8000);
    console.log('Title:', await page3.title());
    
    const links = await page3.$$eval('a[href*="/status/"]', els => els.map(e => e.href).slice(0, 5));
    console.log('Tweet links found:', links.length);
    links.forEach((l, i) => console.log(`  ${i+1}. ${l}`));
    await page3.close();
  } catch (e) {
    console.log('poast timeline error:', e.message);
  }
  
  await browser.close();
}

main().catch(console.error);
