#!/usr/bin/env python3
"""Rend des sections de theme en HTML, hors Shopify, pour les voir tourner.

Pourquoi : on ne peut pas ouvrir la boutique depuis cet environnement, et une
section ne se juge pas a la relecture. Ce module interprete le sous-ensemble de
Liquid que ces sections utilisent — reglages, blocs, boucles, conditions, les
filtres courants — a partir d'un petit gabarit JSON :

    { "sections": [ { "type": "cs-duo-pv-song",
                      "settings": { "song_title": "..." },
                      "blocks": [ { "type": "row", "settings": {...} } ] } ] }

Les valeurs absentes viennent du schema de la section, comme chez Shopify.

    python3 qa/mock_render.py gabarit.json -o page.html
"""
import html as H
import io
import json
import os
import re
import sys

SKILL = ("/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6"
         "/scratchpad/skill/craftstory-project/code/theme")
SEC = "theme/sections"

# Un damier discret aux couleurs du theme, encode une fois pour toutes.
PLACEHOLDER = (
    "data:image/svg+xml;utf8,"
    "%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2080%2080%27%3E"
    "%3Crect%20width%3D%2780%27%20height%3D%2780%27%20fill%3D%27%23F6EAD9%27/%3E"
    "%3Cpath%20d%3D%27M0%200h40v40H0zM40%2040h40v40H40z%27%20fill%3D%27%23ECDDC9%27/%3E"
    "%3Ccircle%20cx%3D%2740%27%20cy%3D%2740%27%20r%3D%2714%27%20fill%3D%27%23EC5B3C%27%20opacity%3D%27.35%27/%3E"
    "%3C/svg%3E")

TOKEN = re.compile(r"\{\{-?\s*(?P<out>.*?)\s*-?\}\}|\{%-?\s*(?P<tag>.*?)\s*-?%\}", re.S)
BLOCKY = ("if", "unless", "for", "case", "comment", "schema", "stylesheet", "javascript", "form")


# ---------------------------------------------------------------- lecture

def liquid_block(name, text):
    m = re.search(r"\{%-?\s*" + name + r"\s*-?%\}(.*?)\{%-?\s*end" + name + r"\s*-?%\}", text, re.S)
    return m.group(1) if m else ""


def schema_defaults(schema):
    out = {}
    for st in schema.get("settings", []):
        if "id" in st:
            out[st["id"]] = st.get("default", False if st["type"] == "checkbox" else "")
    return out


def block_defaults(schema, btype):
    for b in schema.get("blocks", []):
        if b["type"] == btype:
            out = {}
            for st in b.get("settings", []):
                if "id" in st:
                    out[st["id"]] = st.get("default", False if st["type"] == "checkbox" else "")
            return out
    return {}


# ---------------------------------------------------------------- arbre

def parse(src):
    """Decoupe en noeuds : ('txt', s) | ('out', expr) | ('tag', mot, reste, enfants)."""
    pos, stack, root = 0, [], []
    cur = root
    for m in TOKEN.finditer(src):
        if m.start() > pos:
            cur.append(("txt", src[pos:m.start()]))
        pos = m.end()
        if m.group("out") is not None:
            cur.append(("out", m.group("out")))
            continue
        tag = m.group("tag").strip()
        word = tag.split()[0] if tag else ""
        rest = tag[len(word):].strip()
        if word in BLOCKY:
            node = ("tag", word, rest, [])
            cur.append(node)
            stack.append((cur, node))
            cur = node[3]
        elif word.startswith("end"):
            if stack:
                cur, _ = stack.pop()
        elif word in ("else", "elsif", "when"):
            # On remonte a la branche courante et on marque la coupure.
            cur.append(("sep", word, rest))
        else:
            cur.append(("tag", word, rest, None))
    if pos < len(src):
        cur.append(("txt", src[pos:]))
    return root


# ---------------------------------------------------------------- valeurs

class Drop(dict):
    """Un objet a attributs, pour que a.b marche comme a['b']."""
    __getattr__ = dict.get


def look(path, scope):
    cur = scope
    for part in re.findall(r"[^.\[\]]+", path):
        if isinstance(cur, dict):
            cur = cur.get(part, "")
        elif isinstance(cur, (list, tuple)):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return ""
        else:
            return ""
    return cur


def literal(tok, scope):
    tok = tok.strip()
    if not tok:
        return ""
    if tok[0] in "'\"" and tok[-1] == tok[0]:
        return tok[1:-1]
    if re.fullmatch(r"-?\d+", tok):
        return int(tok)
    if tok == "true":
        return True
    if tok == "false":
        return False
    if tok in ("nil", "null", "empty", "blank"):
        return ""
    return look(tok, scope)


def split_filters(expr):
    """Coupe sur | hors guillemets."""
    out, buf, q = [], "", None
    for ch in expr:
        if q:
            buf += ch
            if ch == q:
                q = None
        elif ch in "'\"":
            q = ch
            buf += ch
        elif ch == "|":
            out.append(buf)
            buf = ""
        else:
            buf += ch
    out.append(buf)
    return [x.strip() for x in out]


def apply_filter(val, spec, scope):
    name = spec.split(":")[0].strip()
    argtxt = spec[len(name) + 1:] if ":" in spec else ""
    args, kw = [], {}
    for piece in split_args(argtxt):
        if re.match(r"^\w+\s*:", piece):
            k, v = piece.split(":", 1)
            kw[k.strip()] = literal(v, scope)
        elif piece.strip():
            args.append(literal(piece, scope))

    if name == "default":
        return args[0] if (val in ("", None, False, 0) and args) else val
    if name == "escape":
        return H.escape(str(val), quote=True)
    if name == "strip":
        return str(val).strip()
    if name == "upcase":
        return str(val).upper()
    if name == "plus":
        return num(val) + num(args[0] if args else 0)
    if name == "minus":
        return num(val) - num(args[0] if args else 0)
    if name == "split":
        return str(val).split(args[0]) if args else [str(val)]
    if name == "newline_to_br":
        # Liquid garde le saut de ligne apres la balise : le reproduire ici evite
        # de faire passer un decoupage qui echouerait sur la boutique.
        return str(val).replace("\n", "<br />\n")
    if name == "replace":
        return str(val).replace(str(args[0]), str(args[1]) if len(args) > 1 else "")
    if name == "join":
        sep = str(args[0]) if args else ""
        return sep.join(str(x) for x in val) if isinstance(val, (list, tuple)) else str(val)
    if name == "strip_newlines":
        return str(val).replace("\n", "").replace("\r", "")
    if name == "last":
        return (val or [""])[-1] if isinstance(val, (list, tuple)) else val
    if name == "image_url":
        # Un vrai visuel en data-URI : pas de requete, pas de 404 qui polluent
        # la console, et une planche de contact lisible.
        return PLACEHOLDER
    if name == "where":
        key, want = args[0], args[1]
        return [x for x in (val or []) if isinstance(x, dict) and x.get(key) == want]
    if name == "first":
        return (val or [""])[0] if isinstance(val, (list, tuple)) else val
    if name == "size":
        return len(val) if hasattr(val, "__len__") else 0
    return val


def split_args(txt):
    out, buf, q, depth = [], "", None, 0
    for ch in txt:
        if q:
            buf += ch
            if ch == q:
                q = None
        elif ch in "'\"":
            q = ch
            buf += ch
        elif ch == "," and depth == 0:
            out.append(buf)
            buf = ""
        else:
            buf += ch
    out.append(buf)
    return out


def num(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return 0


def value(expr, scope):
    parts = split_filters(expr)
    val = literal(parts[0], scope)
    for f in parts[1:]:
        val = apply_filter(val, f, scope)
    return val


BLANK = object()


def truth(cond, scope):
    cond = cond.strip()
    for joiner in (" and ", " or "):
        # Pas de priorite a gerer : ces sections n'en melangent jamais deux.
        if joiner in cond:
            parts = [truth(x, scope) for x in cond.split(joiner)]
            return all(parts) if joiner == " and " else any(parts)
    m = re.match(r"^(.*?)\s*(==|!=|>=|<=|>|<)\s*(.*)$", cond)
    if not m:
        v = value(cond, scope)
        return bool(v) and v != ""
    left, op, right = value(m.group(1), scope), m.group(2), m.group(3).strip()
    if right == "blank":
        empty = left in ("", None, False) or (isinstance(left, (list, dict)) and not left)
        return empty if op == "==" else not empty
    r = literal(right, scope)
    if op == "==":
        return left == r
    if op == "!=":
        return left != r
    return {">" : lambda: num(left) > num(r), "<": lambda: num(left) < num(r),
            ">=": lambda: num(left) >= num(r), "<=": lambda: num(left) <= num(r)}[op]()


# ---------------------------------------------------------------- rendu

def branches(kids):
    """Coupe une liste d'enfants sur les ('sep', ...)."""
    out, cur, head = [], [], None
    for k in kids:
        if k[0] == "sep":
            out.append((head, cur))
            head, cur = (k[1], k[2]), []
        else:
            cur.append(k)
    out.append((head, cur))
    return out


def render(nodes, scope, warn):
    buf = []
    for node in nodes:
        kind = node[0]
        if kind == "txt":
            buf.append(node[1])
        elif kind == "out":
            v = value(node[1], scope)
            buf.append("" if v is False or v is None else str(v))
        elif kind == "sep":
            pass
        elif kind == "tag":
            buf.append(do_tag(node, scope, warn))
    return "".join(buf)


def do_tag(node, scope, warn):
    _, word, rest, kids = node
    if word in ("comment", "schema", "stylesheet", "javascript"):
        return ""
    if word == "assign":
        name, expr = rest.split("=", 1)
        scope[name.strip()] = value(expr, scope)
        return ""
    if word in ("if", "unless"):
        first = True
        for head, kids2 in branches(kids or []):
            if head is None:
                hit = truth(rest, scope) if word == "if" else not truth(rest, scope)
            elif head[0] == "elsif":
                hit = truth(head[1], scope)
            else:
                hit = True
            if hit:
                return render(kids2, scope, warn)
            first = False
        return ""
    if word == "case":
        subject = value(rest, scope)
        default = []
        for head, kids2 in branches(kids or []):
            if head is None:
                continue
            if head[0] == "when" and subject == literal(head[1], scope):
                return render(kids2, scope, warn)
            if head[0] == "else":
                default = kids2
        return render(default, scope, warn)
    if word == "for":
        m = re.match(r"^(\w+)\s+in\s+(.+)$", rest)
        if not m:
            return ""
        var, src = m.group(1), m.group(2).strip()
        rng = re.match(r"^\((\d+)\.\.(\d+)\)$", src)
        items = list(range(int(rng.group(1)), int(rng.group(2)) + 1)) if rng else value(src, scope)
        if not isinstance(items, (list, tuple)):
            items = []
        out = []
        keep = (scope.get(var), scope.get("forloop"))
        for i, it in enumerate(items):
            scope[var] = it
            scope["forloop"] = Drop(index=i + 1, index0=i, first=i == 0,
                                    last=i == len(items) - 1, length=len(items))
            out.append(render(kids or [], scope, warn))
        scope[var], scope["forloop"] = keep
        return "".join(out)
    if word in ("liquid", "echo", "increment", "decrement", "render", "include", "break", "continue", "form", "#"):
        if word == "liquid":
            # Un bloc liquid peut contenir un comment...endcomment dont chaque
            # ligne de prose deviendrait sinon une fausse balise.
            body2 = re.sub(r"\bcomment\b.*?\bendcomment\b", "", rest, flags=re.S)
            lines = [l.strip() for l in body2.splitlines() if l.strip()]
            if not lines:
                return ""
            return render(parse("{% " + " %}{% ".join(lines) + " %}"), scope, warn)
        return ""
    warn.add(word)
    return ""


# ---------------------------------------------------------------- page

def build(mock_path, out_path):
    mock = json.load(io.open(mock_path, encoding="utf-8"))
    css = [liquid_block("stylesheet", io.open(f"{SKILL}/sections/cs-head.liquid", encoding="utf-8").read())]
    body, js, warn = [], [], set()

    for entry in mock["sections"]:
        t = entry["type"]
        path = f"{SEC}/{t}.liquid"
        if not os.path.exists(path):
            path = f"{SKILL}/sections/{t}.liquid"
        src = io.open(path, encoding="utf-8").read()
        schema = json.loads(liquid_block("schema", src))
        css.append(f"\n/* ===== {t} ===== */\n" + liquid_block("stylesheet", src))
        js.append(liquid_block("javascript", src))

        settings = schema_defaults(schema)
        settings.update(entry.get("settings", {}))
        blocks = []
        for b in entry.get("blocks", []):
            bs = block_defaults(schema, b["type"])
            bs.update(b.get("settings", {}))
            blocks.append(Drop(type=b["type"], settings=Drop(bs), shopify_attributes=""))

        # Comme Shopify : chaque section dans son enveloppe, avec l'identifiant
        # « template--…__cle ». Le verrou de la page unique s'appuie dessus
        # (« #shopify-section-X ~ .shopify-section ») : sans enveloppe, on
        # testerait un verrou qui ne verrouille rien.
        sid = "template--mock__" + entry.get("key", t)
        scope = {
            "section": Drop(settings=Drop(settings), blocks=blocks, id=sid),
            "request": Drop(design_mode=bool(mock.get("design_mode"))),
        }
        tree = parse(re.sub(r"\{%-?\s*(schema|stylesheet|javascript)\s*-?%\}.*?\{%-?\s*end\1\s*-?%\}",
                            "", src, flags=re.S))
        body.append('<div id="shopify-section-' + sid + '" class="shopify-section">'
                    + render(tree, scope, warn) + '</div>')

    if warn:
        print("BALISES IGNOREES:", sorted(warn), file=sys.stderr)
    leftover = re.findall(r"\{[{%].{0,60}", "".join(body))
    if leftover:
        print("LIQUID NON RENDU:", leftover[:5], file=sys.stderr)

    doc = ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
           "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
           "<title>mock</title><style>*{box-sizing:border-box}body{margin:0}\n"
           + "\n".join(css) + "</style></head><body class=\"cs\">\n<main id=\"MainContent\">"
           + "\n".join(body) + "</main>\n<script>" + "\n".join(js) + "</script></body></html>")
    io.open(out_path, "w", encoding="utf-8").write(doc)
    print("ecrit", out_path, len(doc), "octets")


if __name__ == "__main__":
    a = sys.argv[1:]
    out = a[a.index("-o") + 1] if "-o" in a else "/tmp/mock.html"
    build(a[0], out)
