#!/usr/bin/env python3
"""Ouvre une video pour inspection : fiche technique, N images reparties, planche contact.

Pourquoi : l'assistant lit des images, pas des videos. Extraire des images fixes
est donc le seul moyen de juger un rendu (grain, peau, cadrage, derive du split).

    python3 frames.py chemin/vers/clip.mp4 [-n 8] [-o dossier]
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

def exe(name):
    p = shutil.which(name)
    if p:
        return p
    try:
        import imageio_ffmpeg
        p = imageio_ffmpeg.get_ffmpeg_exe()
        return p if name == "ffmpeg" else p.replace("ffmpeg-", "ffprobe-")
    except ImportError:
        sys.exit("Ni ffmpeg ni imageio-ffmpeg. Lance : pip install imageio-ffmpeg")

def probe(ff, src):
    """Pas de ffprobe dans le paquet pypi : on lit la banniere de ffmpeg."""
    r = subprocess.run([ff, "-hide_banner", "-i", str(src)], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        s = line.strip()
        if s.startswith("Duration") or " Video:" in s or " Audio:" in s:
            print("  " + s)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("-n", type=int, default=8, help="nombre d'images (defaut 8)")
    ap.add_argument("-o", default=None, help="dossier de sortie")
    a = ap.parse_args()

    src = Path(a.video)
    if not src.is_file():
        sys.exit(f"Introuvable : {src}")
    out = Path(a.o or (src.parent / (src.stem + "-frames")))
    out.mkdir(parents=True, exist_ok=True)
    ff = exe("ffmpeg")

    print(f"{src.name}")
    probe(ff, src)

    # fps=n/duree donnerait un calcul de duree fragile ; on laisse ffmpeg
    # echantillonner puis on garde les n premieres.
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                    "-vf", f"thumbnail=24,scale=1280:-2", "-frames:v", str(a.n),
                    "-vsync", "vfr", str(out / "f%02d.png")], check=True)
    got = sorted(out.glob("f*.png"))
    if not got:
        sys.exit("Aucune image extraite.")

    cols = 2
    rows = (len(got) + cols - 1) // cols
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(out / "f%02d.png"),
                    "-vf", f"scale=960:-2,tile={cols}x{rows}",
                    str(out / "planche.png")], check=True)

    print(f"\n  {len(got)} images + planche.png -> {out}/")
    for p in got:
        print(f"    {p.name}  {p.stat().st_size // 1024} Ko")

main()
