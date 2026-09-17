from playwright.sync_api import sync_playwright
Q="/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/qa"

with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    pg=b.new_page(viewport={"width":375,"height":667}, device_scale_factor=2)
    errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console."+m.type+": "+m.text) if m.type=="error" else None)
    pg.goto("file://"+Q+"/mock2.html"); pg.wait_for_timeout(500)

    def state():
        return pg.evaluate("""()=>{
          const bar=document.querySelector('[data-cs-dbar]');
          const on=bar.classList.contains('cs-dbar-on');
          const r=bar.getBoundingClientRect();
          const ctasOnScreen=[...document.querySelectorAll('.cs-btn-primary')]
            .filter(e=>!bar.contains(e))
            .filter(e=>{const b=e.getBoundingClientRect();
              return b.bottom>8 && b.top < window.innerHeight-8;}).length;
          return {barOn:on, barHidden:bar.hasAttribute('hidden'),
                  barTop:Math.round(r.top), inViewport:r.top<window.innerHeight&&r.bottom>0,
                  ctasOnScreen};
        }""")

    print(f"{'scrollY':>8} | {'CTA a l ecran':>13} | {'barre active':>12} | verdict")
    print("-"*62)
    ok=True
    for y in [0, 300, 600, 900, 1200, 1600, 2000, 2600, 3200, 3600, 4200, 4700, 5000]:
        pg.evaluate(f"window.scrollTo(0,{y})"); pg.wait_for_timeout(260)
        s=state()
        # regle attendue : barre active si et seulement si aucun CTA a l ecran
        expected = (s["ctasOnScreen"] == 0)
        good = (s["barOn"] == expected)
        if not good: ok=False
        print(f"{y:>8} | {s['ctasOnScreen']:>13} | {str(s['barOn']):>12} | {'OK' if good else 'ECHEC attendu='+str(expected)}")

    # capture avec la barre visible, au milieu de la page
    pg.evaluate("window.scrollTo(0,1200)"); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{Q}/v2-bar-visible.png")
    pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{Q}/v2-bar-hidden-top.png")

    print()
    print("erreurs JS :", errs if errs else "aucune")
    print("RESULTAT   :", "la barre suit exactement la regle" if ok else "LOGIQUE A CORRIGER")
    b.close()
