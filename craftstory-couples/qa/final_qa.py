from playwright.sync_api import sync_playwright
Q="/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/qa"
WIDTHS=[(320,568),(375,667),(390,844),(414,896),(768,1024),(1280,900)]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    print(f"{'largeur':>8} | {'overflow H':>10} | {'CTA<pli':>8} | {'CTA y':>6} | {'page':>6} | {'ecrans':>6} | {'tap<44':>7} | texte coupe")
    print("-"*92)
    allok=True
    for w,h in WIDTHS:
        pg=b.new_page(viewport={"width":w,"height":h})
        pg.goto("file://"+Q+"/mock.html"); pg.wait_for_timeout(350)
        r=pg.evaluate("""(vh)=>{
          const d=document.documentElement, q=s=>document.querySelector(s);
          const cta=q('.cs-dh-cta .cs-btn');
          const ctaTop=cta?Math.round(cta.getBoundingClientRect().top+window.scrollY):null;
          // debordement de texte : element dont le contenu depasse sa boite
          const clipped=[...document.querySelectorAll('h1,h2,h3,p,span,li,a,summary,figcaption')]
            .filter(e=>e.children.length===0 && e.scrollWidth>e.clientWidth+2)
            .map(e=>(e.className||e.tagName)+':"'+(e.textContent||'').trim().slice(0,28)+'"');
          const small=[...document.querySelectorAll('a.cs-btn,button,summary')]
            .filter(e=>{const b=e.getBoundingClientRect();return b.height>0&&b.height<44}).length;
          return {overflow:d.scrollWidth>d.clientWidth, sw:d.scrollWidth, cw:d.clientWidth,
                  ctaTop, above:ctaTop!==null&&ctaTop<vh, page:d.scrollHeight,
                  screens:+(d.scrollHeight/vh).toFixed(1), small, clipped:[...new Set(clipped)].slice(0,3)};
        }""", h)
        bad = r["overflow"] or not r["above"] or r["small"]>0 or r["clipped"]
        if bad: allok=False
        print(f"{w:>8} | {('OUI '+str(r['sw'])+'>'+str(r['cw'])) if r['overflow'] else 'aucun':>10} | "
              f"{('oui' if r['above'] else 'NON'):>8} | {r['ctaTop']:>6} | {r['page']:>6} | {r['screens']:>6} | "
              f"{r['small']:>7} | {', '.join(r['clipped']) if r['clipped'] else 'aucun'}")
        if w==320: pg.screenshot(path=f"{Q}/v3-320-fold.png")
        pg.close()
    b.close()
    print()
    print("RESULTAT:", "toutes les largeurs passent" if allok else "AU MOINS UNE LARGEUR EN ECHEC")
