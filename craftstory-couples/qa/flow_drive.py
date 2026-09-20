#!/usr/bin/env python3
"""Fait tourner le tunnel dans Chromium et verifie chaque ecran."""
import sys, json
from playwright.sync_api import sync_playwright

BASE = "file:///tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/"
ok = True
def check(label, got, want):
    global ok
    good = got == want
    ok = ok and good
    print(("  OK   " if good else "  FAIL ") + label + f"  -> {got!r}" + ("" if good else f"  (attendu {want!r})"))

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))

    # fetch bouchonne : on ne veut evidemment pas poster quoi que ce soit.
    pg.add_init_script("""window.__posts=[];
      window.fetch=function(u,o){window.__posts.push({url:u,body:(o&&o.body)||null});
        return Promise.resolve({ok:true,status:200});};""")
    pg.goto(BASE + "flow.html?occasion=Proposal")
    pg.wait_for_timeout(250)

    print("\n--- ECRAN 1 ---")
    check("ecran visible", pg.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)"), ["1"])
    check("retour cache", pg.is_hidden("[data-cs-back]"), True)
    check("libelle bouton", pg.inner_text("[data-cs-next-label]"), "Next")
    check("barre 1/6", pg.eval_on_selector("[data-cs-bar]", "e=>Math.round(parseFloat(e.style.width))"), 17)
    check("?occasion coche Proposal", pg.eval_on_selector_all("input[name=occasion]:checked", "e=>e.map(x=>x.value)"), ["Proposal"])

    print("\n--- VALIDATION ---")
    pg.click("[data-cs-next]")
    check("erreur affichee", pg.is_visible("[data-cs-err]"), True)
    check("texte de l'erreur (reglage marchand)", pg.inner_text("[data-cs-err]"), "Please fill this in before continuing.")
    check("toujours ecran 1", pg.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)"), ["1"])

    print("\n--- PARCOURS ---")
    pg.check("input[name=relationship][value=Wife]")
    pg.fill("input[name=their_name]", "Marie")
    pg.fill("input[name=your_name]", "Thomas")
    pg.click("[data-cs-next]")
    check("passe a l'ecran 2", pg.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)"), ["2"])
    check("retour visible", pg.is_visible("[data-cs-back]"), True)
    pg.click("[data-cs-next]")
    check("genre manquant bloque", pg.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)"), ["2"])
    pg.check("input[name=genre][value=Pop]")
    pg.check("input[name=voice][value=Duet]")
    pg.click("[data-cs-next]")
    pg.fill("textarea[name=qualities]", "Elle rit avant la fin de la blague.")
    pg.click("[data-cs-next]")
    pg.fill("textarea[name=story]", "Un train rate a Lyon, 2019.")
    pg.click("[data-cs-next]")
    check("ecran 5 (message facultatif)", pg.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)"), ["5"])
    pg.click("[data-cs-next]")
    check("message vide laisse passer", pg.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)"), ["6"])
    check("libelle du dernier bouton (reglage marchand)", pg.inner_text("[data-cs-next-label]"), "Create our song")
    check("barre pleine", pg.eval_on_selector("[data-cs-bar]", "e=>Math.round(parseFloat(e.style.width))"), 100)
    check("{name} remplace", pg.inner_text("[data-cs-s7sub]"), "One step away from a song written for Marie.")

    print("\n--- RETOUR ---")
    pg.click("[data-cs-back]")
    check("revient a l'ecran 5", pg.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)"), ["5"])
    check("ecran 5 vierge", pg.input_value("textarea[name=message]"), "")
    pg.click("[data-cs-back]")
    check("ecran 4 garde son texte", pg.input_value("textarea[name=story]"), "Un train rate a Lyon, 2019.")
    pg.click("[data-cs-next]"); pg.click("[data-cs-next]")

    print("\n--- EMAIL ---")
    pg.fill("input[name=email]", "marie(at)exemple")
    pg.click("[data-cs-next]")
    check("email invalide bloque", pg.inner_text("[data-cs-err]"), "That email address does not look right.")
    pg.fill("input[name=email]", "thomas@exemple.com")
    pg.select_option("select[name=language]", "French")
    pg.click("[data-cs-next]")
    pg.wait_for_timeout(400)

    print("\n--- ENVOI ---")
    posts = pg.evaluate("window.__posts")
    check("un seul envoi", len(posts), 1)
    check("vers le formulaire de contact", posts[0]["url"], "/contact#contact_form")
    body = posts[0]["body"] or ""
    for k in ["relationship", "their_name", "your_name", "occasion", "genre", "voice", "qualities", "story", "language"]:
        check("le corps porte " + k, k in body, True)
    check("l'email n'est pas duplique dans le corps", body.count("thomas%40exemple.com"), 1)
    check("ecran final visible", pg.is_visible("[data-cs-done]"), True)
    check("formulaire masque", pg.is_hidden(".cs-flow-form"), True)
    check("barre masquee", pg.is_hidden(".cs-flow-top"), True)
    check("titre final", pg.inner_text("[data-cs-done-h]"), "We have everything for Marie's song.")
    check("sous-titre final", pg.inner_text("[data-cs-done-sub]"), "We'll write it and email it to thomas@exemple.com within 48 hours.")

    pg.screenshot(path="/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/shot-done.png")
    check("aucune erreur console", errs, [])
    b.close()

print("\n" + ("TOUT PASSE" if ok else "ECHECS CI-DESSUS"))
sys.exit(0 if ok else 1)
