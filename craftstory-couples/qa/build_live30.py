#!/usr/bin/env python3
"""Les pages du test « attente de 30 s puis tout s'ouvre dessous ».

Rendues depuis les VRAIS gabarits du theme (ceux qui partent sur Shopify),
avec la VRAIE preview de l'associe : sa section, son JS, sa CSS. Deux
adresses seulement sont remplacees : son studio (le worker Cloudflare) par
un faux studio que le test sert lui-meme, pour ne rien generer pour de vrai.

    live30-onepage.html   la page unique : tunnel + preview + offre + le reste
    live30-noclip.html    la meme, sans clip d'attente (leur photo le remplace)
    live30-flowonly.html  le tunnel seul, comme sur le live : a la fin de la
                          barre, la page de la preview s'ouvre d'elle-meme
    live30-preview.html   la page preview de l'associe, telle quelle
    live30-editor.html    la page unique vue dans l'editeur : aucun verrou
"""
import io
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_pages  # noqa: E402

OUT = build_pages.OUT
STUDIO = "https://fake-studio.test"


def mock(template, name, edit=None):
    path = os.path.join(OUT, name + ".json")
    build_pages.mock_from(template, path)
    data = json.load(io.open(path, encoding="utf-8"))
    for sec in data["sections"]:
        s = sec["settings"]
        if sec["type"] == "cs-duo-flow":
            s["api_url"] = STUDIO + "/v1/previews"
        if sec["type"] == "cs-duo-generated-preview":
            s["api_base"] = STUDIO
    if edit:
        edit(data)
    json.dump(data, io.open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    build_pages.render(path, name + ".html")


def main():
    os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)
    for f in ("cs-couples-preview.js", "cs-couples-preview.css"):
        shutil.copy(os.path.join(ROOT, "theme/assets", f), os.path.join(OUT, "assets", f))

    mock("page.couples-start.json", "live30-onepage")

    def noclip(d):
        for k in ("mk_video_url", "mk_caption"):
            d["sections"][0]["settings"].pop(k, None)
    mock("page.couples-start.json", "live30-noclip", noclip)

    def flowonly(d):
        d["sections"] = [d["sections"][0]]
    mock("page.couples-start.json", "live30-flowonly", flowonly)

    mock("page.couples-preview.json", "live30-preview")

    def editor(d):
        d["design_mode"] = True
    mock("page.couples-start.json", "live30-editor", editor)


if __name__ == "__main__":
    main()
