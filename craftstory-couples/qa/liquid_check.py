#!/usr/bin/env python3
"""Verifie l'equilibre des balises de bloc Liquid dans les sections de theme.

Shopify refuse un fichier desequilibre a l'upload, mais on veut le savoir AVANT
de pousser. node --check ne valide que le JS, et json.loads que le schema :
ni l'un ni l'autre ne regarde le Liquid.
"""
import re, sys, glob, os

OPEN  = {"if","unless","case","for","tablerow","capture","form","paginate","comment","raw","schema","stylesheet","javascript","style","liquid"}
CLOSE = {f"end{t}" for t in OPEN}
NEUTRAL = {"else","elsif","when","break","continue","assign","echo","include","render","section","layout","increment","decrement","cycle","liquid"}

def check(path):
    src = open(path, encoding="utf-8").read()
    # on ignore ce qui est dans {% raw %} et dans les chaines du schema
    stack, errors = [], []
    for m in re.finditer(r"\{%-?\s*(\w+)", src):
        tag = m.group(1)
        line = src.count("\n", 0, m.start()) + 1
        if tag == "liquid":
            # bloc {% liquid %} : tags sur des lignes, sans accolades
            end = src.find("%}", m.end())
            body = src[m.end():end]
            for ln in body.splitlines():
                w = ln.strip().split(" ")[0] if ln.strip() else ""
                if w in OPEN and w != "liquid": stack.append((w, line))
                elif w in CLOSE:
                    want = w[3:]
                    if not stack or stack[-1][0] != want:
                        errors.append(f"ligne {line}: '{w}' sans '{want}' ouvert")
                    else: stack.pop()
            continue
        if tag in OPEN:
            stack.append((tag, line))
        elif tag in CLOSE:
            want = tag[3:]
            if not stack:
                errors.append(f"ligne {line}: '{tag}' alors que rien n'est ouvert")
            elif stack[-1][0] != want:
                errors.append(f"ligne {line}: '{tag}' mais '{stack[-1][0]}' (ligne {stack[-1][1]}) est ouvert")
            else:
                stack.pop()
    for tag, line in stack:
        errors.append(f"ligne {line}: '{tag}' jamais ferme")
    return errors

paths = sys.argv[1:] or sorted(glob.glob("*.liquid"))
bad = 0
for p in paths:
    errs = check(p)
    if errs:
        bad += 1
        print(f"✗ {os.path.basename(p)}")
        for e in errs: print(f"    {e}")
    else:
        print(f"✓ {os.path.basename(p)}")
print()
print("RESULTAT:", "toutes les sections sont equilibrees" if not bad else f"{bad} fichier(s) a corriger")
sys.exit(1 if bad else 0)
