#!/usr/bin/env python3
"""Fait tourner le tunnel dans Chromium et verifie chaque ecran.

Le rendu HTML vient de qa/flow_render.py. Les deux bugs les plus couteux de
cette section (libelles reglables ignores, attribut hidden battu par une regle
d'auteur) n'etaient visibles qu'ici, pas a la relecture.
"""
import os
import struct
import sys
import zlib
from playwright.sync_api import sync_playwright

D = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/"
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from build_pages import main as _build
_build()
from serve import start as _serve
_srv, _base = _serve(D)
BASE = _base + "/"
ok = True


def png(path, w, h, rgb):
    """Un PNG uni, ecrit a la main : aucune dependance, aucun fichier reel."""
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    blob = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(blob)
    return path


# Plus grandes que le plafond de 1280 px, sinon le test ne prouve rien.
SHOT1 = png(D + "shot1.png", 1800, 2400, (214, 132, 96))
SHOT2 = png(D + "shot2.png", 1800, 2400, (96, 132, 214))
SHOT3 = png(D + "shot3.png", 400, 400, (120, 200, 140))


def check(label, got, want):
    global ok
    good = got == want
    ok = ok and good
    print(("  OK   " if good else "  FAIL ") + label + f"  -> {got!r}"
          + ("" if good else f"  (attendu {want!r})"))


# Ce que le tunnel met de cote : un nouvel onglet n'en herite pas, donc les
# phases qui simulent un retour doivent l'avoir pose avant le chargement.
STASH = """try{sessionStorage.setItem('csDuoFlow', JSON.stringify({their_name:'Marie', your_name:'Thomas', relationship:'Wife', genre:'Pop', voice:'Duet', language:'French', email:'thomas@exemple.com'}));}catch(e){}"""

# On intercepte l'envoi natif au lieu de le laisser naviguer, et on garde les
# champs pour les verifier. fetch est bouchonne pour la branche api_url.
STUB = """
try{localStorage.removeItem('csDuoMakeAt');}catch(e){}
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
// La generation repond une table de montage : c'est ce que le tunnel doit
// mettre de cote pour la page d'apres.
window.__take = { song: '/take/song.webm', seconds: 30, beats: [
  { at: 0, dur: 5, clip: '/take/shot1.webm', line: 'Line one', drift: 'in' },
  { at: 5, dur: 5, clip: '/take/shot2.webm', line: 'Line two', drift: 'out' }
] };
window.fetch = function (u, o) {
  window.__posts.push({ url: u, body: (o && o.body) || null });
  return Promise.resolve({ ok: true, status: 200,
    json: function () { return Promise.resolve(window.__take); } });
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
    lambda p: (p.set_input_files("[data-cs-photo]", [SHOT1, SHOT2]),
               p.wait_for_timeout(300),
               p.check("input[name=consent]")),
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
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
    pg.on("response", lambda r: errs.append("HTTP %d %s" % (r.status, r.url)) if r.status >= 400 else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.goto(BASE + "flow.html?occasion=Proposal")
    pg.wait_for_timeout(250)

    print("\n--- ECRAN 1 ---")
    check("ecran visible", steps(pg), ["1"])
    check("retour cache", pg.is_hidden("[data-cs-back]"), True)
    check("libelle bouton", pg.inner_text("[data-cs-next-label]"), "Next")
    check("barre 1/7", pg.eval_on_selector("[data-cs-bar]", "e=>Math.round(parseFloat(e.style.width))"), 14)
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
    for n in range(7):
        FILL[n](pg)
        pg.wait_for_timeout(40)
        if n == 4:
            check("message vide laisse passer (avant clic)", steps(pg), ["5"])
        if n == 5:
            print("\n--- L'ECRAN PHOTO ---")
            check("deux vignettes", pg.eval_on_selector_all("[data-cs-photo-prev] img", "e=>e.length"), 2)
            check("la grille passe a deux colonnes",
                  pg.eval_on_selector("[data-cs-photo-prev]", "e=>e.dataset.n"), "2")
            check("des dataURL, pas des blob:",
                  pg.eval_on_selector_all("[data-cs-photo-prev] img",
                                          "e=>e.every(x=>x.src.indexOf('data:image/jpeg')===0)"), True)
            check("le grand cote tombe a 1280 px",
                  pg.eval_on_selector_all("[data-cs-photo-prev] img", "e=>e.map(x=>x.naturalHeight)"), [1280, 1280])
            check("la forme est gardee",
                  pg.eval_on_selector_all("[data-cs-photo-prev] img", "e=>e.map(x=>x.naturalWidth)"), [960, 960])
            check("le champ n'est plus obligatoire",
                  pg.eval_on_selector("[data-cs-photo]", "e=>e.hasAttribute('data-req')"), False)
            check("libelle a deux photos", pg.inner_text("[data-cs-photo-label]"), "2 photos added — tap to change")
            check("gardees pour la page d'apres",
                  pg.evaluate("JSON.parse(sessionStorage.getItem('csDuoPhotos')||'[]').length"), 2)
        pg.click("[data-cs-next]")
        pg.wait_for_timeout(220)
        if n == 0:
            check("passe a l'ecran 2", steps(pg), ["2"])
            check("retour visible", pg.is_visible("[data-cs-back]"), True)
        if n == 4:
            check("arrive a l'ecran photo", steps(pg), ["6"])
        if n == 5:
            check("arrive a l'ecran 7", steps(pg), ["7"])
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
    check("le corps dit combien de photos", "Photos: 2 added by the visitor" in body, True)
    check("et pourquoi elles ne sont pas la", "cannot carry files" in body, True)
    check("et quoi faire pour les recevoir", "Fill in the API URL" in body, True)
    check("ecran d'envoi pendant la navigation", pg.is_visible("[data-cs-wait]"), True)

    print("\n--- CE QUI EST MIS DE COTE POUR LA PAGE D'APRES ---")
    stash = pg.evaluate("JSON.parse(sessionStorage.getItem('csDuoFlow'))")
    for k, v in (("their_name", "Marie"), ("your_name", "Thomas"), ("relationship", "Wife"),
                 ("genre", "Pop"), ("voice", "Duet"), ("language", "French"),
                 ("occasion", "Other"), ("occasion_other", "Le jour ou on a adopte le chien")):
        check("l'onglet garde " + k, stash.get(k), v)
    check("le message vide n'y est pas", "message" in stash, False)

    print("\n--- L'ATTENTE, SUR LA MEME PAGE ---")
    pg.goto(BASE + "flow.html?contact_posted=true")
    pg.wait_for_timeout(600)
    check("on ne quitte pas la page", pg.url.endswith("flow.html?contact_posted=true"), True)
    check("l'attente est affichee", pg.is_visible("[data-cs-mk]"), True)
    check("le formulaire a disparu", pg.is_hidden(".cs-flow-form"), True)
    check("la barre du tunnel a disparu", pg.is_hidden(".cs-flow-top"), True)
    check("titre", pg.inner_text(".cs-flow-mk-h"), "Your words are becoming a music video.")
    check("seconde ligne en coraille",
          pg.eval_on_selector(".cs-flow-mk-sub", "e=>getComputedStyle(e).color"), "rgb(236, 91, 60)")
    check("le clip n'est charge qu'a cet instant",
          pg.eval_on_selector(".cs-flow-mk-v", "e=>e.getAttribute('src')"), "/clip.webm")
    check("il demarre muet", pg.eval_on_selector(".cs-flow-mk-v", "e=>e.muted"), True)
    check("encart visible", pg.is_visible("[data-cs-mk-note]"), True)
    check("pas encore de bouton", pg.is_hidden("[data-cs-mk-go]"), True)
    print("   etape:", pg.inner_text("[data-cs-mk-stage]"), "| barre:", pg.inner_text("[data-cs-mk-pct]"),
          "| horloge:", pg.inner_text("[data-cs-mk-clock]"))

    print("\n--- A MI-PARCOURS, PUIS A 100 % ---")
    mid = ctx.new_page()
    # La barre fait trois minutes : la moitie, c'est 90 secondes restantes.
    mid.add_init_script("try{localStorage.setItem('csDuoMakeAt', String(Date.now()+90000));}catch(e){}\n" + STASH)
    mid.goto(BASE + "flow.html?contact_posted=true")
    mid.wait_for_timeout(700)
    pct = int(mid.inner_text("[data-cs-mk-pct]").rstrip("%"))
    check("la moitie de la barre", 45 <= pct <= 55, True)
    check("toujours pas de bouton", mid.is_hidden("[data-cs-mk-go]"), True)
    mid.reload(); mid.wait_for_timeout(700)
    check("le rechargement ne remet pas la barre a zero",
          int(mid.inner_text("[data-cs-mk-pct]").rstrip("%")) >= pct, True)

    full = ctx.new_page()
    full.add_init_script("try{localStorage.setItem('csDuoMakeAt', String(Date.now()-500));}catch(e){}\n" + STASH)
    full.goto(BASE + "flow.html?contact_posted=true")
    full.wait_for_timeout(900)
    check("barre pleine", full.inner_text("[data-cs-mk-pct]"), "100%")
    # La barre est pleine, mais la video d'attente joue encore : rien ne
    # s'ouvre tant qu'elle n'est pas allee au bout.
    playing = full.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');return !!v&&!v.paused&&!v.ended})()")
    check("la video d'attente joue encore", playing, True)
    check("donc pas encore de bouton", full.is_hidden("[data-cs-mk-go]"), True)
    full.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');v.currentTime=Math.max(0,v.duration-0.15)})()")
    full.wait_for_timeout(1400)
    check("la video est allee au bout", full.evaluate("document.querySelector('.cs-flow-mk-v').loop"), True)
    check("le bouton apparait", full.is_visible("[data-cs-mk-go]"), True)
    check("l'encart cede la place", full.is_hidden("[data-cs-mk-note]"), True)
    check("libelle du bouton", full.inner_text("[data-cs-mk-go]").strip(), "Your music video preview")
    check("il emporte le prenom", full.get_attribute("[data-cs-mk-go]", "href"),
          "/pages/couples-preview?name=Marie")
    check("l'attente reste en place", full.is_visible(".cs-flow-mk-stage"), True)

    print("\n--- LE BOUTON MENE A LA PAGE D'APRES ---")
    full.click("[data-cs-mk-go]")
    full.wait_for_load_state()
    full.wait_for_timeout(700)
    check("on y est", full.url.endswith("/pages/couples-preview?name=Marie"), True)
    check("la page est ouverte d'entree", full.get_attribute("html", "data-cs-lock"), "0")
    check("le titre reprend le prenom", full.inner_text(".cs-pvs-title"), "Marie's Unique Music Video")

    print("\n--- L'ECRAN PHOTO BLOQUE, ET SES MESSAGES ---")
    ph = ctx.new_page()
    ph.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    ph.goto(BASE + "flow-api.html")
    ph.wait_for_timeout(250)
    for n in range(5):
        FILL[n](ph)
        ph.wait_for_timeout(40)
        ph.click("[data-cs-next]")
        ph.wait_for_timeout(200)
    check("on est sur l'ecran photo", steps(ph), ["6"])
    check("le champ est obligatoire au depart",
          ph.eval_on_selector("[data-cs-photo]", "e=>e.hasAttribute('data-req')"), True)
    check("aucune vignette", ph.is_hidden("[data-cs-photo-prev]"), True)
    ph.click("[data-cs-next]")
    ph.wait_for_timeout(120)
    check("sans photo, ca bloque", steps(ph), ["6"])
    check("et le message parle de photo", ph.inner_text("[data-cs-err]"), "Add at least one photo to continue.")

    ph.set_input_files("[data-cs-photo]", [SHOT1, SHOT2, SHOT3])
    ph.wait_for_timeout(400)
    check("trois fichiers, deux gardes", ph.eval_on_selector_all("[data-cs-photo-prev] img", "e=>e.length"), 2)
    check("et on le dit", ph.inner_text("[data-cs-err]"), "Two photos is the maximum — we kept the first two.")
    ph.click("[data-cs-next]")
    ph.wait_for_timeout(120)
    check("sans le consentement, ca bloque", steps(ph), ["6"])
    check("message du consentement", ph.inner_text("[data-cs-err]"),
          "Please tick the box so we can use your photo.")
    ph.check("input[name=consent]")
    ph.click("[data-cs-next]")
    ph.wait_for_timeout(200)
    check("coche, ca passe", steps(ph), ["7"])

    print("\n--- UNE PHOTO SEULE, ET UN RECHARGEMENT ---")
    ph.click("[data-cs-back]")
    ph.wait_for_timeout(160)
    ph.set_input_files("[data-cs-photo]", [SHOT1])
    ph.wait_for_timeout(300)
    check("une vignette", ph.eval_on_selector_all("[data-cs-photo-prev] img", "e=>e.length"), 1)
    check("une seule colonne", ph.eval_on_selector("[data-cs-photo-prev]", "e=>e.dataset.n"), "1")
    check("libelle a une photo", ph.inner_text("[data-cs-photo-label]"), "1 photo added — tap to change")
    ph.reload()
    ph.wait_for_timeout(300)
    check("le rechargement garde la photo",
          ph.eval_on_selector_all("[data-cs-photo-prev] img", "e=>e.length"), 1)
    check("et ne la redemande pas",
          ph.eval_on_selector("[data-cs-photo]", "e=>e.hasAttribute('data-req')"), False)
    check("le champ fichier, lui, est vide",
          ph.eval_on_selector("[data-cs-photo]", "e=>e.value"), "")

    print("\n--- LA BRANCHE api_url : UN SEUL JSON ---")
    ap = ctx.new_page()
    ap.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    ap.goto(BASE + "flow-api.html")
    ap.wait_for_timeout(250)
    for n in range(7):
        FILL[n](ap)
        ap.wait_for_timeout(40)
        ap.click("[data-cs-next]")
        ap.wait_for_timeout(220)
    posts = ap.evaluate("window.__posts")
    api_posts = [x for x in posts if str(x["url"]).startswith("/fake-api")]
    lead = [x for x in posts if str(x["url"]) == "/contact"]
    check("un seul envoi a l'API", len(api_posts), 1)
    check("vers l'endpoint du reglage", api_posts[0]["url"], "/fake-api")
    check("aucun envoi natif qui quitterait la page", ap.evaluate("window.__submits.length"), 0)
    check("le prospect part aussi, par fetch", len(lead), 1)
    check("on n'a pas quitte la page", ap.url.endswith("flow-api.html"), True)
    posts = api_posts
    sent = __import__("json").loads(posts[0]["body"])
    check("deux photos comptees", sent.get("photo_count"), 2)
    check("la premiere en dataURL", str(sent.get("photo", ""))[:15], "data:image/jpeg")
    check("la seconde aussi", str(sent.get("photo2", ""))[:15], "data:image/jpeg")
    check("les reponses voyagent avec", sent.get("their_name"), "Marie")
    check("le consentement aussi", sent.get("consent"), "Yes")
    check("pas de champ fichier dans le JSON", "photos" in sent, False)

    print("\n--- LA TABLE DE MONTAGE RENDUE PAR L'API ---")
    kept = ap.evaluate("JSON.parse(sessionStorage.getItem('csDuoTake')||'null')")
    check("elle est mise de cote", bool(kept), True)
    check("avec ses deux plans", len(kept["beats"]), 2)
    check("et sa chanson", kept["song"], "/take/song.webm")
    check("l'ecran d'attente s'affiche quand meme", ap.is_visible("[data-cs-mk]"), True)

    print("\n--- LEUR PHOTO PREND LA PLACE DU CADRE VIDE ---")
    check("plus de cadre vide", ap.eval_on_selector_all(".cs-flow-mk-empty", "e=>e.length"), 0)
    check("leur photo est dedans",
          ap.eval_on_selector(".cs-flow-mk-mine img", "e=>e.src.slice(0,15)"), "data:image/jpeg")
    check("elle remplit le cadre",
          ap.eval_on_selector(".cs-flow-mk-mine img", "e=>getComputedStyle(e).objectFit"), "cover")
    ap.screenshot(path=D + "shot-mk-photo.png", full_page=True)

    print("\n--- DANS L'EDITEUR DE THEME : PAS DE SAUT DE PAGE ---")
    ed = ctx.new_page()
    ed.add_init_script("window.Shopify = { designMode: true };")
    ed.goto(BASE + "flow.html")
    ed.wait_for_timeout(250)
    for n in range(7):
        FILL[n](ed)
        ed.wait_for_timeout(40)
        ed.click("[data-cs-next]")
        ed.wait_for_timeout(200)
    check("rien n'est envoye", ed.evaluate("window.__submits.length + window.__posts.length"), 0)
    check("on reste sur la page du tunnel", ed.url.endswith("flow.html"), True)
    check("l'attente s'affiche quand meme", ed.is_visible("[data-cs-mk]"), True)
    check("la note dit pourquoi",
          "nothing was sent" in ed.inner_text("[data-cs-editnote]"), True)
    ed.screenshot(path=D + "shot-editor.png", full_page=True)

    check("aucune erreur console", errs, [])
    b.close()

print("\n" + ("TOUT PASSE" if ok else "ECHECS CI-DESSUS"))
sys.exit(0 if ok else 1)
