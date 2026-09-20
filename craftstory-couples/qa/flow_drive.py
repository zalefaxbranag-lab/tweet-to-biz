#!/usr/bin/env python3
"""Fait tourner le tunnel dans Chromium et verifie chaque ecran.

Le rendu HTML vient de qa/flow_render.py. Les deux bugs les plus couteux de
cette section (libelles reglables ignores, attribut hidden battu par une regle
d'auteur) n'etaient visibles qu'ici, pas a la relecture.
"""
import sys
from playwright.sync_api import sync_playwright

D = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/"
BASE = "file://" + D
ok = True


def check(label, got, want):
    global ok
    good = got == want
    ok = ok and good
    print(("  OK   " if good else "  FAIL ") + label + f"  -> {got!r}"
          + ("" if good else f"  (attendu {want!r})"))


# On intercepte l'envoi natif au lieu de le laisser naviguer, et on garde les
# champs pour les verifier. fetch est bouchonne pour la branche api_url.
STUB = """
window.__posts = [];
window.__submits = [];
HTMLFormElement.prototype.submit = function () {
  var out = {};
  for (var i = 0; i < this.elements.length; i++) {
    var e = this.elements[i];
    if (e.name) out[e.name] = e.value;
  }
  window.__submits.push({ action: this.getAttribute('action'), fields: out });
};
window.fetch = function (u, o) {
  window.__posts.push({ url: u, body: (o && o.body) || null });
  return Promise.resolve({ ok: true, status: 200 });
};
"""

FILL = [
    lambda p: (p.check("input[name=relationship][value=Wife]"),
               p.fill("input[name=their_name]", "Marie"),
               p.fill("input[name=your_name]", "Thomas"),
               p.check("input[name=occasion][value=Other]"),
               p.fill("input[name=occasion_other]", "Le jour ou on a adopte le chien")),
    lambda p: (p.check("input[name=genre][value=Pop]"), p.check("input[name=voice][value=Duet]")),
    lambda p: p.fill("textarea[name=qualities]", "Elle rit avant la fin de la blague."),
    lambda p: p.fill("textarea[name=story]", "Un train rate a Lyon, 2019."),
    lambda p: None,
    lambda p: (p.fill("input[name=email]", "thomas@exemple.com"),
               p.select_option("select[name=language]", "French")),
]


def steps(p):
    return p.eval_on_selector_all(".cs-flow-step:not([hidden])", "e=>e.map(x=>x.dataset.step)")


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ctx.add_init_script(STUB)
    errs = []
    pg = ctx.new_page()
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.goto(BASE + "flow.html?occasion=Proposal")
    pg.wait_for_timeout(250)

    print("\n--- ECRAN 1 ---")
    check("ecran visible", steps(pg), ["1"])
    check("retour cache", pg.is_hidden("[data-cs-back]"), True)
    check("libelle bouton", pg.inner_text("[data-cs-next-label]"), "Next")
    check("barre 1/6", pg.eval_on_selector("[data-cs-bar]", "e=>Math.round(parseFloat(e.style.width))"), 17)
    check("?occasion coche Proposal", pg.eval_on_selector_all("input[name=occasion]:checked", "e=>e.map(x=>x.value)"), ["Proposal"])
    check("Other propose en dernier", pg.eval_on_selector_all("input[name=occasion]", "e=>e[e.length-1].value"), "Other")

    print("\n--- LE CHAMP LIBRE DE « OTHER » ---")
    check("cache au depart", pg.is_hidden("[data-cs-more]"), True)
    check("pas encore obligatoire", pg.eval_on_selector("input[name=occasion_other]", "e=>e.hasAttribute('data-req')"), False)
    pg.check("input[name=occasion][value=Other]")
    check("apparait sur Other", pg.is_visible("[data-cs-more]"), True)
    check("devient obligatoire", pg.eval_on_selector("input[name=occasion_other]", "e=>e.hasAttribute('data-req')"), True)
    pg.click("[data-cs-next]")
    check("vide, il bloque", steps(pg), ["1"])
    check("message d'erreur", pg.inner_text("[data-cs-err]"), "Please fill this in before continuing.")
    pg.fill("input[name=occasion_other]", "Le jour ou on a adopte le chien")
    pg.check("input[name=occasion][value=Wedding]")
    check("se referme sur un autre choix", pg.is_hidden("[data-cs-more]"), True)
    check("et se vide", pg.input_value("input[name=occasion_other]"), "")

    print("\n--- VALIDATION ---")
    pg.fill("input[name=their_name]", "")
    pg.click("[data-cs-next]")
    check("prenom manquant bloque", steps(pg), ["1"])

    print("\n--- PARCOURS ---")
    for n in range(6):
        FILL[n](pg)
        pg.wait_for_timeout(40)
        if n == 4:
            check("message vide laisse passer (avant clic)", steps(pg), ["5"])
        pg.click("[data-cs-next]")
        pg.wait_for_timeout(220)
        if n == 0:
            check("passe a l'ecran 2", steps(pg), ["2"])
            check("retour visible", pg.is_visible("[data-cs-back]"), True)
        if n == 4:
            check("arrive a l'ecran 6", steps(pg), ["6"])
            check("dernier libelle (reglage marchand)", pg.inner_text("[data-cs-next-label]"), "Create our song")
            check("barre pleine", pg.eval_on_selector("[data-cs-bar]", "e=>Math.round(parseFloat(e.style.width))"), 100)
            check("{name} remplace", pg.inner_text("[data-cs-s7sub]"), "One step away from a song written for Marie.")

    print("\n--- ENVOI ---")
    subs = pg.evaluate("window.__submits")
    check("aucun fetch sans api_url", pg.evaluate("window.__posts.length"), 0)
    check("un envoi natif", len(subs), 1)
    check("vers le formulaire de contact", subs[0]["action"], "/contact#contact_form")
    f = subs[0]["fields"]
    check("form_type", f.get("form_type"), "contact")
    check("e-mail de l'expediteur", f.get("contact[email]"), "thomas@exemple.com")
    check("nom", f.get("contact[name]"), "Thomas & Marie")
    body = f.get("contact[body]", "")
    for k in ["Relationship", "Their name", "Your name", "Occasion", "Occasion other", "Genre", "Voice", "Qualities", "Story", "Language"]:
        check("le corps porte " + k, k + ":" in body, True)
    check("la precision est portee", "Le jour ou on a adopte le chien" in body, True)
    check("le message vide est omis", "Message:" not in body, True)
    check("le telephone vide est omis", "Phone:" not in body, True)
    check("l'e-mail n'est pas duplique", body.count("thomas@exemple.com"), 0)
    check("ecran d'attente pendant la navigation", pg.is_visible("[data-cs-wait]"), True)

    print("\n--- RETOUR DE SHOPIFY ---")
    check("prenom et e-mail mis de cote", pg.evaluate("JSON.parse(sessionStorage.getItem('csDuoFlow'))"),
          {"name": "Marie", "email": "thomas@exemple.com"})
    pg.goto(BASE + "flow.html?contact_posted=true")
    pg.wait_for_timeout(250)
    check("ecran final direct", pg.is_visible("[data-cs-done]"), True)
    check("formulaire masque", pg.is_hidden(".cs-flow-form"), True)
    check("barre masquee", pg.is_hidden(".cs-flow-top"), True)
    check("titre final", pg.inner_text("[data-cs-done-h]"), "We have everything for Marie's song.")
    check("sous-titre final", pg.inner_text("[data-cs-done-sub]"),
          "We'll write it and email it to thomas@exemple.com within 48 hours.")
    check("la cle est nettoyee", pg.evaluate("sessionStorage.getItem('csDuoFlow')"), None)
    check("pas de note d'editeur en ligne", pg.is_hidden("[data-cs-editnote]"), True)
    pg.screenshot(path=D + "shot-done.png")

    print("\n--- DANS L'EDITEUR DE THEME ---")
    ed = ctx.new_page()
    ed.add_init_script("window.Shopify = { designMode: true };")
    ed.goto(BASE + "flow.html")
    ed.wait_for_timeout(250)
    for n in range(6):
        FILL[n](ed)
        ed.wait_for_timeout(40)
        ed.click("[data-cs-next]")
        ed.wait_for_timeout(200)
    check("rien n'est envoye", ed.evaluate("window.__submits.length + window.__posts.length"), 0)
    check("ecran final quand meme", ed.is_visible("[data-cs-done]"), True)
    check("la note explique pourquoi", "Shopify blocks form submissions in the editor" in ed.inner_text("[data-cs-editnote]"), True)
    ed.screenshot(path=D + "shot-editor.png", full_page=True)

    check("aucune erreur console", errs, [])
    b.close()

print("\n" + ("TOUT PASSE" if ok else "ECHECS CI-DESSUS"))
sys.exit(0 if ok else 1)
