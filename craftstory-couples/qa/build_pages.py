#!/usr/bin/env python3
"""Rend les deux pages du tunnel en HTML, depuis les VRAIS gabarits Shopify.

Un seul moteur : qa/mock_render.py. Il y en avait deux, et le plus simple ne
savait pas evaluer un « or » dans une condition — resultat, un bloc entier
disparaissait du rendu sans que rien ne le signale.

Partir des gabarits deployes plutot que d'une copie evite l'autre piege :
tester une page que personne ne verra.

    python3 qa/build_pages.py [dossier]
"""
import collections
import io
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = sys.argv[1] if len(sys.argv) > 1 else (
    "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow")

# Ce que le schema laisse vide mais qu'il faut pour voir la page tourner.
OVERRIDES = {
    "cs-duo-flow": {"mk_video_url": "/clip.webm", "mk_caption": "OUR WRITERS ARE"},
    "cs-duo-pv-song": {"video_url": "/clip.webm", "video_caption": "OUR WRITERS ARE"},
    "cs-duo-reviews": {"rating_score": "4.9", "rating_label": "Excellent",
                       "rating_count": "Based on 63 reviews",
                       "rating_bars": "5 stars|87\n4 stars|9\n3 stars|3\n2 stars|1\n1 star|0"},
}
FACE_IMAGE = {"face": {"image": "x"}}
REVIEW_TEXT = {"quote": "REVIEW SLOT — their own words go here.", "name": "Name",
               "verified": True}


# Les six temps du montage. L'arc est le meme pour tout le monde — rencontre,
# quotidien, bascule, epreuve, promesse, aujourd'hui — et ce sont leurs mots qui
# remplissent les trous. C'est ce qui rend l'histoire lisible sans le son.
BEATS = [
    ("Before {name}, the days all looked the same", "in"),
    ("Then one evening that was supposed to be nothing", "out"),
    ("{you} and {name} — and nothing was ordinary again", "left"),
    ("Through the year that tried to break us", "in"),
    ("Still here. Still choosing you.", "right"),
    ("{name}, this one is yours.", "in"),
]


def load_template(name):
    """Shopify prefixe ces fichiers d'un commentaire /* */ : JSON ne l'avale pas."""
    raw = io.open(os.path.join(ROOT, "theme/templates", name), encoding="utf-8").read()
    head = re.match(r"\s*/\*.*?\*/\s*", raw, re.S)
    if head:
        raw = raw[len(head.group(0)):]
    return json.loads(raw, object_pairs_hook=collections.OrderedDict)


def mock_from(template, out_json):
    t = load_template(template)
    out = {"sections": []}
    for key in t["order"]:
        sec = t["sections"][key]
        kind = sec["type"]
        if kind == "cs-head":
            continue
        settings = dict(sec.get("settings", {}))
        settings.update(OVERRIDES.get(kind, {}))
        blocks = []
        for i, bkey in enumerate(sec.get("block_order", [])):
            b = sec["blocks"][bkey]
            bs = dict(b.get("settings", {}))
            bs.update(FACE_IMAGE.get(b["type"], {}))
            if b["type"] == "review":
                bs.update(REVIEW_TEXT)
                bs["date"] = "%d weeks ago" % (i + 1)
            blocks.append({"type": b["type"], "settings": bs})
        out["sections"].append({"type": kind, "key": key, "settings": settings, "blocks": blocks})
    json.dump(out, io.open(out_json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return out_json


def render(mock, html):
    subprocess.run([sys.executable, os.path.join(HERE, "mock_render.py"), mock,
                    "-o", os.path.join(OUT, html)], cwd=ROOT, check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for template, html in (("page.couples-start.json", "onepage.html"),
                           ("page.couples-preview.json", "preview.html")):
        mock = os.path.join(OUT, html.replace(".html", ".json"))
        mock_from(template, mock)
        render(mock, html)

    # LA PAGE UNIQUE, telle que deployee : le tunnel, puis toute la page preview
    # dessous. Seule l'adresse de l'API change : le vrai Supabase n'est pas
    # joignable d'ici, et les tests bouchonnent fetch de toute facon.
    one = os.path.join(OUT, "onepage.json")
    data = json.load(io.open(one, encoding="utf-8"))
    data["sections"][0]["settings"]["api_url"] = "/fake-api/start"
    json.dump(data, io.open(one, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(one, "onepage.html")

    # LE TUNNEL SEUL, sans API et sans rien dessous : l'ancien chemin (le
    # formulaire natif, puis le bouton vers la page d'apres). Il existe
    # toujours — c'est le repli quand l'API n'est pas renseignee.
    flow = os.path.join(OUT, "flow.json")
    data = json.load(io.open(one, encoding="utf-8"))
    data["sections"] = [data["sections"][0]]
    data["sections"][0]["settings"].pop("api_url", None)
    json.dump(data, io.open(flow, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(flow, "flow.html")

    # Une variante du tunnel SANS clip : c'est le seul moyen de voir le cadre
    # vide, celui que le marchand a devant lui avant d'avoir charge son MP4.
    bare = os.path.join(OUT, "flow-bare.json")
    data = json.load(io.open(flow, encoding="utf-8"))
    for k in ("mk_video_url", "mk_caption"):
        data["sections"][0]["settings"].pop(k, None)
    json.dump(data, io.open(bare, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(bare, "flow-bare.html")

    # Une variante avec api_url rempli ET sans clip ET rien dessous : la
    # branche JSON du tunnel, leur photo qui prend la place du cadre vide, et
    # le bouton de l'ancienne page quand il n'y a rien a ouvrir dessous.
    api = os.path.join(OUT, "flow-api.json")
    data = json.load(io.open(flow, encoding="utf-8"))
    for k in ("mk_video_url", "mk_caption"):
        data["sections"][0]["settings"].pop(k, None)
    data["sections"][0]["settings"]["api_url"] = "/fake-api"
    json.dump(data, io.open(api, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(api, "flow-api.html")

    # La page unique vue DANS L'EDITEUR : pas de verrou, tout est visible.
    ed = os.path.join(OUT, "onepage-editor.json")
    data = json.load(io.open(one, encoding="utf-8"))
    data["design_mode"] = True
    json.dump(data, io.open(ed, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(ed, "onepage-editor.html")

    # Le montage, avec six vrais plans et une chanson : c'est le seul moyen de
    # verifier qu'une coupe tombe au bon instant. Le gabarit deploye n'a pas
    # encore de blocs Beat, donc on les injecte ici.
    mock = os.path.join(OUT, "preview.json")
    take = os.path.join(OUT, "preview-take.json")
    data = json.load(io.open(mock, encoding="utf-8"))
    for sec in data["sections"]:
        if sec["type"] != "cs-duo-pv-song":
            continue
        sec["settings"]["take_audio"] = "/take/song.webm"
        sec["settings"]["take_seconds"] = 30
        sec["settings"]["take_cut"] = 360
        sec["settings"]["take_clock"] = True
        beats = []
        for n, (line, drift) in enumerate(BEATS):
            beats.append({"type": "beat", "settings": {
                "clip_url": "/take/shot%d.webm" % (n + 1),
                "seconds": 5, "line": line, "drift": drift}})
        sec["blocks"] = beats + sec["blocks"]
    json.dump(data, io.open(take, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(take, "preview-take.html")

    # Une variante avec le verrou allume. Le reglage existe toujours meme s'il
    # est eteint par defaut, donc il doit rester teste.
    mock = os.path.join(OUT, "preview.json")
    locked = os.path.join(OUT, "preview-locked.json")
    data = json.load(io.open(mock, encoding="utf-8"))
    data["sections"][0]["settings"]["lock"] = True
    json.dump(data, io.open(locked, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(locked, "preview-locked.html")


if __name__ == "__main__":
    main()
