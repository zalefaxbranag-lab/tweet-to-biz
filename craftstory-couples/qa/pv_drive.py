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
from serve import start as _serve
_srv, _base = _serve(D)
URL = _base + "/preview.html"
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

    def page(offset_ms):
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        ctx.add_init_script(boot(offset_ms))
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
        pg.on("response", lambda r: errs.append("HTTP %d %s" % (r.status, r.url)) if r.status >= 400 else None)
        pg.goto(URL)
        pg.wait_for_timeout(700)
        return pg

    HIDDEN = ((".cs-pvs-after", "l'apercu et la suite"), (".cs-duo-pvo", "l'offre"),
              (".cs-duo-rev", "les avis"), (".cs-duo-faq", "les questions"),
              (".cs-duo-help", "l'aide"))

    print("\n--- VERROUILLE, ARRIVEE FRAICHE ---")
    p = page(None)
    check("attribut de verrou", p.get_attribute("html", "data-cs-lock"), "1")
    check("l'attente est visible", p.is_visible(".cs-pvs-top"), True)
    for sel, name in HIDDEN:
        check(name + " est masque", p.is_hidden(sel), True)
    check("encart d'attente visible", p.is_visible(".cs-pvs-notice"), True)
    check("encart pret masque", p.is_hidden("[data-cs-ready]"), True)
    check("la barre demarre a zero", p.inner_text("[data-cs-pct]") in ("0%", "1%"), True)

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
    check("etiquette de lecture", p.eval_on_selector(".cs-pvs-tap", "e=>e.textContent"),
          "Tap to play preview")

    print("\n--- A MI-PARCOURS : L'ECHEANCE NE REPART PAS ---")
    p = page(30000)   # 30 s restantes sur une barre d'une minute
    pct = int(p.inner_text("[data-cs-pct]").rstrip("%"))
    check("environ la moitie", 45 <= pct <= 55, True)
    print("   pourcentage:", pct, "% | etape:", p.inner_text("[data-cs-stage]"),
          "| horloge:", p.inner_text("[data-cs-clock]"))
    check("toujours verrouille", p.get_attribute("html", "data-cs-lock"), "1")
    p.reload(); p.wait_for_timeout(700)
    again = int(p.inner_text("[data-cs-pct]").rstrip("%"))
    check("le rechargement ne remet pas a zero", again >= pct, True)

    print("\n--- OUVERT ---")
    p = page(-1000)   # echeance deja passee
    p.wait_for_timeout(900)
    check("le verrou est leve", p.get_attribute("html", "data-cs-lock"), "0")
    check("l'attente reste en haut", p.is_visible(".cs-pvs-top"), True)
    check("le clip est toujours la", p.is_visible(".cs-pvs-stage"), True)
    for sel, name in HIDDEN:
        check(name + " apparait", p.is_visible(sel), True)
    check("encart d'attente masque", p.is_hidden(".cs-pvs-notice"), True)
    check("encart pret visible", p.is_visible("[data-cs-ready]"), True)
    check("barre pleine", p.inner_text("[data-cs-pct]"), "100%")

    print("\n--- L'APERCU EN MP4 ---")
    p.click(".cs-pvs-cover")
    p.wait_for_timeout(600)
    check("le voile disparait a la lecture", p.is_hidden(".cs-pvs-cover"), True)
    check("duree lue depuis le fichier", p.inner_text("[data-cs-dur]"), "0:08")
    p.evaluate("document.querySelector('[data-cs-prev]').pause()")
    p.wait_for_timeout(200)
    check("le voile revient en pause", p.is_visible(".cs-pvs-cover"), True)

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
