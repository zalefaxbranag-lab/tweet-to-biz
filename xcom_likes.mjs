import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  console.log('=== Loading x.com to extract tokens ===');
  const page = await context.newPage();
  
  // Intercept API calls to capture the guest token and CSRF token
  let guestToken = null;
  let csrfToken = null;
  let cookies = [];
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('guest/activate')) {
      try {
        const body = await response.json();
        guestToken = body.guest_token;
        console.log('Captured guest token:', guestToken);
      } catch {}
    }
  });
  
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers['x-csrf-token'] && !csrfToken) {
      csrfToken = headers['x-csrf-token'];
      console.log('Captured CSRF token:', csrfToken);
    }
    if (headers['x-guest-token'] && !guestToken) {
      guestToken = headers['x-guest-token'];
      console.log('Captured guest token from header:', guestToken);
    }
  });
  
  try {
    await page.goto('https://x.com/ClemsM', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    
    // Get cookies
    cookies = await context.cookies();
    const ct0 = cookies.find(c => c.name === 'ct0');
    const gt = cookies.find(c => c.name === 'gt');
    console.log('ct0 cookie:', ct0?.value?.substring(0, 30) + '...');
    console.log('gt cookie:', gt?.value);
    
    if (!csrfToken && ct0) csrfToken = ct0.value;
    if (!guestToken && gt) guestToken = gt.value;
    
    console.log('\nTokens collected:');
    console.log('  Guest token:', guestToken);
    console.log('  CSRF token:', csrfToken?.substring(0, 30) + '...');
    
    // Now try to make the Likes API call with these tokens
    if (guestToken && csrfToken) {
      console.log('\n=== Attempting Likes API call via page context ===');
      
      const likesResult = await page.evaluate(async ({ userId, guestToken, csrfToken }) => {
        const variables = JSON.stringify({userId, count: 5, includePromotedContent: false});
        const features = JSON.stringify({
          "rweb_tipjar_consumption_enabled":true,
          "responsive_web_graphql_exclude_directive_enabled":true,
          "verified_phone_label_enabled":false,
          "creator_subscriptions_tweet_preview_api_enabled":true,
          "responsive_web_graphql_timeline_navigation_enabled":true,
          "responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,
          "responsive_web_enhance_cards_enabled":false
        });
        
        try {
          const resp = await fetch(`/i/api/graphql/j-O2fOmYBTqofGfn6LMb8g/Likes?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`, {
            headers: {
              'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
              'x-guest-token': guestToken,
              'x-csrf-token': csrfToken,
              'x-twitter-active-user': 'yes',
              'x-twitter-client-language': 'en',
            },
            credentials: 'include'
          });
          const text = await resp.text();
          return { status: resp.status, body: text.substring(0, 1000) };
        } catch (e) {
          return { error: e.message };
        }
      }, { userId: '1205743902', guestToken, csrfToken });
      
      console.log('Likes API result:', JSON.stringify(likesResult, null, 2));
    }
    
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await browser.close();
}

main().catch(console.error);
