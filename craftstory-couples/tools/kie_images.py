#!/usr/bin/env python3
"""
Generateur d'images KIE pour la landing page couples de CraftStory.

Pourquoi ce script existe : l'environnement d'execution de l'assistant filtre les
sorties reseau et n'autorise pas api.kie.ai, donc la generation ne peut pas etre
lancee de la-bas. Sur ta machine, il n'y a pas ce filtre. Tu lances ce fichier,
il fait tout : upload, creation des taches, polling, telechargement, nommage.

────────────────────────────────────────────────────────────────────────────────
INSTALLATION (une fois)
    pip install requests

LA CLE — jamais dans le fichier, toujours en variable d'environnement :
    macOS / Linux :   export KIE_KEY="ta_cle"
    Windows PowerShell :   $env:KIE_KEY="ta_cle"

UTILISATION

  1) Verifier quels modeles existent sur ton compte (gratuit, 0 credit) :
        python3 kie_images.py probe

  2) Generer les images de la page (couples fictifs, pas de photo requise) :
        python3 kie_images.py page

  3) Generer les visuels de demo avec VOTRE couple (photo de reference requise) :
        python3 kie_images.py demo --photo chemin/vers/photo.jpg

  Options utiles :
        --only partner,proposal      ne genere que ces emplacements
        --model nano-banana-pro      force un modele
        --out ./images               dossier de sortie (defaut: ./kie-out)
        --dry-run                    affiche ce qui serait fait, n'appelle rien

────────────────────────────────────────────────────────────────────────────────
COUTS (notes du proprietaire, a reverifier sur la grille KIE)
    nano-banana-pro      ~18 credits par image
    seedream/4.5-edit    ~6 credits par image
    Une sonde de modele invalide : 0 credit.
    Le mode `page` genere 9 images => ~162 credits avec nano-banana-pro.
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Il manque une dependance. Lance : pip install requests")

# ── Endpoints (source : references/ids-and-access.md du skill craftstory-project)
UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload"
CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask"
RECORD_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"
CREDIT_URL = "https://api.kie.ai/api/v1/chat/credit"

# Modele par defaut : le seul valide en production sur ce compte d'apres le skill.
# `probe` te dira lesquels ton compte accepte reellement.
DEFAULT_MODEL = "nano-banana-pro"

# Candidats a sonder. Les ids de modeles KIE ne se devinent pas : cette liste
# vient des notes du proprietaire. `probe` separe ceux qui existent des autres.
PROBE_CANDIDATES = [
    "nano-banana-pro",
    "seedream/4.5-edit",
    "seedream/5-pro-image-to-image",
    "flux-2/pro-text-to-image",
    "flux-2/pro-image-to-image",
    "gpt-image-2",
    "google/nano-banana-edit",
]

# ── Regles de prompt. Elles viennent d'echecs constates, pas de gout.
#    (ai-generation.md §6 : l'identite vient UNIQUEMENT de la photo de reference ;
#     decrire un visage fait deriver vers un visage generique.)
ANTI_SPLIT = ("One single full-frame image, no borders, no split image, no duplicate, "
              "no collage, no text, no watermark, no logo.")
PHOTOREAL = ("Photorealistic editorial photograph, shot on a full-frame camera with a "
             "35mm lens at f/2, natural light, realistic skin texture with visible pores "
             "and fine detail, shallow depth of field, subtle film grain, colour-graded "
             "warm and filmic. Not an illustration, not a render, not AI-looking, "
             "no plastic skin, no over-smoothing, no waxy highlights.")

# ── Les 9 emplacements d'occasions de la page, adaptes aux couples.
#    Ratios calques sur ceux du concurrent (paysage / portrait / carre melanges).
PAGE_SLOTS = {
    "first-dance": dict(
        aspect="3:2",
        prompt="A newly married couple in their thirties sharing their first dance in a "
               "warmly lit reception hall, string lights overhead, guests blurred in the "
               "background, her head resting on his shoulder, mid-movement, caught candidly."),
    "proposal": dict(
        aspect="2:3",
        prompt="A man on one knee proposing to a woman on a quiet coastal path at golden "
               "hour, her hands over her mouth, genuine shock and joy, the sea out of focus "
               "behind them, shot from a respectful distance like a real candid photograph."),
    "anniversary": dict(
        aspect="3:2",
        prompt="A couple in their forties at a small kitchen table with two glasses of wine "
               "and a phone propped against a jar playing music, both laughing at something "
               "off-frame, evening light through the window, lived-in home."),
    "wedding-morning": dict(
        aspect="2:3",
        prompt="A bride in a simple dress sitting on the edge of a bed in morning light, "
               "holding a phone to her ear with earphones in, eyes closed, listening to "
               "something moving, soft white curtains, quiet intimate moment before a wedding."),
    "golden": dict(
        aspect="3:2",
        prompt="A couple in their seventies slow-dancing in their living room, he is holding "
               "her hand up, both smiling with their eyes closed, framed photographs on the "
               "wall behind them, late-afternoon light, decades of familiarity visible."),
    "long-distance": dict(
        aspect="2:3",
        prompt="A young woman sitting on an airport floor against a window with earphones in, "
               "boarding gate behind her, holding her phone against her chest, eyes shining, "
               "listening to something personal, blue evening light on the tarmac."),
    "reconciliation": dict(
        aspect="3:2",
        prompt="A couple sitting close together on a parked car's tailgate at dusk, one "
               "earphone each, shoulders touching, both looking ahead rather than at each "
               "other, a moment of repair rather than celebration, muted warm tones."),
    "guests-gift": dict(
        aspect="1:1",
        prompt="A wedding reception table seen from above at night, a phone in the centre "
               "playing music with several hands of different ages resting around it, glasses "
               "and candles, everyone leaning in to listen, shallow focus on the hands."),
    "just-because": dict(
        aspect="3:2",
        prompt="A couple in their late twenties in a small car at night, she is driving and "
               "he has just connected his phone to the stereo, both mid-laugh, dashboard "
               "glow on their faces, rain on the windscreen, city lights out of focus."),
}

# ── Emplacements de demo : necessitent la photo du couple (ressemblance obligatoire).
DEMO_SLOTS = {
    "demo-meeting": dict(
        aspect="16:9",
        scene="a warm late-afternoon street corner with low golden sun and shallow depth "
              "of field, two people noticing each other"),
    "demo-home": dict(
        aspect="16:9",
        scene="a kitchen lit at night, two people slow-dancing barefoot, practical lights, "
              "film grain"),
    "demo-wedding": dict(
        aspect="16:9",
        scene="a wedding first dance, wide shot, string lights overhead, guests blurred "
              "in the background"),
}


def headers(key):
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def get_key():
    key = os.environ.get("KIE_KEY", "").strip()
    if not key:
        sys.exit("KIE_KEY n'est pas definie.\n"
                 '  macOS/Linux : export KIE_KEY="ta_cle"\n'
                 '  PowerShell  : $env:KIE_KEY="ta_cle"')
    return key


def show_credits(key):
    try:
        r = requests.get(CREDIT_URL, headers=headers(key), timeout=30)
        print(f"  solde de credits : {r.text.strip()[:200]}")
    except Exception as e:
        print(f"  (solde indisponible : {e})")


def upload_reference(key, path):
    """Upload une image locale et renvoie son URL temporaire KIE."""
    p = Path(path)
    if not p.is_file():
        sys.exit(f"Photo introuvable : {path}")
    mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
    data = base64.b64encode(p.read_bytes()).decode()
    body = {"base64Data": f"data:{mime};base64,{data}",
            "uploadPath": "craftstory/couples",
            "fileName": f"ref-{int(time.time())}{p.suffix or '.jpg'}"}
    r = requests.post(UPLOAD_URL, headers=headers(key), json=body, timeout=180)
    try:
        j = r.json()
    except Exception:
        sys.exit(f"Upload : reponse illisible (HTTP {r.status_code}) {r.text[:300]}")
    # Le worker de production verifie ces trois emplacements.
    url = j.get("downloadUrl") or (j.get("data") or {}).get("downloadUrl") \
        or (j.get("data") or {}).get("url")
    if not url:
        sys.exit(f"Upload : aucune URL dans la reponse -> {json.dumps(j)[:400]}")
    print(f"  photo de reference uploadee")
    return url


def create_task(key, model, payload):
    r = requests.post(CREATE_URL, headers=headers(key),
                      json={"model": model, "input": payload}, timeout=120)
    try:
        j = r.json()
    except Exception:
        return None, f"HTTP {r.status_code}, reponse illisible : {r.text[:300]}"
    d = j.get("data") or {}
    tid = d.get("taskId") or d.get("recordId")
    if not tid:
        return None, f"HTTP {r.status_code} -> {json.dumps(j)[:400]}"
    return tid, None


def poll_task(key, task_id, budget=90, every=2.0):
    """successFlag 1 = succes, 2 ou 3 = echec dur, autre = en cours."""
    for _ in range(budget):
        time.sleep(every)
        try:
            r = requests.get(RECORD_URL, headers=headers(key),
                             params={"taskId": task_id}, timeout=60)
            d = (r.json().get("data") or {})
        except Exception:
            continue  # aleas reseau : on retente au tour suivant
        flag = d.get("successFlag")
        if flag == 1:
            try:
                urls = json.loads(d.get("resultJson") or "{}").get("resultUrls") or []
            except Exception:
                urls = []
            if urls:
                return urls[0], None
            return None, "succes annonce mais aucune URL de resultat"
        if flag in (2, 3):
            msg = d.get("failMsg") or d.get("errorMessage") or d.get("msg") or ""
            return None, f"echec du modele (successFlag={flag}) {msg}"[:300]
    return None, f"expire apres ~{int(budget * every)}s"


def download(url, dest):
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    dest.write_bytes(r.content)
    return dest.stat().st_size


def cmd_probe(args):
    """Sonde les ids de modeles. Un nom inconnu renvoie 422 'model name not
    supported'. Un nom connu avec des parametres vides renvoie une erreur de
    parametre. Les deux coutent 0 credit : c'est le moyen gratuit de savoir
    lesquels ton compte accepte."""
    key = get_key()
    print("Sonde des modeles (0 credit) — un nom connu repond une erreur de PARAMETRE,")
    print("un nom inconnu repond 'model name not supported'.\n")
    show_credits(key)
    print()
    for m in PROBE_CANDIDATES:
        r = requests.post(CREATE_URL, headers=headers(key),
                          json={"model": m, "input": {}}, timeout=60)
        body = r.text[:150].replace("\n", " ")
        unknown = "not supported" in body.lower() or "not found" in body.lower()
        verdict = "INCONNU  " if unknown else "existe ✓ "
        print(f"  {verdict} {m:<34} HTTP {r.status_code}  {body[:90]}")
    print("\nGarde les lignes 'existe' : ce sont les modeles utilisables ici.")


def run_slots(key, model, slots, out_dir, ref_url=None, dry=False):
    out_dir.mkdir(parents=True, exist_ok=True)
    ok, failed = [], []
    for i, (name, cfg) in enumerate(slots.items(), 1):
        aspect = cfg["aspect"]
        if ref_url:
            prompt = (f"A reference photograph of a real couple is provided. Place that "
                      f"exact couple into {cfg['scene']}. The photograph is the ground "
                      f"truth for both faces: keep exactly what it shows and add no "
                      f"features that are not in it. Render the faces in the same style as "
                      f"the scene, never a pasted photograph; keep head size and body "
                      f"proportions. {PHOTOREAL} {ANTI_SPLIT}")
        else:
            prompt = f"{cfg['prompt']} {PHOTOREAL} {ANTI_SPLIT}"

        print(f"\n[{i}/{len(slots)}] {name}  ({aspect})")
        if dry:
            print(f"  DRY-RUN — prompt ({len(prompt)} car) :\n  {prompt[:260]}...")
            continue

        payload = {"prompt": prompt, "output_format": "png", "aspect_ratio": aspect}
        if ref_url:
            # nano-banana-pro attend `image_input`, PAS `image_urls`.
            payload["image_input"] = [ref_url]

        tid, err = create_task(key, model, payload)
        if err:
            print(f"  ✗ creation : {err}")
            failed.append((name, err))
            continue
        print(f"  tache {tid} — attente…", end="", flush=True)
        url, err = poll_task(key, tid)
        if err:
            print(f"\n  ✗ {err}")
            failed.append((name, err))
            continue
        dest = out_dir / f"cs-duo-{name}.png"
        size = download(url, dest)
        print(f"\n  ✓ {dest.name}  ({size // 1024} Ko)")
        ok.append(dest)

    print("\n" + "─" * 66)
    print(f"Termine : {len(ok)} reussies, {len(failed)} echouees  ->  {out_dir}/")
    for n, e in failed:
        print(f"  ✗ {n}: {e[:110]}")
    if ok:
        print("\nEnsuite : depose ces fichiers dans l'editeur de theme Shopify,")
        print("section par section (chaque emplacement a son selecteur d'image).")


def cmd_page(args):
    key = get_key()
    slots = PAGE_SLOTS
    if args.only:
        wanted = {s.strip() for s in args.only.split(",")}
        slots = {k: v for k, v in slots.items() if k in wanted}
        if not slots:
            sys.exit(f"Aucun emplacement ne correspond. Disponibles : {', '.join(PAGE_SLOTS)}")
    print(f"Mode PAGE — {len(slots)} images, couples fictifs, sans photo de reference.")
    print(f"Modele : {args.model}   (~18 credits/image => ~{len(slots) * 18} credits)")
    if not args.dry_run:
        show_credits(key)
    run_slots(key, args.model, slots, Path(args.out), None, args.dry_run)


def cmd_demo(args):
    key = get_key()
    if not args.photo and not args.dry_run:
        sys.exit("Le mode demo a besoin d'une photo : --photo chemin/vers/photo.jpg")
    print(f"Mode DEMO — {len(DEMO_SLOTS)} images avec la ressemblance du couple.")
    print(f"Modele : {args.model}")
    ref = None
    if not args.dry_run:
        show_credits(key)
        ref = upload_reference(key, args.photo)
    run_slots(key, args.model, DEMO_SLOTS, Path(args.out), ref, args.dry_run)


def main():
    ap = argparse.ArgumentParser(
        description="Genere les images de la landing page couples via l'API KIE.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Emplacements page : " + ", ".join(PAGE_SLOTS) +
               "\nEmplacements demo : " + ", ".join(DEMO_SLOTS))
    ap.add_argument("command", choices=["probe", "page", "demo"],
                    help="probe = tester les modeles (gratuit) | page = les 9 visuels | "
                         "demo = les visuels avec votre couple")
    ap.add_argument("--photo", help="photo du couple (mode demo)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--out", default="./kie-out")
    ap.add_argument("--only", help="liste d'emplacements separes par des virgules")
    ap.add_argument("--dry-run", action="store_true",
                    help="affiche les prompts sans rien appeler ni depenser")
    args = ap.parse_args()

    {"probe": cmd_probe, "page": cmd_page, "demo": cmd_demo}[args.command](args)


if __name__ == "__main__":
    main()
