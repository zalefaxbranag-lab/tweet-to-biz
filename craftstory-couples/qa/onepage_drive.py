#!/usr/bin/env python3
"""La page unique, de bout en bout, dans Chromium.

Le formulaire, l'attente de trois minutes, le deblocage de TOUTE la page
d'apres sur la meme page, la preview de six images sur la chanson, puis le
panier et le checkout. L'horloge de la page est simulee (Playwright clock) :
trois minutes se jouent en une seconde, sans rien changer au code teste.

La generation et Shopify sont bouchonnes dans la page : zero credit KIE,
zero commande, zero e-mail. Les images sont des aplats numerotes fabriques
par qa/mk_take.py — aucune photo reelle.
"""
import json
import os
import struct
import subprocess
import sys
import zlib

from playwright.sync_api import sync_playwright

D = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/"
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
if not os.path.exists(D + "take/scene6.png"):
    subprocess.run([sys.executable, os.path.join(HERE, "mk_take.py")], check=True, stdout=subprocess.DEVNULL)
from build_pages import main as _build
_build()
from serve import start as _serve
_srv, BASE = _serve(D)

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


SHOT1 = png(D + "op1.png", 1600, 1200, (200, 140, 110))
SHOT2 = png(D + "op2.png", 1600, 1200, (110, 140, 200))

TAKE = {
    "ready": True, "song": "/take/song.webm", "songStart": 2, "seconds": 30,
    "beats": [{"at": n * 5, "dur": 5, "clip": "", "poster": "/take/scene%d.png" % (n + 1), "line": "",
               "drift": ["in", "out"][n % 2]} for n in range(6)],
    "title": "Marie's Song", "photos": ["https://kie.files/a.jpg", "https://kie.files/b.jpg"], "job": "J1"
}

# Le faux reseau de la page : l'API de generation, le formulaire de contact
# de Shopify et son panier. Le scenario se regle avant le chargement.
STUB = """
window.__posts = []; window.__cart = []; window.__polls = 0;
window.__take = %s;
window.__readyAfter = window.__readyAfter || 3;
window.__fail = window.__fail || false;
const __real = window.fetch;
function __res(obj, url) {
  return Promise.resolve({ ok: true, status: 200, url: url || '', redirected: !!url,
    json: function () { return Promise.resolve(obj); } });
}
window.fetch = function (u, o) {
  u = String(u);
  let body = o && o.body;
  window.__posts.push({ url: u, body: typeof body === 'string' ? body : (body && body.toString ? body.toString() : null) });
  if (u.endsWith('/fake-api/start')) return __res({ job: 'J1', status: '/fake-api/status', eta: 150 });
  if (u.endsWith('/fake-api/status')) {
    window.__polls += 1;
    if (window.__fail) return __res({ ready: false, failed: true, reason: 'song' });
    if (window.__polls >= window.__readyAfter) return __res(window.__take);
    return __res({ ready: false, done: window.__polls, of: 7, job: 'J1' });
  }
  if (u === '/contact') return __res(null, location.origin + '/pages/couples-start?contact_posted=true');
  if (u.endsWith('cart/add.js')) {
    window.__cart.push(JSON.parse(o.body));
    try { sessionStorage.setItem('__cart', JSON.stringify(window.__cart)); } catch (e) {}
    return __res({ items: [] });
  }
  return __real.apply(this, arguments);
};
""" % json.dumps(TAKE)

FILL = [
    lambda p: (p.check("input[name=relationship][value=Wife]"),
               p.fill("input[name=their_name]", "Marie"),
               p.fill("input[name=your_name]", "Thomas"),
               p.check("input[name=occasion][value=Anniversary]")),
    lambda p: (p.check("input[name=genre][value=Pop]"), p.check("input[name=voice][value=Duet]")),
    lambda p: p.fill("textarea[name=qualities]", "She laughs before the punchline."),
    lambda p: p.fill("textarea[name=story]", "A missed train in Lyon, 2019."),
    lambda p: p.fill("textarea[name=message]", "I would miss that train again."),
    lambda p: (p.set_input_files("[data-cs-photo]", [SHOT1, SHOT2]), p.wait_for_timeout(400),
               p.check("input[name=consent]")),
    lambda p: (p.fill("input[name=email]", "thomas@craftstory.co"),
               p.select_option("select[name=language]", "English")),
]

BELOW = ["song", "offer", "reviews", "faq", "help"]


def sec(key):
    return "#shopify-section-template--mock__" + key


def shown(p, key):
    return p.is_visible(sec(key))


def walk(p):
    for n in range(7):
        FILL[n](p)
        p.wait_for_timeout(60)
        p.click("[data-cs-next]")
        p.wait_for_timeout(160)


def page(ctx, scenario=""):
    p = ctx.new_page()
    p.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    p.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
    # On part d'un onglet vierge, UNE fois : un rechargement ou le passage au
    # checkout gardent ce que l'onglet sait, comme dans la vraie vie.
    p.add_init_script("try{if(!sessionStorage.getItem('__init')){localStorage.clear();sessionStorage.clear();"
                      "sessionStorage.setItem('__init','1');}}catch(e){}" + scenario + STUB)
    p.clock.install()
    return p


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                           args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ctx.route("**/checkout", lambda r: r.fulfill(status=200, content_type="text/html",
                                                 body="<!doctype html><title>checkout</title><h1>CHECKOUT</h1>"))
    errs = []

    print("\n--- AVANT : LE TUNNEL SEUL, TOUT LE RESTE EST CACHE ---")
    p = page(ctx)
    p.goto(BASE + "/onepage.html")
    p.wait_for_timeout(400)
    check("le verrou est pose des le HTML", p.get_attribute("html", "data-cs-duo-gate"), "closed")
    check("le tunnel est la", p.is_visible("[data-cs-form]"), True)
    for k in BELOW:
        check("« " + k + " » est cache", shown(p, k), False)
    check("l'en-tete, au-dessus du tunnel, n'est pas touche",
          p.eval_on_selector_all(".shopify-section", "e=>e.length") >= 6, True)

    print("\n--- LE DERNIER CLIC : L'ATTENTE, TOUT DE SUITE, SUR LA MEME PAGE ---")
    walk(p)
    check("l'attente est a l'ecran", p.is_visible("[data-cs-mk]"), True)
    check("le formulaire a disparu", p.is_hidden("[data-cs-form]"), True)
    check("on n'a pas change de page", p.url.endswith("/onepage.html"), True)
    posts = p.evaluate("window.__posts")
    start = [x for x in posts if x["url"].endswith("/fake-api/start")]
    lead = [x for x in posts if x["url"] == "/contact"]
    check("la generation est lancee", len(start), 1)
    sent = json.loads(start[0]["body"])
    check("avec les deux photos", [sent.get("photo", "")[:15], sent.get("photo2", "")[:15]],
          ["data:image/jpeg", "data:image/jpeg"])
    check("et toutes leurs reponses", [sent.get(k) for k in ("their_name", "your_name", "occasion", "genre", "voice", "language")],
          ["Marie", "Thomas", "Anniversary", "Pop", "Duet", "English"])
    check("le prospect part aussi, sans quitter la page", len(lead), 1)
    check("avec leurs reponses dans le message", "Their name: Marie" in (lead[0]["body"] or "").replace("+", " ").replace("%3A", ":"), True)
    check("tout reste cache pendant l'attente", [shown(p, k) for k in BELOW], [False] * 5)

    print("\n--- PENDANT L'ATTENTE : LA PREVIEW SE PREPARE, RIEN NE S'OUVRE ---")
    p.clock.run_for(16000)
    p.wait_for_timeout(300)
    check("la page a interroge l'API toutes les 5 secondes", p.evaluate("window.__polls") >= 3, True)
    check("la preview est arrivee et gardee",
          p.evaluate("JSON.parse(sessionStorage.getItem('csDuoTake')||'{}').beats.length"), 6)
    check("elle est deja montee dessous, en six images",
          p.eval_on_selector_all(sec("song") + " [data-cs-shot] img", "e=>e.length"), 6)
    check("mais rien ne s'ouvre avant la fin de la barre", [shown(p, k) for k in BELOW], [False] * 5)
    pct = int(p.inner_text("[data-cs-mk-pct]").rstrip("%"))
    check("la barre avance, sans etre pleine", 5 <= pct <= 15, True)
    check("le rebours du tarif n'a pas encore demarre",
          p.evaluate("localStorage.getItem('csDuoDeadline')"), None)

    print("\n--- TROIS MINUTES, MAIS LA VIDEO JOUE ENCORE ---")
    # La video d'attente de test dure 8 s : on la ramene au debut pour qu'elle
    # joue encore quand la barre se remplit.
    p.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');v.currentTime=0;v.play()})()")
    p.clock.run_for(170000)
    p.wait_for_timeout(300)
    check("la barre est pleine", p.inner_text("[data-cs-mk-pct]"), "100%")
    check("on dit que c'est pret, juste apres la video",
          p.inner_text("[data-cs-mk-stage]"), "Your preview is ready — it appears right after the video.")
    check("rien n'est ouvert tant que la video n'est pas finie", [shown(p, k) for k in BELOW], [False] * 5)

    print("\n--- LA VIDEO FINIT : TOUT S'OUVRE DESSOUS ---")
    p.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');v.currentTime=Math.max(0,v.duration-0.1)})()")
    p.wait_for_timeout(900)
    p.clock.run_for(1000)
    p.wait_for_timeout(300)
    check("le verrou est leve", p.get_attribute("html", "data-cs-duo-gate"), "open")
    for k in BELOW:
        check("« " + k + " » est visible", shown(p, k), True)
    check("toujours la meme page", p.url.endswith("/onepage.html"), True)
    check("la barre dit que c'est pret", p.inner_text("[data-cs-mk-stage]"), "Your preview is ready")
    check("« c'est pret, descends » s'affiche", p.inner_text("[data-cs-mk-ready]").strip(),
          "✓ Your preview is ready — scroll down")
    check("l'avertissement « ne partez pas » a cede la place", p.is_hidden("[data-cs-mk-note]"), True)
    check("pas de bouton vers une autre page", p.is_hidden("[data-cs-mk-go]"), True)
    check("la video d'attente repart en boucle, muette",
          p.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');return [v.loop, v.muted]})()"), [True, True])
    check("le rebours du tarif demarre maintenant, pas avant",
          p.evaluate("localStorage.getItem('csDuoDeadline')") is not None, True)
    check("l'ouverture est gardee pour un rechargement", p.evaluate("sessionStorage.getItem('csDuoOpen')"), "1")
    p.screenshot(path=D + "onepage-open.png", full_page=False)

    print("\n--- LA PREVIEW : SIX IMAGES DE CINQ SECONDES SUR LA CHANSON ---")
    check("le titre porte son prenom", p.inner_text(sec("song") + " .cs-pvs-title"), "Marie's Unique Music Video")
    check("pas d'attente en double dans la section", p.eval_on_selector_all(sec("song") + " .cs-pvs-top", "e=>e.length"), 0)
    check("le cadre de montage est la", p.is_visible(sec("song") + " [data-cs-take]"), True)
    check("le cadre vide ne l'est plus", p.is_hidden(sec("song") + " [data-cs-empty]"), True)
    check("six images fixes, dans l'ordre",
          p.eval_on_selector_all(sec("song") + " [data-cs-shot] img", "e=>e.map(x=>x.getAttribute('src'))"),
          ["/take/scene%d.png" % n for n in range(1, 7)])
    check("chacune tient cinq secondes",
          p.eval_on_selector_all(sec("song") + " [data-cs-shot]", "e=>e.map(x=>x.style.getPropertyValue('--cs-dur'))"),
          ["5s"] * 6)
    check("trente secondes annoncees", p.inner_text(sec("song") + " [data-cs-dur]"), "0:30")
    check("la chanson est la", p.eval_on_selector(sec("song") + " [data-cs-audio]", "e=>e.getAttribute('src')"), "/take/song.webm")
    check("elle commence sur la voix, pas sur l'intro",
          p.eval_on_selector(sec("song") + " [data-cs-take]", "e=>e.dataset.start"), "2")
    p.click(sec("song") + " [data-cs-tap]")
    p.wait_for_timeout(700)
    p.clock.run_for(400)
    check("la chanson joue depuis la voix",
          p.eval_on_selector(sec("song") + " [data-cs-audio]", "e=>e.currentTime>=1.9&&!e.paused"), True)
    check("la premiere image est a l'ecran",
          p.eval_on_selector(sec("song") + " .cs-pvs-shot.on img", "e=>e.getAttribute('src')"), "/take/scene1.png")
    check("elle zoome doucement",
          p.eval_on_selector(sec("song") + " .cs-pvs-shot.on img", "e=>getComputedStyle(e).animationName"), "cs-pvs-zin")
    check("aucune parole, donc aucun voile sur leurs visages",
          p.eval_on_selector(sec("song") + " [data-cs-take]", "e=>e.classList.contains('cs-said')"), False)
    p.evaluate("document.querySelector('%s [data-cs-audio]').currentTime = 2 + 12" % sec("song"))
    p.wait_for_timeout(600)
    p.clock.run_for(400)
    check("a 12 s de preview : la troisieme image",
          p.eval_on_selector(sec("song") + " .cs-pvs-shot.on img", "e=>e.getAttribute('src')"), "/take/scene3.png")
    p.evaluate("document.querySelector('%s [data-cs-audio]').currentTime = 2 + 17" % sec("song"))
    p.wait_for_timeout(600)
    p.clock.run_for(400)
    check("a 17 s : la quatrieme, qui dezoome",
          p.eval_on_selector(sec("song") + " .cs-pvs-shot.on img", "e=>[e.getAttribute('src'),getComputedStyle(e).animationName]"),
          ["/take/scene4.png", "cs-pvs-zout"])
    p.evaluate("document.querySelector('%s [data-cs-audio]').currentTime = 2 + 26" % sec("song"))
    p.wait_for_timeout(600)
    p.clock.run_for(400)
    check("a 26 s : la sixieme",
          p.eval_on_selector(sec("song") + " .cs-pvs-shot.on img", "e=>getComputedStyle(e.parentNode).opacity!=='0'&&e.getAttribute('src')"), "/take/scene6.png")
    p.evaluate("document.querySelector('%s [data-cs-audio]').currentTime = 2 + 29.9" % sec("song"))
    p.wait_for_timeout(700)
    p.clock.run_for(400)
    check("a 30 s la chanson s'arrete", p.eval_on_selector(sec("song") + " [data-cs-audio]", "e=>e.paused"), True)
    check("et la proposition arrive sur la derniere image", p.is_visible(sec("song") + " [data-cs-end]"), True)
    p.click(sec("song") + " [data-cs-end] a")
    p.wait_for_timeout(600)
    check("son bouton descend jusqu'a l'offre",
          p.evaluate("(()=>{const r=document.querySelector('#cs-duo-offer').getBoundingClientRect();return r.top>=-2&&r.top<innerHeight})()"), True)
    p.screenshot(path=D + "onepage-end.png", full_page=False)

    print("\n--- LE PAIEMENT : LE PANIER, PUIS LE CHECKOUT ---")
    check("le bouton porte son prenom", p.inner_text(sec("offer") + " .cs-pvo-cta [data-cs-go]").strip(),
          "Unlock Marie's full music video")
    # On touche l'etiquette, comme un client : la vraie case est cachee sous
    # la case dessinee.
    p.click(sec("offer") + " .cs-pvo-addon")
    check("l'option est cochee", p.is_checked(sec("offer") + " [data-cs-addon]"), True)
    with p.expect_request("**/checkout"):
        p.click(sec("offer") + " .cs-pvo-cta [data-cs-go]")
    p.wait_for_timeout(400)
    check("on arrive au checkout", p.url.endswith("/checkout"), True)

    print("\n--- CE QUE LE PANIER A RECU ---")
    # La page a change : on relit le panier dans l'onglet, ou le faux reseau
    # l'a garde avant le depart.
    cart = p.evaluate("JSON.parse(sessionStorage.getItem('__cart')||'[]')")
    check("un seul ajout au panier", len(cart), 1)
    items = cart[0]["items"]
    check("la vitesse choisie : 30 minutes", [items[0]["id"], items[0]["quantity"]], [58564120510795, 1])
    check("et l'option cochee : les paroles", [len(items), items[1]["id"] if len(items) > 1 else None], [2, 58564120936779])
    pr = items[0]["properties"]
    check("pour qui, de la part de qui", [pr.get("For"), pr.get("From")], ["Marie", "Thomas"])
    check("l'occasion, la langue, le genre, la voix",
          [pr.get("Occasion"), pr.get("Song language"), pr.get("Genre"), pr.get("Voice")],
          ["Anniversary", "English", "Pop", "Duet"])
    check("leur histoire, pour l'atelier", pr.get("_Story"), "A missed train in Lyon, 2019.")
    check("ce qu'ils aiment", pr.get("_What they love"), "She laughs before the punchline.")
    check("leur message", pr.get("_Message"), "I would miss that train again.")
    check("la chanson de la preview", pr.get("_Preview song"), "/take/song.webm")
    check("les six scenes", pr.get("_Preview scenes", "").split(" "), ["/take/scene%d.png" % n for n in range(1, 7)])
    check("les liens des photos", pr.get("_Photos"), "https://kie.files/a.jpg https://kie.files/b.jpg")
    check("rien d'intime n'est montre au client : tout est en « _ »",
          sorted(k for k in pr if not k.startswith("_")), ["For", "From", "Genre", "Occasion", "Song language", "Voice"])

    print("\n--- LA VITESSE 48 H ---")
    p2 = page(ctx)
    p2.goto(BASE + "/onepage.html")
    p2.wait_for_timeout(300)
    walk(p2)
    p2.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');v.pause();v.currentTime=0})()")
    p2.clock.run_for(185000)
    p2.wait_for_timeout(500)
    p2.clock.run_for(1000)
    # La video a ete arretee a 0 et n'a jamais joue (lecture automatique
    # refusee, mode economie d'energie) : la page s'ouvre quand meme.
    check("une video que le telephone refuse de lancer ne bloque personne",
          p2.get_attribute("html", "data-cs-duo-gate"), "open")
    p2.click(sec("offer") + " .cs-pvo-opt:nth-of-type(2)")
    with p2.expect_request("**/checkout"):
        p2.click(sec("offer") + " .cs-pvo-cta [data-cs-go]")
    p2.wait_for_timeout(300)
    cart2 = p2.evaluate("JSON.parse(sessionStorage.getItem('__cart')||'[]')")
    check("48 h : sa variante, sans option", [x["id"] for x in cart2[0]["items"]], [58564120543563])

    print("\n--- LA PREVIEW EN RETARD : LA BARRE ATTEND A 99 % ---")
    p3 = page(ctx, "window.__readyAfter = 45;")
    p3.goto(BASE + "/onepage.html")
    p3.wait_for_timeout(300)
    walk(p3)
    p3.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');v.pause();v.currentTime=0})()")
    p3.clock.run_for(185000)
    p3.wait_for_timeout(400)
    check("trois minutes passees, mais la barre dit 99 %", p3.inner_text("[data-cs-mk-pct]"), "99%")
    check("sur la derniere etape", p3.inner_text("[data-cs-mk-stage]"), "Almost there…")
    check("rien n'est ouvert", p3.get_attribute("html", "data-cs-duo-gate"), "closed")
    p3.clock.run_for(60000)
    p3.wait_for_timeout(500)
    p3.clock.run_for(1000)
    check("la preview arrive : 100 %", p3.inner_text("[data-cs-mk-pct]"), "100%")
    check("et tout s'ouvre", p3.get_attribute("html", "data-cs-duo-gate"), "open")

    print("\n--- LA GENERATION ECHOUE : ON OUVRE QUAND MEME, ET ON LE DIT ---")
    p4 = page(ctx, "window.__fail = true;")
    p4.goto(BASE + "/onepage.html")
    p4.wait_for_timeout(300)
    walk(p4)
    p4.evaluate("(()=>{const v=document.querySelector('.cs-flow-mk-v');v.pause();v.currentTime=0})()")
    p4.clock.run_for(185000)
    p4.wait_for_timeout(500)
    p4.clock.run_for(1000)
    check("ouvert quand meme", p4.get_attribute("html", "data-cs-duo-gate"), "open")
    check("pas de cadre de montage vide", p4.is_hidden(sec("song") + " [data-cs-take]"), True)
    check("le message a sa place",
          p4.inner_text(sec("song") + " [data-cs-empty]"),
          "Your preview is taking longer than usual. We have your details and will email it to you.")
    check("et l'offre reste la", p4.is_visible(sec("offer")), True)

    print("\n--- UN RECHARGEMENT PENDANT L'ATTENTE REPREND L'ATTENTE ---")
    p5 = page(ctx, "window.__readyAfter = 1000;")
    p5.goto(BASE + "/onepage.html")
    p5.wait_for_timeout(300)
    walk(p5)
    p5.clock.run_for(20000)
    before = int(p5.inner_text("[data-cs-mk-pct]").rstrip("%"))
    p5.reload()
    p5.wait_for_timeout(500)
    check("pas de retour au formulaire", p5.is_hidden("[data-cs-form]"), True)
    check("l'attente est la", p5.is_visible("[data-cs-mk]"), True)
    check("la barre n'est pas repartie de zero",
          int(p5.inner_text("[data-cs-mk-pct]").rstrip("%")) >= before, True)
    polls = p5.evaluate("window.__polls")
    p5.clock.run_for(11000)
    p5.wait_for_timeout(300)
    check("et la page continue d'interroger l'API", p5.evaluate("window.__polls") > polls, True)

    print("\n--- DANS L'EDITEUR DE THEME : TOUT EST VISIBLE ---")
    pe = ctx.new_page()
    pe.goto(BASE + "/onepage-editor.html")
    pe.wait_for_timeout(400)
    check("aucun verrou", pe.get_attribute("html", "data-cs-duo-gate"), None)
    for k in BELOW:
        check("« " + k + " » visible pour le reglage", shown(pe, k), True)

    check("aucune erreur de page", [e for e in errs if "PAGEERROR" in e], [])
    b.close()

print("\n" + ("TOUT PASSE" if ok else "ECHECS CI-DESSUS"))
sys.exit(0 if ok else 1)
