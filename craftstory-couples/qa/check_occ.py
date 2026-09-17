from playwright.sync_api import sync_playwright
Q="/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/qa"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    for w,h,lab in [(1280,900,"desktop"),(375,667,"mobile")]:
        pg=b.new_page(viewport={"width":w,"height":h}, device_scale_factor=2 if w<500 else 1)
        pg.goto("file://"+Q+"/mock.html"); pg.wait_for_timeout(400)
        r=pg.evaluate("""()=>{
          const g=document.querySelector('.cs-occ-grid');
          const cards=[...document.querySelectorAll('.cs-occ-card')];
          const gb=g.getBoundingClientRect();
          // surface occupee par les cartes vs surface de la grille = mesure des trous
          const used=cards.reduce((s,c)=>{const b=c.getBoundingClientRect();return s+b.width*b.height;},0);
          const cols=getComputedStyle(g).columnCount;
          return {cols, gridH:Math.round(gb.height),
                  fill:Math.round(100*used/(gb.width*gb.height)),
                  cards:cards.length};
        }""")
        print(f"{lab:8} colonnes={r['cols']}  hauteur={r['gridH']}px  "
              f"remplissage={r['fill']}%  ({r['cards']} cartes)")
        pg.query_selector(".cs-occ-grid").screenshot(path=f"{Q}/v5-occ-{lab}.png")
        pg.close()
    b.close()
