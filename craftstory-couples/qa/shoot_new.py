from playwright.sync_api import sync_playwright
Q="/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/qa"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    # desktop : la grille d occasions
    pg=b.new_page(viewport={"width":1280,"height":900})
    pg.goto("file://"+Q+"/mock.html"); pg.wait_for_timeout(400)
    pg.query_selector(".cs-duo-occ").screenshot(path=f"{Q}/v4-occ-desktop.png")
    r=pg.evaluate("""()=>{
      const cards=[...document.querySelectorAll('.cs-occ-card')];
      const g=document.querySelector('.cs-occ-grid');
      const gb=g.getBoundingClientRect();
      // detecte les trous : une ligne ou la somme des largeurs < largeur grille
      return {cards:cards.length,
        gridH:Math.round(gb.height),
        shapes:cards.map(c=>{const b=c.getBoundingClientRect();
          return Math.round(b.width)+'x'+Math.round(b.height)}),
        rev:!!document.querySelector('.cs-duo-rev')};
    }""")
    print("DESKTOP grille occasions :", r["cards"], "cartes, hauteur", r["gridH"], "px")
    print("  formats :", ", ".join(r["shapes"][:9]))
    print("  section avis rendue :", r["rev"], "(attendu False : blocs vides => masquee)")
    pg.close()
    # mobile : hero + occasions
    pg=b.new_page(viewport={"width":375,"height":667}, device_scale_factor=2)
    pg.goto("file://"+Q+"/mock.html"); pg.wait_for_timeout(400)
    pg.screenshot(path=f"{Q}/v4-mobile-fold.png")
    pg.query_selector(".cs-duo-occ").screenshot(path=f"{Q}/v4-occ-mobile.png")
    pg.query_selector(".cs-duo-trust").screenshot(path=f"{Q}/v4-trust.png")
    pg.close(); b.close()
