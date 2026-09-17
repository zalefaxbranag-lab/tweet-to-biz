#!/usr/bin/env python3
"""Ouvre une video le plus pres possible d'un visionnage, pour un lecteur qui ne
voit que des images.

Quatre sorties, parce qu'aucune ne suffit seule :

  1. la fiche technique      -> resolution, fps, duree, piste audio presente ou non
  2. des images regulieres   -> une toutes les ~0.4 s, en planches de 8 lisibles
  3. une courbe de mouvement -> ou ca bouge, combien, et si le mouvement saccade
  4. l'audio en image        -> forme d'onde + spectrogramme + mesure de niveau

Le spectrogramme sert a une chose precise sur des clips generes : reperer une
structure de formants, c'est-a-dire de la parole. Un modele qui "parle" produit
du faux anglais, et ca se voit sur le spectrogramme avant de s'entendre.

    python3 watch.py clip.mp4 [-n 24] [-o dossier]
"""
import argparse, shutil, subprocess, sys
from pathlib import Path

def ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("Ni ffmpeg ni imageio-ffmpeg. Lance : pip install imageio-ffmpeg")

def run(ff, args, **kw):
    return subprocess.run([ff, "-hide_banner", "-y", *args],
                          capture_output=True, text=True, **kw)

def sheet(ff, src, n, out):
    """Images a intervalle regulier. fps=n/duree exige la duree ; on prend le
    chemin robuste : select sur le numero d'image modulo un pas calcule par
    ffmpeg lui-meme via le filtre fps."""
    r = run(ff, ["-i", str(src), "-vf", f"fps={n}/10,scale=1024:-2",
                 "-frames:v", str(n), "-vsync", "vfr", str(out / "f%03d.png")])
    got = sorted(out.glob("f*.png"))
    if not got:  # duree differente de 10 s : on retombe sur un echantillonnage
        run(ff, ["-i", str(src), "-vf", "thumbnail=12,scale=1024:-2",
                 "-frames:v", str(n), "-vsync", "vfr", str(out / "f%03d.png")])
        got = sorted(out.glob("f*.png"))
    for i in range(0, len(got), 8):
        lot = got[i:i + 8]
        lst = out / f"lot{i // 8}.txt"
        lst.write_text("".join(f"file '{p.name}'\n" for p in lot))
        run(ff, ["-f", "concat", "-safe", "0", "-i", str(lst),
                 "-vf", f"scale=640:-2,tile=2x{(len(lot) + 1) // 2}",
                 "-frames:v", "1", str(out / f"planche{i // 8 + 1}.png")],
            cwd=str(out))
        lst.unlink()
    return got

def motion(frames):
    """Difference moyenne entre images consecutives. Revele ce qu'une image fixe
    cache : un mouvement en escalier, un plan mort, un saut de montage."""
    from PIL import Image, ImageChops, ImageStat
    vals = []
    prev = None
    for p in frames:
        im = Image.open(p).convert("L").resize((160, 90))
        if prev is not None:
            vals.append(ImageStat.Stat(ImageChops.difference(prev, im)).mean[0])
        prev = im
    if not vals:
        return
    hi = max(vals) or 1
    print("\n  mouvement entre images (0 = plan mort) :")
    for i, v in enumerate(vals, 1):
        print(f"    {i:>3}->{i+1:<3} {'#' * int(round(v / hi * 40)):<40} {v:5.1f}")
    print(f"    moyenne {sum(vals)/len(vals):.1f}   max {hi:.1f}   "
          f"min {min(vals):.1f}")

def duration(probe):
    """Duree du conteneur, en secondes, depuis la banniere ffmpeg."""
    for line in probe.splitlines():
        s = line.strip()
        if s.startswith("Duration:"):
            hms = s.split("Duration:", 1)[1].split(",")[0].strip()
            try:
                h, m, sec = hms.split(":")
                return int(h) * 3600 + int(m) * 60 + float(sec)
            except ValueError:
                return None
    return None


def audio(ff, src, out):
    probe = run(ff, ["-i", str(src)]).stderr
    if " Audio:" not in probe:
        print("\n  AUCUNE PISTE AUDIO dans le fichier.")
        return
    # L'axe horizontal de showwavespic couvre la duree de la PISTE AUDIO, pas
    # celle de l'image. Une piste plus courte decalerait la lecture des
    # evenements : on la complete de silence jusqu'a la duree du conteneur.
    dur = duration(probe)
    pad = f"apad=whole_dur={dur:.3f}," if dur else ""
    if not dur:
        print("  (duree illisible : l'axe du waveform couvre la piste audio seule)")
    # showwavespic dessine sur un fond transparent : sans aplat derriere,
    # le PNG s'ouvre en blanc sur blanc et ne montre rien.
    run(ff, ["-i", str(src), "-filter_complex",
             "color=c=#101014:s=1600x300[bg];"
             f"[0:a]{pad}showwavespic=s=1600x300:colors=#7DD3FC[w];"
             "[bg][w]overlay=format=auto", "-frames:v", "1",
             str(out / "audio-onde.png")])
    run(ff, ["-i", str(src), "-lavfi",
             f"[0:a]{pad}showspectrumpic=s=1600x600:legend=1", "-frames:v", "1",
             str(out / "audio-spectre.png")])
    r = run(ff, ["-i", str(src), "-af", "volumedetect", "-f", "null", "-"])
    for line in r.stderr.splitlines():
        if "mean_volume" in line or "max_volume" in line:
            print("  " + line.split("] ", 1)[-1])
    print("  audio-onde.png + audio-spectre.png ecrits")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("-n", type=int, default=24)
    ap.add_argument("-o", default=None)
    a = ap.parse_args()
    src = Path(a.video)
    if not src.is_file():
        sys.exit(f"Introuvable : {src}")
    out = Path(a.o or (src.parent / (src.stem + "-watch")))
    out.mkdir(parents=True, exist_ok=True)
    ff = ffmpeg()

    print(f"{src.name}")
    for line in run(ff, ["-i", str(src)]).stderr.splitlines():
        s = line.strip()
        if s.startswith("Duration") or " Video:" in s or " Audio:" in s:
            print("  " + s)

    frames = sheet(ff, src, a.n, out)
    print(f"\n  {len(frames)} images + "
          f"{len(list(out.glob('planche*.png')))} planches -> {out}/")
    motion(frames)
    audio(ff, src, out)

main()
