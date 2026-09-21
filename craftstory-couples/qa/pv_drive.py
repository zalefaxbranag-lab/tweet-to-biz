#!/usr/bin/env python3
"""Pilote la page d'apres-tunnel dans Chromium : verrou, mots, ouverture.

Trois phases, une page par phase, chacune avec sa propre echeance posee AVANT
le chargement. Poser l'echeance puis recharger ne marche pas : la section la
relit au demarrage, donc le test doit l'avoir ecrite avant lui.
"""
import re
import sys
from playwright.sync_api import sync_playwright

D = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/"
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from build_pages import main as _build
_build()
from serve import start as _serve
_srv, _base = _serve(D)
URL = _base + "/preview.html"
URL_LOCKED = _base + "/preview-locked.html"
ok = True


def check(label, got, want):
    global ok
    good = got == want
    ok = ok and good
    print(("  OK   " if good else "  FAIL ") + label + f"  -> {got!r}"
          + ("" if good else f"  (attendu {want!r})"))


# Exactement ce que le tunnel met de cote dans l'onglet.
ANSWERS = ("{relationship:'Wife', their_name:'Marie', your_name:'Thomas', occasion:'Anniversary',"
           " genre:'Soul / R&B', voice:'Duet', language:'English', email:'thomas@exemple.com'}")


def boot(offset_ms):
    """offset_ms = None -> pas d'echeance posee, la section la cree elle-meme."""
    js = f"try{{sessionStorage.setItem('csDuoFlow', JSON.stringify({ANSWERS}));}}catch(e){{}}\n"
    if offset_ms is None:
        js += "try{localStorage.removeItem('csDuoOpenAt');localStorage.removeItem('csDuoDeadline');}catch(e){}"
    else:
        js += ("try{localStorage.setItem('csDuoOpenAt', String(Date.now()+%d));"
               "localStorage.removeItem('csDuoDeadline');}catch(e){}" % offset_ms)
    return js


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                           args=["--autoplay-policy=no-user-gesture-required"])
    errs = []

    def page(offset_ms, url=None):
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        ctx.add_init_script(boot(offset_ms))
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
        pg.on("response", lambda r: errs.append("HTTP %d %s" % (r.status, r.url)) if r.status >= 400 else None)
        pg.goto(url or URL)
        pg.wait_for_timeout(700)
        return pg

    HIDDEN = ((".cs-pvs-after", "l'apercu et la suite"), (".cs-duo-pvo", "l'offre"),
              (".cs-duo-rev", "les avis"), (".cs-duo-faq", "les questions"),
              (".cs-duo-help", "l'aide"))

    print("\n--- TELLE QU'ELLE EST CONFIGUREE : OUVERTE ---")
    # On n'y arrive qu'en cliquant le bouton du tunnel, donc rien n'est masque.
    p = page(None)
    check("ouverte d'entree", p.get_attribute("html", "data-cs-lock"), "0")
    for sel, name in HIDDEN:
        check(name + " est visible", p.is_visible(sel), True)
    check("pas de barre qui repart de zero", p.is_hidden(".cs-pvs-prog"), True)
    check("pas d'horloge sur le clip", p.is_hidden("[data-cs-clock]"), True)
    check("encart d'attente masque", p.is_hidden(".cs-pvs-notice"), True)
    check("encart pret visible", p.is_visible("[data-cs-ready]"), True)

    print("\n--- LES REPONSES DANS LES MOTS ---")
    check("titre de l'apercu", p.eval_on_selector(".cs-pvs-title", "e=>e.textContent"),
          "Marie's Unique Music Video")
    check("sous-titre compose", p.eval_on_selector(".cs-pvs-songsub", "e=>e.textContent"),
          "Soul / R&B melody, written for Marie (Wife)")
    check("derniere ligne de comparaison",
          p.eval_on_selector_all(".cs-pvs-row-l", "e=>e[2].textContent.trim()"), "Marie's music video")
    check("bouton d'achat", p.eval_on_selector("[data-cs-go] [data-cs-tpl]", "e=>e.textContent"),
          "Unlock Marie's full music video")
    check("option a cocher", p.eval_on_selector(".cs-pvo-addon b", "e=>e.textContent"),
          "Keep Marie's lyrics forever")

    print("\n--- LE REGLAGE DE VERROU, QUAND ON L'ALLUME ---")
    lk = page(150000, URL_LOCKED)   # la moitie de bar_minutes, cinq par defaut
    check("verrou pose", lk.get_attribute("html", "data-cs-lock"), "1")
    for sel, name in HIDDEN:
        check(name + " est masque", lk.is_hidden(sel), True)
    check("l'attente reste visible", lk.is_visible(".cs-pvs-top"), True)
    pct = int(lk.inner_text("[data-cs-pct]").rstrip("%"))
    check("la barre est a la moitie", 45 <= pct <= 55, True)
    lk.reload(); lk.wait_for_timeout(700)
    check("le rechargement ne remet pas a zero",
          int(lk.inner_text("[data-cs-pct]").rstrip("%")) >= pct, True)

    lk2 = page(-1000, URL_LOCKED)
    lk2.wait_for_timeout(900)
    check("echeance passee : le verrou tombe", lk2.get_attribute("html", "data-cs-lock"), "0")
    for sel, name in HIDDEN:
        check(name + " apparait", lk2.is_visible(sel), True)
    check("encart pret visible", lk2.is_visible("[data-cs-ready]"), True)

    # L'apercu n'est plus un fichier lu de bout en bout mais un MONTAGE de six
    # plans cales sur la chanson. Il a son propre banc d'essai, qa/take_drive.py,
    # parce qu'il demande de vrais medias et un deplacement dans la piste : ici
    # on verifie seulement qu'une page sans plan montre son cadre vide plutot
    # qu'un bouton qui fait semblant.
    check("sans plan charge, un cadre vide", p.is_visible(".cs-pvs-prev-empty"), True)
    check("et pas de lecteur", p.eval_on_selector_all("[data-cs-take]", "e=>e.length"), 0)

    print("\n--- LE REBOURS DU TARIF ---")
    big = p.inner_text("[data-cs-big]")
    check("part d'une minute", bool(re.fullmatch(r"00:[45]\d", big)), True)
    print("   rebours:", big)

    # Les images du mock n'existent pas sur le disque : ce n'est pas la section.
    real = [e for e in errs if "ERR_FILE_NOT_FOUND" not in e]
    check("aucune erreur", real, [])
    p.evaluate("window.scrollTo(0,0)"); p.wait_for_timeout(300)
    p.screenshot(path=D + "pv2-full.png", full_page=True)
    b.close()

print("\n" + ("TOUT PASSE" if ok else "ECHECS CI-DESSUS"))
sys.exit(0 if ok else 1)
