#!/usr/bin/env python3
"""Refuse ce que Shopify refuse EN SILENCE a l'upload d'une section.

Pourquoi ce fichier existe : `themeFilesUpsert` a renvoye 201 a l'upload et
`userErrors: []` a l'upsert pendant des heures, sans jamais appliquer trois
fichiers. Deux causes ont ete isolees, aucune des deux n'est signalee par l'API :

  1. `"default": ""` — une chaine vide comme valeur par defaut. Si un `default`
     est present il doit etre non vide ; on omet la cle a la place. C'est ce qui
     bloquait cs-duo-hero et cs-duo-trust.
  2. un `name` de section, de bloc ou de preset **au-dela de 25 caracteres**.
     C'est ce qui bloquait cs-duo-how ("CraftStory Duo How It Works" = 27).

Le reste des regles vient de la documentation Shopify et coute zero a verifier.

    python3 qa/schema_check.py theme/sections/*.liquid
"""
import json, re, sys
from pathlib import Path

NAME_MAX = 25
ROOT_KEYS = {"name","tag","class","limit","settings","blocks","max_blocks","presets",
             "default","locales","templates","enabled_on","disabled_on","description"}

def audit_settings(settings, where, out):
    seen = set()
    for st in settings:
        t, sid = st.get("type"), st.get("id")
        if t in ("header", "paragraph"):
            if "id" in st:      out.append(f"{where}: {t} porte un id")
            if "default" in st: out.append(f"{where}: {t} porte un default")
            continue
        if not sid:
            out.append(f"{where}: setting de type {t} sans id"); continue
        if sid in seen: out.append(f"{where}.{sid}: id duplique")
        seen.add(sid)
        if "default" in st:
            d = st["default"]
            if d == "":   out.append(f"{where}.{sid}: default vide — Shopify rejette en silence")
            if d is None: out.append(f"{where}.{sid}: default null")
        if t == "select":
            opts = st.get("options") or []
            if not opts: out.append(f"{where}.{sid}: select sans options")
            vals = [o.get("value") for o in opts]
            if any(v in (None, "") for v in vals):
                out.append(f"{where}.{sid}: option a valeur vide")
            if "default" in st and st["default"] not in vals:
                out.append(f"{where}.{sid}: default hors des options")
        if t == "range":
            mn, mx, sp = st.get("min"), st.get("max"), st.get("step", 1)
            if None in (mn, mx):
                out.append(f"{where}.{sid}: range sans min/max")
            elif not sp:
                out.append(f"{where}.{sid}: range avec step nul")
            else:
                steps = (mx - mn) / sp
                if steps > 101:
                    out.append(f"{where}.{sid}: range a {steps:.0f} pas (limite 101)")
                if abs(steps - round(steps)) > 1e-9:
                    out.append(f"{where}.{sid}: step ne divise pas l'intervalle")
                if "default" in st and not (mn <= st["default"] <= mx):
                    out.append(f"{where}.{sid}: default hors bornes")
        if t == "checkbox" and "default" in st and not isinstance(st["default"], bool):
            out.append(f"{where}.{sid}: default de checkbox non booleen")

def audit(path):
    s = Path(path).read_text(encoding="utf-8")
    m = re.search(r"\{%-?\s*schema\s*-?%\}(.*?)\{%-?\s*endschema\s*-?%\}", s, re.S)
    if not m:
        return ["aucun bloc schema"]
    try:
        sch = json.loads(m.group(1))
    except Exception as e:
        return [f"schema JSON invalide : {e}"]
    out = []
    unknown = set(sch) - ROOT_KEYS
    if unknown: out.append(f"cles racine inconnues : {sorted(unknown)}")
    if len(sch.get("name", "")) > NAME_MAX:
        out.append(f"name de section : {len(sch['name'])} caracteres (limite {NAME_MAX})")
    if "presets" not in sch: out.append("pas de presets")
    audit_settings(sch.get("settings", []), "section", out)

    types = set()
    for b in sch.get("blocks", []):
        bt = b.get("type")
        if not bt: out.append("bloc sans type"); continue
        if bt in types: out.append(f"type de bloc duplique : {bt}")
        types.add(bt)
        if len(b.get("name", "")) > NAME_MAX:
            out.append(f"name du bloc '{b.get('name')}' : {len(b.get('name',''))} caracteres (limite {NAME_MAX})")
        audit_settings(b.get("settings", []), f"bloc.{bt}", out)

    mb = sch.get("max_blocks")
    for pr in sch.get("presets", []):
        if len(pr.get("name", "")) > NAME_MAX:
            out.append(f"name du preset : {len(pr.get('name',''))} caracteres (limite {NAME_MAX})")
        pb = pr.get("blocks") or []
        if mb and len(pb) > mb:
            out.append(f"preset a {len(pb)} blocs pour max_blocks={mb}")
        for b in pb:
            if b.get("type") not in types:
                out.append(f"preset utilise un type de bloc inconnu : {b.get('type')}")

    # les ids de settings reellement lus dans le markup doivent exister
    used = set(re.findall(r"section\.settings\.([a-z0-9_]+)", s))
    ids = {st.get("id") for st in sch.get("settings", []) if st.get("id")}
    for sid in sorted(used - ids):
        out.append(f"markup lit section.settings.{sid}, absent du schema")
    return out

def main(paths):
    bad = 0
    for p in paths:
        pb = audit(p)
        if pb:
            bad += 1
            print(f"\n{Path(p).name}")
            for x in pb: print(f"   x {x}")
        else:
            print(f"  OK  {Path(p).name}")
    print()
    if bad:
        print(f"RESULTAT: {bad} fichier(s) que Shopify refusera — corrige avant de pousser")
        return 1
    print("RESULTAT: aucun motif de rejet silencieux")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or sorted(str(p) for p in Path("theme/sections").glob("*.liquid"))))
