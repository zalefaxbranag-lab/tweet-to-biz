#!/usr/bin/env python3
"""L'attente de 30 secondes, puis toute la page qui s'ouvre dessous, sans clic.

Joue dans Chromium avec les VRAIS gabarits et la VRAIE preview de l'associe
(sa section, son JS, sa CSS, telles que sur le live). Seul son studio (le
worker Cloudflare) est remplace par un faux, servi par le test : aucune
generation reelle, aucun appel au vrai worker. L'horloge de la page est
simulee : trente secondes se jouent en un instant.

    python3 qa/live30_drive.py
"""
import json
import os
import re
import struct
import subprocess
import sys
import zlib

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_live30  # noqa: E402
import serve  # noqa: E402

D = build_live30.OUT + "/"
if not os.path.exists(D + "take/scene6.png"):
    subprocess.run([sys.executable, os.path.join(HERE, "mk_take.py")], check=True, stdout=subprocess.DEVNULL)
build_live30.main()

serve.ROUTES["/pages/couples-start"] = "/live30-onepage.html"
serve.ROUTES["/pages/couples-preview"] = "/live30-preview.html"
serve.ROUTES["/pages/flow-only"] = "/live30-flowonly.html"
serve.ROUTES["/pages/no-clip"] = "/live30-noclip.html"
serve.ROUTES["/pages/editor"] = "/live30-editor.html"
_srv, BASE = serve.start(D)

ok = True


def check(label, got, want):
    global ok
    good = got == want
    ok = ok and good
    print(("  OK   " if good else "  FAIL ") + label + f"  -> {got!r}"
          + ("" if good else f"  (attendu {want!r})"))


def png(path, w, h, rgb):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
    return path


# Des aplats de couleur, jamais une vraie photo.
SHOT1 = png(D + "l30a.png", 1200, 900, (200, 140, 110))
SHOT2 = png(D + "l30b.png", 1200, 900, (110, 140, 200))

FILL = [
    lambda p: (p.check("input[name=relationship][value=Wife]"),
               p.fill("input[name=their_name]", "Marie"),
               p.fill("input[name=your_name]", "Thomas"),
               p.check("input[name=occasion][value=Anniversary]")),
    lambda p: (p.check("input[name=genre][value=Pop]"), p.check("input[name=voice][value=Duet]")),
    lambda p: p.fill("textarea[name=qualities]", "She laughs before the punchline."),
    lambda p: p.fill("textarea[name=story]", "A missed train in Lyon, 2019."),
    lambda p: p.fill("textarea[name=message]", "I would miss that train again."),
    lambda p: (p.set_input_files("[data-cs-photo]", [SHOT1, SHOT2]), p.wait_for_timeout(500),
               p.check("input[name=consent]")),
    lambda p: (p.fill("input[name=email]", "thomas@craftstory.co"),
               p.select_option("select[name=language]", "English")),
]
BELOW = ["song", "offer", "reviews", "faq", "help"]


def sec(key):
    return "#shopify-section-template--mock__" + key


def shown(p, key):
    return p.is_visible(sec(key))


def walk(p, last=True):
    for n in range(7):
        FILL[n](p)
        p.wait_for_timeout(60)
        if n < 6 or last:
            p.click("[data-cs-next]")
        p.wait_for_timeout(160)


# ------------------------------------------------------------ le faux studio
class Studio:
    """Le worker de l'associe, imite : POST /v1/previews, GET /v1/previews/<id>."""

    def __init__(self):
        self.posts = []
        self.gets = []
        self.hold = []
        self.mode = "ok"         # ok | hold | fail
        self.gen = "ok"          # ok | failed : la fabrication echoue chez le studio
        self.steps = {}          # id -> nombre de lectures

    def job(self, n):
        return ("%064x" % (0xabc000 + n), "%064x" % (0xdef000 + n))

    def state(self, jid):
        k = self.steps.get(jid, 0)
        self.steps[jid] = k + 1
        if self.gen == "failed" and k >= 2:
            return {"status": "failed", "planReady": True, "names": ["Marie", "Thomas"],
                    "scenes": [{"state": "failed"}] * 4, "createdAt": 0,
                    "error": "We could not finish this preview."}
        scenes = [{"state": "pending", "caption": "Scene %d" % (i + 1)} for i in range(4)]
        d = {"status": "running", "planReady": k >= 1, "names": ["Marie", "Thomas"],
             "scenes": scenes, "createdAt": 0}
        if k >= 2:
            d["avatar"] = BASE + "/take/scene5.png"
        if k >= 3:
            d["music"] = BASE + "/take/song.webm"
        for i in range(4):
            if k >= 4 + i:
                scenes[i] = {"state": "done", "url": BASE + "/take/scene%d.png" % (i + 1),
                             "caption": "Moment %d" % (i + 1)}
        if k >= 8:
            d["status"] = "ready"
            d["title"] = "Marie & Thomas"
        return d

    def handle(self, route):
        req = route.request
        cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS"}
        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        if req.method == "POST" and req.url.endswith("/v1/previews"):
            self.posts.append({"body": json.loads(req.post_data or "{}"),
                               "key": req.headers.get("idempotency-key", "")})
            if self.mode == "hold":
                self.hold.append(route)
                return None
            if self.mode == "fail":
                return route.fulfill(status=422, headers=cors, content_type="application/json",
                                     body=json.dumps({"error": "We could not use that photo. Please try another one."}))
            jid, tok = self.job(len(self.posts))
            return route.fulfill(status=200, headers=cors, content_type="application/json",
                                 body=json.dumps({"id": jid, "token": tok, "expiresAt": 0}))
        m = re.search(r"/v1/previews/([a-f0-9]{64})$", req.url)
        if req.method == "GET" and m:
            self.gets.append(m.group(1))
            return route.fulfill(status=200, headers=cors, content_type="application/json",
                                 body=json.dumps(self.state(m.group(1))))
        return route.fulfill(status=404, headers=cors, body="{}")

    def release(self):
        while self.hold:
            r = self.hold.pop(0)
            jid, tok = self.job(len(self.posts))
            r.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*"}, content_type="application/json",
                      body=json.dumps({"id": jid, "token": tok, "expiresAt": 0}))


def gate(p):
    return p.get_attribute("html", "data-cs-duo-gate")


def pct(p):
    return int(p.inner_text("[data-cs-mk-pct]").rstrip("%"))


def run(p, ms, step=1000):
    """Avance l'horloge de la page par petits pas, en laissant le reseau (reel)
    repondre entre deux : sinon les lectures du studio s'empilent."""
    left = ms
    while left > 0:
        d = min(step, left)
        p.clock.run_for(d)
        p.wait_for_timeout(40)
        left -= d


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                           args=["--autoplay-policy=no-user-gesture-required"])
    errs = []

    def context():
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        st = Studio()
        ctx.route("https://fake-studio.test/**", st.handle)
        return ctx, st

    def page(ctx):
        p = ctx.new_page()
        p.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
        p.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text and "422" not in m.text else None)
        p.clock.install()
        return p


    def freeze(p):
        """Arrete l'horloge de la page : seul run() la fait avancer. Sans ca
        elle continue de tourner pendant les attentes reelles du test."""
        p.clock.pause_at(p.evaluate("Date.now()") + 50)

    # ================================================================ A
    print("\n--- A. AVANT : LE TUNNEL SEUL, TOUT LE RESTE EST CACHE ---")
    ctx, st = context()
    p = page(ctx)
    p.goto(BASE + "/pages/couples-start")
    p.wait_for_timeout(500)
    freeze(p)
    check("le verrou est pose des le HTML", gate(p), "closed")
    check("le questionnaire est la", p.is_visible("[data-cs-form]"), True)
    check("rien dessous : preview, offre, avis, FAQ, aide", [shown(p, k) for k in BELOW], [False] * 5)
    check("la preview de l'associe a demarre sans rien a suivre", p.get_attribute("[data-couples-preview]", "data-view"), "empty")
    check("aucune lecture du studio avant l'envoi", len(st.gets), 0)

    print("\n--- A. LE DERNIER CLIC : L'ATTENTE, TOUT DE SUITE ---")
    walk(p)
    check("l'attente est a l'ecran au clic", p.is_visible("[data-cs-mk]"), True)
    check("le questionnaire a disparu", p.is_hidden("[data-cs-form]"), True)
    check("toujours la meme page", p.url.split("#")[0].endswith("/pages/couples-start"), True)
    check("rien dessous pendant l'attente", [shown(p, k) for k in BELOW], [False] * 5)
    check("le clip d'attente joue", p.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');return !!v && !!v.src && !v.paused})()"), True)
    check("la notice est la", p.inner_text("[data-cs-mk-note] p"), "⚡ Your free preview appears just below when the bar is full.")
    check("pas de ligne « c'est pret » pendant l'attente", p.is_hidden("[data-cs-mk-ready]"), True)
    p.wait_for_timeout(1200)
    check("la preview est lancee chez le studio, une fois", len(st.posts), 1)
    sent = st.posts[0]["body"] if st.posts else {}
    check("avec les deux photos et leurs reponses",
          [sent.get("photo", "")[:15], sent.get("photo2", "")[:15], sent.get("their_name"), sent.get("occasion")],
          ["data:image/jpeg", "data:image/jpeg", "Marie", "Anniversary"])
    job = p.evaluate("JSON.parse(sessionStorage.getItem('csCouplesPreview')||'null')")
    check("la preview est gardee dans l'onglet", bool(job and job.get("id")), True)
    check("et marquee comme devoilee d'avance (pas de clic pour la voir)",
          p.evaluate("JSON.parse(sessionStorage.getItem('csCouplesRevealed')||'null')") == (job or {}).get("id"), True)
    check("la section de la preview a redemarre sur elle, cachee", p.get_attribute("[data-couples-preview]", "data-view"), "loading")
    run(p, 12000)
    check("elle suit la fabrication pendant l'attente", len(st.gets) >= 2, True)
    check("a 12 s : toujours ferme", [gate(p), shown(p, "song")], ["closed", False])
    check("la barre avance, pas pleine", 35 <= pct(p) <= 45, True)

    print("\n--- A. A 30 SECONDES : TOUT S'OUVRE DESSOUS, SANS CLIC ---")
    run(p, 16500)
    check("a 28,5 s : encore ferme", gate(p), "closed")
    top_before = p.evaluate("window.scrollY")
    run(p, 2000)
    check("a 30,5 s : le verrou est leve", gate(p), None)
    check("la barre est pleine", pct(p), 100)
    check("la preview est visible dessous", shown(p, "song"), True)
    check("« descends » s'affiche, sans bouton", [p.is_visible("[data-cs-mk-ready]"), p.eval_on_selector_all("[data-cs-mk-go]", "e=>e.length")], [True, 0])
    check("la notice a cede la place", p.is_hidden("[data-cs-mk-note]"), True)
    p.wait_for_timeout(900)
    check("la page descend seule jusqu'a la preview", p.evaluate("window.scrollY") > top_before + 200, True)
    check("la preview est encore en fabrication a 30 s", p.get_attribute("[data-couples-preview]", "data-view"), "loading")
    check("l'offre attend que la preview soit devoilee (regle de l'associe)", shown(p, "offer"), False)
    check("l'ouverture est gardee pour un rechargement", p.evaluate("sessionStorage.getItem('csDuoOpen')"), "1")

    print("\n--- A. LA PREVIEW SE DEVOILE SEULE QUAND ELLE EST PRETE ---")
    run(p, 40000, 2000)
    view = p.get_attribute("[data-couples-preview]", "data-view")
    check("la preview est devoilee, sans le bouton « Reveal »", view, "result")
    check("le bouton « Reveal » n'a jamais servi", p.is_hidden("[data-reveal]"), True)
    check("tout le reste de la page est la", [shown(p, k) for k in BELOW], [True] * 5)
    check("l'offre porte son prenom", p.inner_text(sec("offer") + " .cs-pvo-cta [data-cs-tpl]"), "Unlock Marie's full music video")
    check("son titre et sa chanson sont la",
          [p.inner_text("[data-couples-preview] [data-title]"), p.get_attribute("[data-couples-preview] audio", "src")],
          ["Marie & Thomas", BASE + "/take/song.webm"])

    print("\n--- A. LEUR CHANSON COUPE LE CLIP D'ATTENTE ---")
    p.evaluate("document.querySelector('.cs-flow-mk-v').muted=false")
    p.click("[data-couples-preview] [data-play]")
    p.wait_for_timeout(400)
    check("le clip d'attente s'est mis en pause", p.evaluate("document.querySelector('.cs-flow-mk-v').paused"), True)
    check("leur chanson joue", p.evaluate("!document.querySelector('[data-couples-preview] audio').paused"), True)

    print("\n--- A. RECHARGEMENT : LA PAGE RESTE OUVERTE ---")
    p.reload()
    p.wait_for_timeout(800)
    check("pas de verrou", gate(p), None)
    check("pas de retour au questionnaire", [p.is_hidden("[data-cs-form]"), p.is_visible("[data-cs-mk]")], [True, True])
    check("la barre est pleine, la ligne est la", [pct(p), p.is_visible("[data-cs-mk-ready]")], [100, True])
    check("le clip ne repart pas tout seul", p.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');return !v.src || v.paused})()"), True)
    run(p, 6000)
    check("la preview revient devoilee directement", p.get_attribute("[data-couples-preview]", "data-view"), "result")
    check("et tout le reste avec", [shown(p, k) for k in BELOW], [True] * 5)
    check("le marqueur anti-flash est retire", p.get_attribute("html", "data-cs-duo-resume"), None)

    print("\n--- A. « BACK TO THE QUESTIONNAIRE » : ON REPART DE ZERO ICI ---")
    p.click("[data-couples-preview] .cp-links a")
    p.wait_for_timeout(800)
    check("le questionnaire revient, au premier ecran", [p.is_visible("[data-cs-form]"), p.is_visible(".cs-flow-step:not([hidden])")], [True, True])
    check("tout est de nouveau ferme dessous", [gate(p)] + [shown(p, k) for k in BELOW], ["closed"] + [False] * 5)
    check("toujours la meme page", p.url, BASE + "/pages/couples-start")
    ctx.close()

    # ================================================================ B
    print("\n--- B. STUDIO LENT : LA BARRE ATTEND A 99 %, PUIS S'OUVRE ---")
    ctx, st = context()
    st.mode = "hold"
    p = page(ctx)
    p.goto(BASE + "/pages/couples-start")
    p.wait_for_timeout(400)
    freeze(p)
    walk(p)
    run(p, 32000)
    check("a 32 s sans preview lancee : 99 %, ferme", [pct(p), gate(p)], [99, "closed"])
    check("l'etape dit « presque »", p.inner_text("[data-cs-mk-stage]"), "Almost there…")
    run(p, 8000)
    st.release()
    p.wait_for_timeout(1200)
    run(p, 1000)
    check("des que la preview part : ouvert", [gate(p), shown(p, "song"), pct(p)], [None, True, 100])
    check("et jamais sur son ecran vide « Your story starts here »", p.get_attribute("[data-couples-preview]", "data-view"), "loading")
    ctx.close()

    # ================================================================ C
    print("\n--- C. LE STUDIO REFUSE : RETOUR AU FORMULAIRE, AVEC SON MESSAGE ---")
    ctx, st = context()
    st.mode = "fail"
    p = page(ctx)
    p.goto(BASE + "/pages/couples-start")
    p.wait_for_timeout(400)
    freeze(p)
    walk(p)
    p.wait_for_timeout(1200)
    check("retour au formulaire", [p.is_visible("[data-cs-form]"), p.is_hidden("[data-cs-mk]")], [True, True])
    check("avec le message du studio", p.inner_text("[data-cs-err]"), "We could not use that photo. Please try another one.")
    check("rien ne s'ouvre dessous", [gate(p), shown(p, "song")], ["closed", False])
    check("le bouton se reclique", p.is_enabled("[data-cs-next]"), True)
    st.mode = "ok"
    p.click("[data-cs-next]")
    p.wait_for_timeout(1200)
    run(p, 31000)
    check("au second essai : attente puis ouverture", [gate(p), shown(p, "song")], [None, True])
    check("et le clip d'attente est reparti", p.evaluate("!document.querySelector('.cs-flow-mk-v').paused"), True)
    check("meme cle d'idempotence (pas de double preview)", st.posts[0]["key"] == st.posts[1]["key"], True)
    ctx.close()

    # ================================================================ D
    print("\n--- D. LE STUDIO NE REPOND JAMAIS : UNE MINUTE AU PLUS ---")
    ctx, st = context()
    st.mode = "hold"
    p = page(ctx)
    p.goto(BASE + "/pages/couples-start")
    p.wait_for_timeout(400)
    freeze(p)
    walk(p)
    run(p, 44000)
    check("a 44 s : on attend encore, a 99 %", [p.is_visible("[data-cs-mk]"), pct(p)], [True, 99])
    run(p, 17000)
    check("a 61 s au plus tard : retour au formulaire, message lisible", [p.is_visible("[data-cs-form]"), p.inner_text("[data-cs-err]")],
          [True, "We could not send that. Check your connection and try again."])
    st.release()
    p.wait_for_timeout(800)
    run(p, 31000)
    check("une reponse tardive ne rouvre rien", [gate(p), p.is_visible("[data-cs-form]")], ["closed", True])
    ctx.close()

    # ================================================================ E
    print("\n--- E. LE TUNNEL SEUL SUR SA PAGE : LA PREVIEW S'OUVRE D'ELLE-MEME ---")
    ctx, st = context()
    p = page(ctx)
    p.goto(BASE + "/pages/flow-only")
    p.wait_for_timeout(400)
    freeze(p)
    walk(p)
    p.wait_for_timeout(1200)
    run(p, 20000)
    check("a 20 s : toujours sur le tunnel", p.url.endswith("/pages/flow-only"), True)
    with p.expect_navigation():
        run(p, 11000)
    p.wait_for_timeout(600)
    check("a 30 s : la page de la preview, sans clic", p.url.split("#")[0], BASE + "/pages/couples-preview")
    check("avec la preview dans l'adresse", bool(re.search(r"#preview=[a-f0-9]{64}\.[a-f0-9]{64}$", p.url)), True)
    run(p, 40000, 2000)
    check("elle s'y devoile seule, elle aussi", p.get_attribute("[data-couples-preview]", "data-view"), "result")
    p.go_back()
    p.wait_for_timeout(1500)
    check("retour arriere : le questionnaire, sans rebond vers la preview",
          [p.url.split("#")[0], p.is_visible("[data-cs-form]")], [BASE + "/pages/flow-only", True])
    ctx.close()

    # ================================================================ F
    print("\n--- F. SANS CLIP : LEUR PHOTO DANS LE CADRE ---")
    ctx, st = context()
    p = page(ctx)
    p.goto(BASE + "/pages/no-clip")
    p.wait_for_timeout(400)
    walk(p)
    check("leur photo occupe le cadre", p.evaluate("(document.querySelector('.cs-flow-mk-ph')||{}).src||''")[:15], "data:image/jpeg")
    p.wait_for_timeout(1200)
    p.reload()
    p.wait_for_timeout(800)
    check("rechargement : l'attente reprend", p.is_visible("[data-cs-mk]"), True)
    check("et la consigne « upload an MP4 » n'apparait jamais", p.is_visible("text=Your video goes here"), False)
    ctx.close()

    # ================================================================ G
    print("\n--- G. DANS L'EDITEUR : AUCUN VERROU ---")
    ctx, st = context()
    p = page(ctx)
    p.goto(BASE + "/pages/editor")
    p.wait_for_timeout(500)
    check("pas de verrou", gate(p), None)
    check("toutes les sections se voient, offre comprise", [shown(p, k) for k in BELOW], [True] * 5)
    ctx.close()

    # ================================================================ H
    print("\n--- H. ONGLET QUI REFUSE DE RIEN GARDER : LA PREVIEW DEMARRE QUAND MEME ---")
    ctx, st = context()
    p = page(ctx)
    p.add_init_script("Storage.prototype.setItem=function(){throw new Error('blocked')};")
    p.goto(BASE + "/pages/couples-start")
    p.wait_for_timeout(400)
    freeze(p)
    walk(p)
    p.wait_for_timeout(1200)
    run(p, 31000)
    check("a 31 s : ouvert, et la preview suit sa fabrication", [gate(p), p.get_attribute("[data-couples-preview]", "data-view")], [None, "loading"])
    check("elle lit la preview dans l'adresse", bool(re.search(r"#preview=[a-f0-9]{64}\.[a-f0-9]{64}$", p.url)), True)
    ctx.close()

    # ================================================================ I
    print("\n--- I. LA FABRICATION ECHOUE : JAMAIS DE PAGE SANS ISSUE ---")
    ctx, st = context()
    st.gen = "failed"
    p = page(ctx)
    p.goto(BASE + "/pages/couples-start")
    p.wait_for_timeout(400)
    freeze(p)
    walk(p)
    p.wait_for_timeout(1200)
    run(p, 31000)
    check("sa preview affiche son erreur", p.get_attribute("[data-couples-preview]", "data-view"), "error")
    check("et la suite se montre : offre, avis, FAQ, aide", [shown(p, k) for k in BELOW], [True] * 5)
    ctx.close()

    print("\n--- ERREURS JS ---")
    check("aucune erreur dans la page", [e for e in errs if "favicon" not in e], [])
    b.close()

_srv.shutdown()
print("\nTOUT PASSE" if ok else "\nECHECS")
sys.exit(0 if ok else 1)
