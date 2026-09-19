#!/usr/bin/env python3
"""Refuse un template JSON que Shopify refuserait.

A lancer avant tout push de templates/page.*.json :

    python3 qa/template_check.py theme/templates/page.couples.json

Ce que ca attrape, et pourquoi ca compte : `themeFilesUpsert` avec un corps
`URL` renvoie `userErrors: []` **et n'applique rien** quand le contenu est
invalide. Avec un corps `TEXT`, la meme erreur arrive nommee. Une seance
entiere a ete perdue sur `"icon": "★"` pose sur un reglage `image_picker` :
le seul symptome etait un fichier qui ne changeait pas.

La regle a retenir : pousser un template JSON en `TEXT`, jamais en `URL`.
"""
import json, os, re, sys

# Ces types n'acceptent pas une chaine libre : Shopify veut une vraie URL
# (shopify://...) ou un identifiant de ressource. La chaine vide est refusee
# aussi — il faut omettre le reglage pour retomber sur le defaut du schema.
RESOURCE = {"image_picker", "video", "url", "video_url", "font_picker", "collection",
            "product", "blog", "page", "link_list", "article", "collection_list",
            "product_list", "metaobject", "metaobject_list"}
TEXTUAL = {"text", "textarea", "html", "richtext", "color", "inline_richtext", "liquid"}


def schema_of(section_type, sections_dir):
    path = os.path.join(sections_dir, section_type + ".liquid")
    if not os.path.exists(path):
        return None  # section fournie par le theme, pas par le depot
    src = open(path, encoding="utf-8").read()
    m = re.search(r"\{% schema %\}(.*?)\{% endschema %\}", src, re.S)
    return json.loads(m.group(1)) if m else None


def check_settings(defs, values, where, errors):
    by_id = {d["id"]: d for d in defs if d.get("id")}
    for key, val in values.items():
        d = by_id.get(key)
        if not d:
            errors.append("%s.%s : ce reglage n'existe pas dans le schema" % (where, key))
            continue
        t = d["type"]
        if t in RESOURCE:
            # La chaine vide passe : c'est ce que l'editeur de theme ecrit lui-meme
            # pour un reglage non renseigne. C'est une valeur NON VIDE qui n'est pas
            # une reference qui fait refuser le fichier, en silence si le corps est
            # une URL. Le cas reel : "icon": "★" sur un image_picker.
            if val not in ("", None) and (
                    not isinstance(val, str)
                    or not re.match(r"^(shopify://|https?://|mailto:|tel:|#|/)", val)):
                errors.append("%s.%s : type %s, %r n'est pas une reference valide "
                              "(shopify://, https://, / ou #) — laisser vide si inutilise"
                              % (where, key, t, val))
        elif t == "checkbox" and not isinstance(val, bool):
            errors.append("%s.%s : attend un booleen, recu %r" % (where, key, val))
        elif t == "range":
            if not isinstance(val, (int, float)):
                errors.append("%s.%s : attend un nombre, recu %r" % (where, key, val))
            else:
                lo, hi, step = d.get("min", 0), d.get("max", 100), d.get("step", 1)
                if not lo <= val <= hi:
                    errors.append("%s.%s : %r hors de [%s, %s]" % (where, key, val, lo, hi))
                elif round((val - lo) / step, 6) % 1:
                    errors.append("%s.%s : %r n'est pas sur un pas de %s" % (where, key, val, step))
        elif t == "select":
            allowed = [o["value"] for o in d.get("options", [])]
            if val not in allowed:
                errors.append("%s.%s : %r absent de %s" % (where, key, val, allowed))
        elif t in TEXTUAL and not isinstance(val, str):
            errors.append("%s.%s : attend une chaine, recu %r" % (where, key, val))


def check(path):
    sections_dir = os.path.join(os.path.dirname(os.path.dirname(path)), "sections")
    raw = open(path, encoding="utf-8").read()
    doc = json.loads(re.sub(r"/\*.*?\*/", "", raw, flags=re.S))
    errors = []

    missing = [k for k in doc["order"] if k not in doc["sections"]]
    orphans = [k for k in doc["sections"] if k not in doc["order"]]
    errors += ["%s est dans order mais pas dans sections" % k for k in missing]
    errors += ["%s est dans sections mais pas dans order" % k for k in orphans]

    for key in doc["order"]:
        sec = doc["sections"].get(key)
        if not sec:
            continue
        sch = schema_of(sec["type"], sections_dir)
        if sch is None:
            continue
        check_settings(sch["settings"], sec.get("settings", {}), key, errors)

        block_defs = {b["type"]: b["settings"] for b in sch.get("blocks", [])}
        blocks = sec.get("blocks", {})
        cap = sch.get("max_blocks")
        if cap and len(blocks) > cap:
            errors.append("%s : %d blocs pour un maximum de %d" % (key, len(blocks), cap))
        listed = set(sec.get("block_order", []))
        for bid in blocks:
            if bid not in listed:
                errors.append("%s.%s : bloc absent de block_order" % (key, bid))
        for bid in sec.get("block_order", []):
            if bid not in blocks:
                errors.append("%s : block_order cite %s qui n'existe pas" % (key, bid))
        for bid, blk in blocks.items():
            if blk["type"] not in block_defs:
                errors.append("%s.%s : type de bloc %r inconnu" % (key, bid, blk["type"]))
                continue
            check_settings(block_defs[blk["type"]], blk.get("settings", {}),
                           "%s.%s" % (key, bid), errors)
    return errors


if __name__ == "__main__":
    targets = sys.argv[1:] or ["theme/templates/page.couples.json"]
    total = 0
    for t in targets:
        errs = check(t)
        total += len(errs)
        print("  %s %s" % ("KO " if errs else "OK ", os.path.basename(t)))
        for e in errs:
            print("       " + e)
    print("\nRESULTAT: %s" % ("aucun motif de refus" if not total
                              else "%d probleme(s) — Shopify refuserait" % total))
    sys.exit(1 if total else 0)
