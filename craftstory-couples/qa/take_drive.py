#!/usr/bin/env python3
"""Pilote le montage des trente secondes dans Chromium.

Six plans, une chanson, et une seule question a chaque instant : est-ce que le
BON plan passe, avec la BONNE parole ? On ne peut pas le lire dans le code —
l'horloge vient du son, et seul un vrai navigateur la fait tourner.

Les plans sont fabriques par qa/mk_take.py : rien de reel, ni photo de client
ni musique sous licence.
"""
import json
import os
import subprocess
import sys

from playwright.sync_api import sync_playwright

D = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/"
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

if not os.path.exists(D + "take/shot6.webm"):
    subprocess.run([sys.executable, os.path.join(HERE, "mk_take.py")], check=True)

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


# Le plan visible, son numero d'ordre, et la parole affichee.
LIVE = """(() => {
  const st = document.querySelector('[data-cs-take]');
  const on = st.querySelector('.cs-pvs-shot.on');
  const all = [...st.querySelectorAll('.cs-pvs-shot')];
  const v = on && on.querySelector('video');
  return {
    n: on ? all.indexOf(on) : -1,
    clip: v ? v.src.split('/').pop() : null,
    playing: v ? !v.paused : false,
    at: v ? Math.round(v.currentTime * 10) / 10 : null,
    line: (st.querySelector('[data-cs-lyric]').textContent || '').trim(),
    lit: [...st.querySelectorAll('.cs-pvs-shot')].filter(e => e.classList.contains('on')).length,
    audio: Math.round(st.querySelector('[data-cs-audio]').currentTime * 10) / 10,
    left: (st.querySelector('[data-cs-cd]') || {}).textContent,
    bar: Math.round(parseFloat(document.querySelector('[data-cs-tlfill]').style.width || '0')),
    end: !document.querySelector('[data-cs-end]').hidden
  };
})()"""


def seek(pg, t):
    """On deplace la CHANSON, pas un compteur a part : c'est elle l'horloge,
    donc c'est la seule facon de tester une coupe sans attendre trente
    secondes par assertion."""
    pg.evaluate("t => document.querySelector('[data-cs-audio]').currentTime = t", t)
    pg.wait_for_timeout(700)
    return pg.evaluate(LIVE)


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                           args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 390, "height": 900}, device_scale_factor=2)
    errs = []
    pg = ctx.new_page()
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.add_init_script(
        "try{sessionStorage.setItem('csDuoFlow', JSON.stringify("
        "{their_name:'Marie', your_name:'Thomas', relationship:'Wife',"
        " genre:'Pop', voice:'Duet', occasion:'Anniversary'}));}catch(e){}")
    pg.goto(BASE + "/preview-take.html")
    pg.wait_for_timeout(600)

    print("\n--- LA TABLE DE MONTAGE ---")
    check("six plans montes", pg.eval_on_selector_all("[data-cs-shot]", "e=>e.length"), 6)
    check("une video par plan", pg.eval_on_selector_all("[data-cs-shot] video", "e=>e.length"), 6)
    check("toutes muettes", pg.eval_on_selector_all("[data-cs-shot] video", "e=>e.every(v=>v.muted)"), True)
    check("les deux premieres sont prechargees",
          pg.eval_on_selector_all("[data-cs-shot] video", "e=>e.slice(0,2).map(v=>v.preload)"), ["auto", "auto"])
    check("les autres non",
          pg.eval_on_selector_all("[data-cs-shot] video", "e=>e.slice(2).every(v=>v.preload==='none')"), True)
    check("cinq reperes de coupe", pg.eval_on_selector_all("[data-cs-marks] b", "e=>e.length"), 5)
    check("le premier repere a un sixieme",
          pg.eval_on_selector("[data-cs-marks] b",
                              "e=>Math.round(parseFloat(e.style.left)*10)/10"), 16.7)
    check("la duree annoncee est celle du montage", pg.inner_text("[data-cs-dur]"), "0:30")
    check("le fondu vient du reglage",
          pg.eval_on_selector("[data-cs-take]", "e=>e.style.getPropertyValue('--cs-cut')"), "360ms")
    check("rien ne joue avant le clic", pg.evaluate(LIVE)["playing"], False)
    check("etiquette de lecture", pg.eval_on_selector(".cs-pvs-tap", "e=>e.textContent"),
          "Tap to play preview")
    check("le voile du bas est eteint",
          pg.eval_on_selector("[data-cs-take]", "e=>e.classList.contains('cs-on')"), False)

    print("\n--- ON LANCE ---")
    pg.click("[data-cs-tap]")
    pg.wait_for_timeout(800)
    st = pg.evaluate(LIVE)
    check("le premier plan passe", st["n"], 0)
    check("c'est bien son fichier", st["clip"], "shot1.webm")
    check("il joue vraiment", st["playing"], True)
    check("un seul plan allume", st["lit"], 1)
    check("la chanson tourne", st["audio"] > 0.2, True)
    check("la couverture a disparu", pg.is_hidden("[data-cs-tap]"), True)
    check("le voile est allume",
          pg.eval_on_selector("[data-cs-take]", "e=>e.classList.contains('cs-on')"), True)
    check("la parole du plan 1, avec leur prenom", st["line"],
          "Before Marie, the days all looked the same")
    check("elle est decoupee mot a mot",
          pg.eval_on_selector_all("[data-cs-lyric] span", "e=>e.length"), 8)

    print("\n--- CHAQUE COUPE, A SON INSTANT ---")
    WANT = [
        (2.0, 0, "shot1.webm", "Before Marie, the days all looked the same"),
        (7.0, 1, "shot2.webm", "Then one evening that was supposed to be nothing"),
        (12.0, 2, "shot3.webm", "Thomas and Marie — and nothing was ordinary again"),
        (17.0, 3, "shot4.webm", "Through the year that tried to break us"),
        (22.0, 4, "shot5.webm", "Still here. Still choosing you."),
        (27.0, 5, "shot6.webm", "Marie, this one is yours."),
    ]
    for t, n, clip, line in WANT:
        st = seek(pg, t)
        check("a %4.1fs -> plan %d" % (t, n + 1), (st["n"], st["clip"]), (n, clip))
        check("       sa parole", st["line"], line)
        check("       il joue", st["playing"], True)
        check("       un seul allume", st["lit"], 1)

    print("\n--- LES BORNES ---")
    # On n'affirme PAS qu'un deplacement tombe a la seconde demandee : un
    # deplacement dans une piste Opus atterrit sur la page la plus proche, donc
    # a quelques dixiemes pres. Ce qui doit tenir, c'est l'invariant du
    # montage : le plan allume est celui dont la fenetre contient l'instant
    # REEL de la chanson. C'est vrai quel que soit le codec.
    for target in (4.9, 5.2, 9.8, 10.2, 14.6, 15.3, 19.9, 24.8, 25.4):
        st = seek(pg, target)
        t = st["audio"]
        want = min(5, int(t // 5))
        check("a %4.1fs (son a %4.1fs) -> plan %d" % (target, t, want + 1), st["n"], want)

    print("\n--- LE REBOURS ET LA FRISE ---")
    st = seek(pg, 10.0)
    t = st["audio"]
    check("le rebours dit le temps restant", st["left"],
          "0:%02d" % round(30 - t))
    check("la frise est au bon tiers", st["bar"], round(t / 30 * 100))
    check("le compteur dit le temps ecoule", pg.inner_text("[data-cs-cur]"),
          "0:%02d" % round(t))

    print("\n--- LA FIN, SUR LA DERNIERE IMAGE ---")
    st = seek(pg, 29.9)
    check("la carte de fin est la", st["end"], True)
    check("la frise est pleine", st["bar"], 100)
    check("le rebours est a zero", st["left"], "0:00")
    check("plus aucune video ne joue",
          pg.eval_on_selector_all("[data-cs-shot] video", "e=>e.every(v=>v.paused)"), True)
    check("la chanson est arretee",
          pg.eval_on_selector("[data-cs-audio]", "e=>e.paused"), True)
    check("la derniere image reste visible", st["lit"], 1)
    check("la parole a cede la place", st["line"], "")
    check("le titre de fin porte leur prenom", pg.inner_text("[data-cs-end] .cs-pvs-end-h"),
          "That was thirty seconds of Marie's music video.")
    check("le bouton mene a l'offre",
          pg.eval_on_selector("[data-cs-end] a", "e=>e.getAttribute('href')"), "#cs-duo-offer")
    pg.screenshot(path=D + "take-fin.png", full_page=False)

    print("\n--- ON LA REGARDE ENCORE ---")
    pg.click("[data-cs-again]")
    pg.wait_for_timeout(800)
    st = pg.evaluate(LIVE)
    check("on repart du plan 1", st["n"], 0)
    check("la chanson repart du debut", st["audio"] < 1.6, True)
    check("la carte de fin est refermee", st["end"], False)
    check("et ca joue", st["playing"], True)

    print("\n--- UN APPUI MET EN PAUSE ---")
    pg.click(".cs-pvs-shots")
    pg.wait_for_timeout(300)
    st = pg.evaluate(LIVE)
    check("le plan est arrete", st["playing"], False)
    check("la chanson aussi", pg.eval_on_selector("[data-cs-audio]", "e=>e.paused"), True)
    check("la derive est gelee",
          pg.eval_on_selector("[data-cs-take]", "e=>e.classList.contains('cs-hold')"), True)
    pg.click(".cs-pvs-shots")
    pg.wait_for_timeout(500)
    check("un second appui repart", pg.evaluate(LIVE)["playing"], True)

    print("\n--- LA TABLE LIVREE PAR LA GENERATION ---")
    # Le jour ou le worker repond, il pose sa table dans l'onglet et le lecteur
    # la joue a la place de celle de l'editeur. Meme chemin de code, donc c'est
    # ici qu'on verifie qu'une table livree gagne, avec ses propres durees.
    TAKE = {
        "song": "/take/song.webm", "seconds": 24, "aligned": True,
        "beats": [
            {"at": 0, "dur": 6, "clip": "/take/shot6.webm", "line": "Live line one", "drift": "in"},
            {"at": 6, "dur": 6, "clip": "/take/shot5.webm", "line": "Live line two", "drift": "out"},
            {"at": 12, "dur": 6, "clip": "", "poster": "/take/still.png",
             "line": "This shot lost its clip", "drift": "none"},
            {"at": 18, "dur": 6, "clip": "/take/shot1.webm", "line": "Live line four", "drift": "left"},
        ],
    }
    p3 = ctx.new_page()
    p3.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    p3.add_init_script("try{sessionStorage.setItem('csDuoTake', %s);}catch(e){}"
                       % json.dumps(json.dumps(TAKE)))
    p3.goto(BASE + "/preview-take.html")
    p3.wait_for_timeout(600)
    check("la table livree remplace celle de l'editeur",
          p3.eval_on_selector_all("[data-cs-shot]", "e=>e.length"), 4)
    check("et elle se signale",
          p3.eval_on_selector("[data-cs-take]", "e=>e.dataset.csLive"), "1")
    check("sa duree a elle", p3.eval_on_selector("[data-cs-take]", "e=>e.dataset.seconds"), "24")
    check("affichee sous le cadre", p3.inner_text("[data-cs-dur]"), "0:24")
    check("sa chanson a elle",
          p3.eval_on_selector("[data-cs-audio]", "e=>e.src.split('/').pop()"), "song.webm")
    check("ses paroles a elle",
          p3.eval_on_selector_all("[data-cs-shot]", "e=>e.map(x=>x.dataset.line)"),
          ["Live line one", "Live line two", "This shot lost its clip", "Live line four"])
    check("trois videos et une image",
          p3.eval_on_selector_all("[data-cs-shot] > *", "e=>e.map(x=>x.tagName)"),
          ["VIDEO", "VIDEO", "IMG", "VIDEO"])
    check("l'image est bien la sienne",
          p3.eval_on_selector("[data-cs-shot] img", "e=>e.src.split('/').pop()"), "still.png")
    p3.click("[data-cs-tap]")
    p3.wait_for_timeout(700)
    check("le premier plan livre passe",
          p3.eval_on_selector(".cs-pvs-shot.on video", "e=>e.src.split('/').pop()"), "shot6.webm")
    p3.evaluate("document.querySelector('[data-cs-audio]').currentTime=13")
    p3.wait_for_timeout(800)
    check("le plan sans clip s'allume quand meme",
          p3.eval_on_selector(".cs-pvs-shot.on", "e=>e.dataset.n"), "3")
    check("et c'est son image qu'on voit",
          p3.eval_on_selector_all(".cs-pvs-shot.on img", "e=>e.length"), 1)
    check("sa parole est affichee", p3.inner_text("[data-cs-lyric]"), "This shot lost its clip")

    print("\n--- SANS PLAN CHARGE, UN CADRE VIDE ---")
    p2 = ctx.new_page()
    p2.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    p2.goto(BASE + "/preview.html")
    p2.wait_for_timeout(400)
    check("pas de table de montage", p2.eval_on_selector_all("[data-cs-take]", "e=>e.length"), 0)
    check("un cadre vide a la place", p2.is_visible(".cs-pvs-prev-empty"), True)
    check("et il dit quoi faire", p2.inner_text(".cs-pvs-prev-empty"),
          "Your 30-second preview appears here.")

    check("aucune erreur console", errs, [])
    b.close()

print("\n" + ("TOUT PASSE" if ok else "ECHECS CI-DESSUS"))
sys.exit(0 if ok else 1)
