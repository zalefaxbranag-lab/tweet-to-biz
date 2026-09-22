#!/usr/bin/env python3
"""Fabrique six plans WebM et une chanson de test.

Chaque plan porte SON NUMERO en gros et une barre qui avance : c'est le seul
moyen de verifier dans le navigateur que le bon plan passe au bon instant, et
qu'il joue vraiment au lieu de rester sur sa premiere image.

Rien de reel n'entre ici : ni photo de client, ni musique sous licence.
"""
import os
import subprocess
import wave
import math
import struct
from PIL import Image, ImageDraw

FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
D = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/flow/take/"
os.makedirs(D, exist_ok=True)

TINT = [(214, 132, 96), (96, 132, 214), (120, 190, 140), (222, 178, 90),
        (176, 118, 200), (90, 176, 190)]
W, H, FPS, SECS = 640, 360, 15, 6


def clip(n, rgb):
    frames = D + "f%d" % n
    os.makedirs(frames, exist_ok=True)
    for k in range(FPS * SECS):
        im = Image.new("RGB", (W, H), rgb)
        d = ImageDraw.Draw(im)
        # Le numero du plan, assez gros pour etre lu sur une capture.
        d.rectangle([W // 2 - 70, H // 2 - 90, W // 2 + 70, H // 2 + 50], fill=(0, 0, 0))
        d.text((W // 2 - 14, H // 2 - 34), str(n), fill=(255, 255, 255))
        # Une barre qui avance : si elle bouge, la video joue.
        x = int(W * (k / float(FPS * SECS - 1)))
        d.rectangle([0, H - 26, x, H], fill=(255, 255, 255))
        im.save(frames + "/%04d.png" % k)
    out = D + "shot%d.webm" % n
    subprocess.run([FF, "-y", "-loglevel", "error", "-framerate", str(FPS),
                    "-i", frames + "/%04d.png", "-c:v", "libvpx", "-b:v", "500k",
                    "-pix_fmt", "yuv420p", out], check=True)
    for f in os.listdir(frames):
        os.remove(frames + "/" + f)
    os.rmdir(frames)
    return out


def song(path, secs=34):
    """Une piste avec un temps fort net toutes les cinq secondes."""
    raw = D + "song.wav"
    sr = 22050
    w = wave.open(raw, "w")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sr)
    data = bytearray()
    for i in range(sr * secs):
        t = i / float(sr)
        v = 0.16 * math.sin(2 * math.pi * 220 * t)
        # un coup sec sur chaque multiple de 5 s, pour entendre la coupe
        if (t % 5.0) < 0.06:
            v += 0.5 * math.sin(2 * math.pi * 1400 * t) * (1 - (t % 5.0) / 0.06)
        data += struct.pack("<h", int(max(-1, min(1, v)) * 32000))
    w.writeframes(bytes(data))
    w.close()
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", raw,
                    "-c:a", "libopus", "-b:a", "64k", path], check=True)
    os.remove(raw)
    return path


def still(path):
    """Une image fixe, pour le plan dont le clip manque."""
    im = Image.new("RGB", (W, H), (150, 120, 170))
    d = ImageDraw.Draw(im)
    d.rectangle([W // 2 - 90, H // 2 - 26, W // 2 + 90, H // 2 + 26], fill=(0, 0, 0))
    d.text((W // 2 - 26, H // 2 - 6), "STILL", fill=(255, 255, 255))
    im.save(path)
    return path


def scene(n, rgb):
    """Une « scene » fixe, comme celles que la generation rend : 16:9, le
    numero en gros, pour verifier sur une capture laquelle est a l'ecran."""
    im = Image.new("RGB", (960, 540), rgb)
    d = ImageDraw.Draw(im)
    d.rectangle([380, 170, 580, 370], fill=(0, 0, 0))
    d.text((470, 260), "S%d" % n, fill=(255, 255, 255))
    path = D + "scene%d.png" % n
    im.save(path)
    return path


if __name__ == "__main__":
    for n in range(1, 7):
        print("  " + scene(n, TINT[n - 1]))
    for n in range(1, 7):
        print("  " + clip(n, TINT[n - 1]))
    print("  " + still(D + "still.png"))
    print("  " + song(D + "song.webm"))
