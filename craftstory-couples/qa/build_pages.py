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
    "cs-duo-pv-song": {"video_url": "/clip.webm", "prev_url": "/clip.webm",
                       "video_caption": "OUR WRITERS ARE"},
    "cs-duo-reviews": {"rating_score": "4.9", "rating_label": "Excellent",
                       "rating_count": "Based on 63 reviews",
                       "rating_bars": "5 stars|87\n4 stars|9\n3 stars|3\n2 stars|1\n1 star|0"},
}
FACE_IMAGE = {"face": {"image": "x"}}
REVIEW_TEXT = {"quote": "REVIEW SLOT — their own words go here.", "name": "Name",
               "verified": True}


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
        out["sections"].append({"type": kind, "settings": settings, "blocks": blocks})
    json.dump(out, io.open(out_json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return out_json


def render(mock, html):
    subprocess.run([sys.executable, os.path.join(HERE, "mock_render.py"), mock,
                    "-o", os.path.join(OUT, html)], cwd=ROOT, check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for template, html in (("page.couples-start.json", "flow.html"),
                           ("page.couples-preview.json", "preview.html")):
        mock = os.path.join(OUT, html.replace(".html", ".json"))
        mock_from(template, mock)
        render(mock, html)

    # Une variante du tunnel SANS clip : c'est le seul moyen de voir le cadre
    # vide, celui que le marchand a devant lui avant d'avoir charge son MP4.
    flow = os.path.join(OUT, "flow.json")
    bare = os.path.join(OUT, "flow-bare.json")
    data = json.load(io.open(flow, encoding="utf-8"))
    for k in ("mk_video_url", "mk_caption"):
        data["sections"][0]["settings"].pop(k, None)
    json.dump(data, io.open(bare, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    render(bare, "flow-bare.html")

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
