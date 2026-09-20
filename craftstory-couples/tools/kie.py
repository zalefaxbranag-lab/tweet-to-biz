#!/usr/bin/env python3
# CraftStory - generateur d'images KIE (couples). A lancer sur TA machine.
#   python3 kie.py probe          -> quels modeles ton compte accepte (0 credit)
#   python3 kie.py page           -> les 9 visuels de la page (~18 cr/image)
#   python3 kie.py demo --photo p -> 3 visuels avec VOTRE couple (photo requise)
#   python3 kie.py faces          -> les 5 visages des avis et du hero (~90 cr)
#   python3 kie.py banner         -> le fond de How It Works, desktop + mobile
# La cle est demandee a l'ecran si KIE_KEY n'est pas dans l'environnement :
# elle ne passe donc pas par l'historique du shell.
import argparse, base64, getpass, json, mimetypes, os, sys, time
from pathlib import Path
try:
    import requests
except ImportError:
    sys.exit("Manque une dependance -> lance : pip3 install requests")

UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload"
CREATE = "https://api.kie.ai/api/v1/jobs/createTask"
RECORD = "https://api.kie.ai/api/v1/jobs/recordInfo"
CREDIT = "https://api.kie.ai/api/v1/chat/credit"
DEFAULT_MODEL = "nano-banana-pro"
CANDIDATES = ["nano-banana-pro", "seedream/4.5-edit", "seedream/5-pro-image-to-image",
              "flux-2/pro-text-to-image", "flux-2/pro-image-to-image",
              "gpt-image-2", "google/nano-banana-edit"]

NOSPLIT = ("One single full-frame image, no borders, no split image, no duplicate, "
           "no collage, no text, no watermark, no logo.")
REAL = ("Photorealistic editorial photograph, full-frame camera, 35mm lens at f/2, natural "
        "light, realistic skin texture with visible pores, shallow depth of field, subtle "
        "film grain, warm filmic colour grade. Not an illustration, not a render, not "
        "AI-looking, no plastic skin, no over-smoothing.")

# Les avatars ne doivent PAS avoir le rendu editorial : une photo de profil est
# un cliche de telephone, cadre de travers, lumiere quelconque. D'ou ce style
# de remplacement, pose emplacement par emplacement.
PHONE = ("Candid smartphone photo used as a social media profile picture. Head and "
         "shoulders, face centred and filling most of the frame, shot slightly above eye "
         "level at arm's length. Natural daylight, soft and uneven. Real skin with pores "
         "and slight shine, no retouching, no makeup styling. Relaxed genuine expression, "
         "looking at the lens. Slightly imperfect framing, mild motion softness, ordinary "
         "phone-camera colour. Not a studio portrait, not a professional headshot, not a "
         "stock photo, no ring light, no plain white backdrop, no glamour, no airbrushing.")

# Cinq visages pour la rangee du hero et les avis. Ils s'affichent en cercles de
# 38 a 44 px : a cette taille seuls la forme du visage, les cheveux, le teint et
# LE FOND se distinguent. D'ou cinq fonds franchement differents.
FACES = {
 "face-daniel": ("1:1", "A man in his early forties, short dark hair greying at the temples, light stubble, plain navy crewneck. Sitting in a car in daylight, out-of-focus windscreen and grey sky behind him. Cool neutral grey background.", PHONE),
 "face-amelia": ("1:1", "A woman in her early thirties and a man beside her, cheeks nearly touching, both slightly windblown. She has long light-brown hair, he has a close beard. Outdoors on a bright overcast day, blurred green hedge behind them. Cool green background.", PHONE),
 "face-priya": ("1:1", "A woman in her early thirties, dark hair pulled back loosely, small gold hoop earrings, mustard knit jumper. Indoors by a window, warm cream wall behind her, soft light on one side of her face. Warm cream background.", PHONE),
 "face-marco": ("1:1", "A man in his mid thirties, thick dark curly hair, olive skin, white t-shirt. Outdoors in late afternoon sun, blurred warm terracotta wall behind him, strong golden side light. Warm orange background.", PHONE),
 "face-hero":  ("1:1", "A woman in her early fifties, silver-grey bob, reading glasses pushed up on her head, deep red blouse. Indoors in a kitchen, blurred dark wood cabinets behind her. Dark background.", PHONE),
}

# Le fond de la section How It Works. Un voile noir a 60 % passe par-dessus et le
# texte est cale a gauche : il faut une image CLAIRE et un tiers gauche vide.
# 3:2 plutot que 16:9 parce que ce ratio est deja passe sur ce compte, et la
# section recadre en cover de toute facon.
BANNER = {
 "how-desktop": ("3:2", "A couple in their thirties slow-dancing barefoot in a warm living room at golden hour. They are in the right third of the frame, turned three-quarters away from camera, her cheek against his shoulder, his hand at her waist, an unposed in-between moment. Low late afternoon sun floods through a tall window behind them, rimming their hair and shoulders, dust suspended in the light. The left third is deliberately quiet: a bare warm plaster wall with the soft rectangle of window light falling across it, nothing to read. Amber and terracotta palette, cream walls, bright warm highlights that keep their detail. Not a dark scene, not low key."),
 "how-mobile":  ("1:1", "The same couple in their thirties slow-dancing barefoot in the same warm living room at golden hour, small in the lower-right corner of the frame, turned three-quarters away from camera, her cheek against his shoulder. Low sun pours in from out of frame to the right, rimming their hair. The upper two thirds of the frame are deliberately empty: a bare warm plaster wall with a soft rectangle of window light, no objects, no furniture. Amber and terracotta palette, bright warm highlights. Not a dark scene, not low key."),
}

PAGE = {
 "first-dance": ("3:2", "A newly married couple in their thirties sharing their first dance in a warmly lit reception hall, string lights overhead, guests blurred behind, her head on his shoulder, mid-movement, candid."),
 "proposal": ("2:3", "A man on one knee proposing to a woman on a quiet coastal path at golden hour, her hands over her mouth, genuine shock and joy, the sea out of focus behind them, shot from a respectful distance like a real candid photograph."),
 "anniversary": ("3:2", "A couple in their forties at a small kitchen table with two glasses of wine and a phone propped against a jar playing music, both laughing at something off-frame, evening light through the window, lived-in home."),
 "wedding-morning": ("2:3", "A bride in a simple dress sitting on the edge of a bed in morning light, holding a phone with earphones in, eyes closed, listening to something moving, soft white curtains, quiet intimate moment before a wedding."),
 "golden": ("3:2", "A couple in their seventies slow-dancing in their living room, he holds her hand up, both smiling with eyes closed, framed photographs on the wall behind them, late-afternoon light, decades of familiarity visible."),
 "long-distance": ("2:3", "A young woman sitting on an airport floor against a window with earphones in, boarding gate behind her, holding her phone against her chest, eyes shining, listening to something personal, blue evening light on the tarmac."),
 "reconciliation": ("3:2", "A couple sitting close on a parked car's tailgate at dusk, one earphone each, shoulders touching, both looking ahead rather than at each other, a moment of repair rather than celebration, muted warm tones."),
 "guests-gift": ("1:1", "A wedding reception table seen from above at night, a phone in the centre playing music with several hands of different ages resting around it, glasses and candles, everyone leaning in to listen, shallow focus on the hands."),
 "just-because": ("3:2", "A couple in their late twenties in a parked car at night, engine off, he has just connected his phone to the stereo, both mid-laugh, dashboard glow on their faces, rain on the windscreen, city lights out of focus."),
}
# Stills de reference pour les clips de VSL, a passer ensuite dans Seedance 2.5.
# Tous en 16:9 et composes POUR UN BANDEAU CENTRAL : le montage final recadre
# chaque moitie en 1920x540 (32:9), donc rien d'important en haut ni en bas de
# cadre, et les deux visages sur la meme ligne horizontale.
BAND = ("Compose for a central horizontal band: both faces on the same horizontal line, "
        "centred vertically, generous empty headroom above and floor below that can be "
        "cropped away without losing anything. Wide two-shot, locked-off tripod framing.")
VSL = {
 # --- couple 1 : les maries, lendemain de noce, chanson de premiere danse
 "vsl1-reaction": ("16:9",
   "A newly married couple in their thirties sitting side by side on a sofa in a dim living "
   "room the morning after their wedding, still in soft clothes, a laptop open on the coffee "
   "table in front of them out of frame, their faces lit almost entirely by the screen with "
   "one warm lamp behind them, leaning slightly into each other, about to watch something. " + BAND),
 "vsl1-musicvideo": ("16:9",
   "A frame from a warm Super-8 style wedding film: a bride and groom mid first dance under "
   "string lights in a wooden barn, motion blur in her dress, halation around the lights, "
   "heavy film grain, slightly faded colours, as if projected."),
 # --- couple 2 : la quarantaine, anniversaire, chanson-recit
 "vsl2-reaction": ("16:9",
   "A couple in their forties sitting close together at a kitchen table at night, a phone "
   "propped against a jar in front of them out of frame, two glasses of wine, the room lit by "
   "the phone screen and a single hanging bulb, her hand flat on the table near his, both "
   "watching something on the small screen. " + BAND),
 "vsl2-musicvideo": ("16:9",
   "A frame from a grainy 16mm home-movie montage: a young couple running across a car park "
   "in the rain in clothes from fifteen years ago, laughing, overexposed highlights, dust and "
   "scratches on the emulsion, handheld and slightly out of focus."),
 # --- couple 3 : les soixante-dix ans, cinquante ans de mariage
 "vsl3-reaction": ("16:9",
   "A couple in their seventies sitting together on a worn sofa in a living room full of "
   "framed photographs, a tablet propped on a cushion in front of them out of frame, both "
   "leaning forward slightly, her hand holding his forearm, faces lit by the small screen, "
   "late evening. " + BAND),
 "vsl3-musicvideo": ("16:9",
   "A frame from a black-and-white archival-looking film: a young couple in 1970s clothes on "
   "the steps of a registry office, confetti in the air, high contrast, visible film grain, "
   "the kind of footage transferred from an old reel."),
}

DEMO = {
 "demo-meeting": ("16:9", "a warm late-afternoon street corner with low golden sun and shallow depth of field, two people noticing each other"),
 "demo-home": ("16:9", "a kitchen lit at night, two people slow-dancing barefoot, practical lights, film grain"),
 "demo-wedding": ("16:9", "a wedding first dance, wide shot, string lights overhead, guests blurred behind"),
}

def key():
    k = os.environ.get("KIE_KEY", "").strip()
    if not k:
        k = getpass.getpass("Cle KIE (invisible en tapant, collage OK) : ").strip()
    if not k:
        sys.exit("Pas de cle, j'arrete.")
    return k

def H(k): return {"Authorization": "Bearer " + k, "Content-Type": "application/json"}

def credits(k):
    try:
        print("  solde : " + requests.get(CREDIT, headers=H(k), timeout=30).text.strip()[:200])
    except Exception as e:
        print("  (solde indisponible : %s)" % e)

def upload(k, path):
    p = Path(path)
    if not p.is_file(): sys.exit("Photo introuvable : " + str(path))
    mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
    body = {"base64Data": "data:%s;base64,%s" % (mime, base64.b64encode(p.read_bytes()).decode()),
            "uploadPath": "craftstory/couples",
            "fileName": "ref-%d%s" % (int(time.time()), p.suffix or ".jpg")}
    r = requests.post(UPLOAD, headers=H(k), json=body, timeout=180)
    try: j = r.json()
    except Exception: sys.exit("Upload illisible (HTTP %s) %s" % (r.status_code, r.text[:300]))
    u = j.get("downloadUrl") or (j.get("data") or {}).get("downloadUrl") or (j.get("data") or {}).get("url")
    if not u: sys.exit("Upload sans URL -> " + json.dumps(j)[:400])
    print("  photo de reference uploadee")
    return u

def poll(k, tid, tries=90, every=2.0):
    for _ in range(tries):
        time.sleep(every)
        try: d = (requests.get(RECORD, headers=H(k), params={"taskId": tid}, timeout=60).json().get("data") or {})
        except Exception: continue
        f = d.get("successFlag")
        if f == 1:
            try: urls = json.loads(d.get("resultJson") or "{}").get("resultUrls") or []
            except Exception: urls = []
            return (urls[0], None) if urls else (None, "succes sans URL de resultat")
        if f in (2, 3):
            return None, ("echec modele (successFlag=%s) %s" % (f, d.get("failMsg") or d.get("errorMessage") or ""))[:300]
    return None, "expire apres ~%ds" % int(tries * every)

def run(k, model, slots, out, ref, dry):
    out.mkdir(parents=True, exist_ok=True)
    ok, bad = [], []
    for i, (name, slot) in enumerate(slots.items(), 1):
        aspect, txt = slot[0], slot[1]
        style = slot[2] if len(slot) > 2 else REAL
        if ref:
            # Le libelle de scene est parfois un fragment, parfois une phrase complete :
            # on l'isole apres "Scene:" pour que la consigne reste grammaticale dans les deux cas.
            prompt = ("A reference photograph of a real couple is provided. Recreate that exact "
                      "couple in the scene described below. Scene: %s The photograph is the ground "
                      "truth for both faces: keep exactly what it shows and add no features that "
                      "are not in it. Render the faces in the same style as the scene, never a "
                      "pasted photograph; keep head size and body proportions. %s %s"
                      % (txt if txt.endswith(".") else txt + ".", style, NOSPLIT))
        else:
            prompt = "%s %s %s" % (txt, style, NOSPLIT)
        print("\n[%d/%d] %s  (%s)" % (i, len(slots), name, aspect))
        if dry:
            print("  DRY-RUN %d car : %s..." % (len(prompt), prompt[:200])); continue
        payload = {"prompt": prompt, "output_format": "png", "aspect_ratio": aspect}
        if ref: payload["image_input"] = [ref]          # nano-banana-pro : image_input, PAS image_urls
        r = requests.post(CREATE, headers=H(k), json={"model": model, "input": payload}, timeout=120)
        try: j = r.json()
        except Exception: j = {}
        tid = (j.get("data") or {}).get("taskId") or (j.get("data") or {}).get("recordId")
        if not tid:
            e = "HTTP %s -> %s" % (r.status_code, (json.dumps(j) if j else r.text)[:300])
            print("  x creation : " + e); bad.append((name, e)); continue
        print("  tache %s - attente..." % tid, end="", flush=True)
        url, err = poll(k, tid)
        if err:
            print("\n  x " + err); bad.append((name, err)); continue
        dest = out / ("cs-duo-%s.png" % name)
        resp = requests.get(url, timeout=300); resp.raise_for_status()
        dest.write_bytes(resp.content)
        print("\n  OK %s (%d Ko)" % (dest.name, dest.stat().st_size // 1024))
        ok.append(dest)
    print("\n" + "-" * 62)
    print("Termine : %d reussies, %d echouees -> %s/" % (len(ok), len(bad), out.resolve()))
    for n, e in bad: print("  x %s: %s" % (n, e[:110]))
    if ok: print("\nOuvre le dossier :  open '%s'" % out.resolve())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["probe", "page", "demo", "vsl", "faces", "banner"])
    ap.add_argument("--photo"); ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--out", default="./kie-out"); ap.add_argument("--only")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    k = key()
    if a.command == "probe":
        print("Sonde des modeles (0 credit) : un nom CONNU repond une erreur de parametre,")
        print("un nom inconnu repond 'model name not supported'.\n")
        credits(k); print()
        good = []
        for m in CANDIDATES:
            try:
                r = requests.post(CREATE, headers=H(k), json={"model": m, "input": {}}, timeout=60)
                b = r.text[:150].replace("\n", " ")
            except Exception as e:
                print("  ERREUR RESEAU %-32s %s" % (m, e)); continue
            unknown = ("not supported" in b.lower()) or ("not found" in b.lower())
            if not unknown: good.append(m)
            print("  %s %-32s HTTP %s  %s" % ("INCONNU " if unknown else "EXISTE  ", m, r.status_code, b[:85]))
        if good:
            print("\nModeles utilisables : " + ", ".join(good))
            print("Etape suivante :  python3 kie.py page --model %s" % good[0])
        else:
            print("\nAucun modele reconnu - colle-moi la sortie complete ci-dessus.")
        return
    slots = dict({"page": PAGE, "demo": DEMO, "vsl": VSL,
                  "faces": FACES, "banner": BANNER}[a.command])
    if a.only:
        w = {s.strip() for s in a.only.split(",")}
        slots = {x: y for x, y in slots.items() if x in w}
        if not slots: sys.exit("Aucun emplacement ne correspond.")
    print("Mode %s - %d images, modele %s (~%d credits)" % (a.command.upper(), len(slots), a.model, len(slots) * 18))
    ref = "<photo de reference>" if (a.dry_run and a.photo) else None
    if not a.dry_run:
        credits(k)
        if a.command == "demo" and not a.photo:
            sys.exit("Le mode demo exige : --photo chemin/vers/photo.jpg")
        if a.photo:
            ref = upload(k, a.photo)
    run(k, a.model, slots, Path(a.out), ref, a.dry_run)

main()
