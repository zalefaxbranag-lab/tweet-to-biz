from playwright.sync_api import sync_playwright
import json
OUT = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/qa"
URL = "file://" + OUT + "/mock.html"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    rep = {}
    for name, w, h, scale in [("mobile", 390, 844, 2), ("desktop", 1280, 900, 1)]:
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
        pg.goto(URL); pg.wait_for_timeout(500)
        # numerote les emplacements d'image pour que chacun soit identifiable
        pg.evaluate("""()=>{
          const cards=[...document.querySelectorAll('.cs-occ-card')];
          cards.forEach((c,i)=>{
            const t=document.createElement('div');
            t.textContent='IMAGE '+(i+1);
            t.style.cssText='position:absolute;top:8px;left:8px;z-index:9;background:#EC5B3C;'
              +'color:#fff;font:700 11px/1 system-ui;letter-spacing:.08em;padding:6px 9px;'
              +'border-radius:99px;box-shadow:0 2px 8px rgba(0,0,0,.35)';
            c.style.position='relative'; c.appendChild(t);
          });
          return cards.length;
        }""")
        sec = pg.query_selector(".cs-duo-occ")
        rep[name] = {
            "cards": pg.eval_on_selector_all(".cs-occ-card", "e=>e.length"),
            "sectionHeight": pg.eval_on_selector(".cs-duo-occ", "e=>Math.round(e.getBoundingClientRect().height)"),
            "heroCta": pg.eval_on_selector_all(".cs-dh-cta", "e=>e.length"),
        }
        sec.screenshot(path=f"{OUT}/slots-{name}.png")
        # le haut de page, pour qu'il voie le hero
        pg.query_selector(".cs-duo-hero").screenshot(path=f"{OUT}/hero-{name}.png")
        pg.close()
    b.close()
    print(json.dumps(rep, indent=2))
