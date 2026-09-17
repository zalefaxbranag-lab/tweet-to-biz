from playwright.sync_api import sync_playwright
import sys, json

OUT="/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/qa"
URL="file://"+OUT+"/mock.html"
tag = sys.argv[1] if len(sys.argv)>1 else "v1"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    rep = {}
    for name,w,h in [("mobile",375,667),("mobile414",414,896),("desktop",1280,900)]:
        pg = b.new_page(viewport={"width":w,"height":h}, device_scale_factor=2 if w<500 else 1)
        pg.goto(URL); pg.wait_for_timeout(400)
        # mesures
        m = pg.evaluate("""(vh)=>{
          const d=document.documentElement;
          const q=s=>document.querySelector(s);
          const top=el=>el?Math.round(el.getBoundingClientRect().top+window.scrollY):null;
          const hgt=el=>el?Math.round(el.getBoundingClientRect().height):null;
          return {
            pageHeight: d.scrollHeight,
            screens: +(d.scrollHeight/vh).toFixed(1),
            horizontalOverflow: d.scrollWidth > d.clientWidth,
            scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
            heroCtaTop: top(q('.cs-dh-cta')||q('.cs-dh-cta .cs-btn')),
            heroCtaAboveFold: top(q('.cs-dh-cta')||q('.cs-dh-cta .cs-btn')) !== null && top(q('.cs-dh-cta')||q('.cs-dh-cta .cs-btn')) < vh,
            sectionTops: {
              hero: top(q('.cs-duo-hero')), vsl: top(q('.cs-duo-vsl')),
              demos: top(q('.cs-duo-demos')), steps: top(q('.cs-duo-steps')),
              offer: top(q('.cs-duo-offer')), faq: top(q('.cs-duo-faq'))
            },
            demosHeight: hgt(q('.cs-duo-demos')),
            stepsHeight: hgt(q('.cs-duo-steps')),
            ctaCount: document.querySelectorAll('.cs-btn-primary').length,
            smallTapTargets: [...document.querySelectorAll('a.cs-btn,button,summary')]
              .filter(e=>{const r=e.getBoundingClientRect();return r.height>0 && r.height<44})
              .map(e=>e.className+' h='+Math.round(e.getBoundingClientRect().height))
          };
        }""", h)
        rep[name]=m
        pg.screenshot(path=f"{OUT}/{tag}-{name}-full.png", full_page=True)
        pg.screenshot(path=f"{OUT}/{tag}-{name}-fold.png")
        pg.close()
    b.close()
    print(json.dumps(rep, indent=2))
