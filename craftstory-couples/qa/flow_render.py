#!/usr/bin/env python3
"""Rend cs-duo-flow.liquid en HTML avec les valeurs par defaut du schema.

Pourquoi : le seul moyen de savoir si un tunnel enchaine vraiment ses ecrans,
c'est de le faire tourner dans un navigateur avant qu'il touche la boutique.
Le rendu Liquid ici ne couvre QUE les constructions de ce fichier.
"""
import json, re, sys, html, io, os

SRC = sys.argv[1] if len(sys.argv) > 1 else "theme/sections/cs-duo-flow.liquid"
ASK_PHOTO = "--photo" in sys.argv
OUT = sys.argv[sys.argv.index("-o") + 1] if "-o" in sys.argv else "/tmp/flow.html"
HEAD = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/skill/craftstory-project/code/theme/sections/cs-head.liquid"

src = io.open(SRC, encoding="utf-8").read()

def block(name, text):
    m = re.search(r"\{%-?\s*" + name + r"\s*-?%\}(.*?)\{%-?\s*end" + name + r"\s*-?%\}", text, re.S)
    return m.group(1) if m else ""

schema = json.loads(block("schema", src))
css_sec = block("stylesheet", src)
js_sec = block("javascript", src)
css_head = block("stylesheet", io.open(HEAD, encoding="utf-8").read())

S = {}
for st in schema["settings"]:
    if "id" in st:
        S[st["id"]] = st.get("default", "" if st["type"] != "checkbox" else False)
S["ask_photo"] = ASK_PHOTO

body = re.sub(r"\{%-?\s*schema\s*-?%\}.*", "", src, flags=re.S)
body = re.sub(r"\{%-?\s*liquid.*?-%\}", "", body, flags=re.S)   # l'entete assign
body = re.sub(r"\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}", "", body, flags=re.S)

LISTS = {"rel": "rel_options", "occ": "occ_options", "gen": "genre_options",
         "voi": "voice_options", "lang": "lang_options"}

def value(expr):
    """{{ section.settings.x | default: 'y' | escape }}"""
    parts = [p.strip() for p in expr.split("|")]
    base = parts[0]
    if base.startswith("section.settings."):
        v = S.get(base.split(".")[-1], "")
    elif base in ("v", "r", "o", "g", "v2", "l"):
        v = CUR
    else:
        v = ""
    for f in parts[1:]:
        if f.startswith("default:"):
            if not v:
                v = f.split(":", 1)[1].strip().strip("'\"")
        elif f == "escape":
            v = html.escape(str(v), quote=True)
        elif f == "strip":
            v = str(v).strip()
    return str(v)

CUR = ""

def expand_for(m):
    global CUR
    var, lst, inner = m.group(1), m.group(2), m.group(3)
    items = [x.strip() for x in str(S.get(LISTS[lst], "")).split("\n") if x.strip()]
    out = []
    for it in items:
        CUR = it
        chunk = inner
        # {%- assign v = r | strip -%} puis {%- if v != blank -%}...{%- endif -%}
        chunk = re.sub(r"\{%-?\s*assign\s+\w+\s*=.*?-?%\}", "", chunk, flags=re.S)
        chunk = re.sub(r"\{%-?\s*if\s+v\s*!=\s*blank\s*-?%\}(.*?)\{%-?\s*endif\s*-?%\}", r"\1", chunk, flags=re.S)
        chunk = re.sub(r"\{\{-?\s*(.*?)\s*-?\}\}", lambda mm: value(mm.group(1)), chunk)
        out.append(chunk)
    CUR = ""
    return "".join(out)

body = re.sub(r"\{%-?\s*for\s+(\w+)\s+in\s+(\w+)\s*-?%\}(.*?)\{%-?\s*endfor\s*-?%\}", expand_for, body, flags=re.S)

# Les {% if %} s'imbriquent (le bloc photo contient celui des conseils) : on
# resout donc toujours le plus interne d'abord, sinon un endif se retrouve
# orphelin et une moitie d'ecran passe a travers.
IF_INNER = re.compile(
    r"\{%-?\s*if\s+(?P<cond>[^%]*?)\s*-?%\}"
    r"(?P<a>(?:(?!\{%-?\s*if\s).)*?)"
    r"(?:\{%-?\s*else\s*-?%\}(?P<b>(?:(?!\{%-?\s*if\s).)*?))?"
    r"\{%-?\s*endif\s*-?%\}", re.S)

def truth(cond):
    cond = cond.strip()
    neg = False
    if cond.endswith("!= blank"):
        cond = cond[: -len("!= blank")].strip()
    elif cond.endswith("== blank"):
        cond, neg = cond[: -len("== blank")].strip(), True
    v = S.get(cond.replace("section.settings.", ""), "")
    got = bool(v) and v != ""
    return (not got) if neg else got

while re.search(r"\{%-?\s*if\s", body):
    body, n = IF_INNER.subn(lambda m: (m.group("a") if truth(m.group("cond")) else (m.group("b") or "")), body)
    if not n:
        print("IF NON RESOLU", file=sys.stderr)
        break

body = re.sub(r"\{\{-?\s*(.*?)\s*-?\}\}", lambda m: value(m.group(1)), body)

leftover = re.findall(r"\{[{%].{0,60}", body)
if leftover:
    print("LIQUID NON RENDU:", leftover[:6], file=sys.stderr)

doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>flow</title><style>
*{{box-sizing:border-box}}body{{margin:0}}
{css_head}
{css_sec}
</style></head><body class="cs">
{body}
<script>{js_sec}</script>
</body></html>"""
io.open(OUT, "w", encoding="utf-8").write(doc)
print("ecrit", OUT, len(doc), "octets")
