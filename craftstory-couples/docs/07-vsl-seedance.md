# VSL — clips de réaction, Seedance 2.5 (Higgsfield)

## Format final

Paysage 16:9, 1920×1080. Bandeau haut = la réaction du couple, bandeau bas = le
clip musical qu'ils regardent. 3 couples, 3 chansons, 3 registres émotionnels
différents. Chaque clip fait 5 à 10 s.

## Pourquoi deux générations par clip et pas une

Demander à un modèle vidéo de rendre les deux moitiés en un seul passage échoue
de façon prévisible : la ligne de séparation dérive d'une image à l'autre, les
deux moitiés se contaminent (la lumière de l'une bave sur l'autre), et la moitié
« clip musical » revient floue parce que le modèle dépense sa capacité sur les
visages, qui sont ce qu'il sait faire. En générant séparément :

- chaque moitié dispose de ses 1080p complets ;
- une moitié ratée se relance seule, l'autre est conservée ;
- la synchronisation entre ce qu'on voit à l'écran et la réaction devient un
  choix de montage, pas une loterie.

Le rendu final est identique à l'intention. Seule la fabrication change.

## Conséquence sur le cadrage, à ne pas rater

Le montage recadre chaque source 1920×1080 en **1920×540**, soit du 32:9. Un
sujet cadré au centre du 16:9 survit ; un sujet cadré haut ou bas est décapité.
D'où la clause de bandeau dans tous les prompts : **les deux visages sur la même
ligne horizontale, centrés verticalement, avec du vide en haut et en bas qui
pourra être jeté.** C'est la contrainte la plus facile à oublier et la plus
chère à réparer.

## Réglages du panneau Higgsfield

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Modèle | Seedance 2.5 | — |
| References | l'image de départ (1 image) | c'est elle qui fixe le couple, la pièce et la lumière |
| Durée | 10 s si proposé, sinon 5 s | on coupe les 6-7 meilleures secondes au montage ; plus de matière au même prix |
| Ratio | 16:9 | obligatoire |
| Résolution | 1080p | on recadre à 540 px de haut, partir plus bas devient mou |
| Bitrate | High | le grain et les larmes sont les premiers détails que la compression mange |
| Audio | On | la respiration et le rire cassé portent l'émotion autant que l'image |
| Unlimited mode | off | — |

## Sur l'audio : ne demande jamais de dialogue

Les modèles vidéo actuels produisent une parole inintelligible — des syllabes
qui ressemblent à de l'anglais sans en être. En revanche le **non-verbal** est
fiable : inspiration coupée, rire qui se casse, souffle tremblant. C'est aussi
plus juste dramatiquement : personne ne commente une chanson en la découvrant.
Les prompts ci-dessous demandent donc explicitement *no dialogue*, et la voix
off de la VSL passera par-dessus.

## Le pipeline, trois commandes

```bash
# 1. les images de départ (sur ta machine, via KIE)
python3 kie.py vsl --only vsl1-reaction,vsl1-musicvideo

#    variante : garder le MÊME couple que la photo de première danse
python3 kie.py vsl --only vsl1-reaction --photo kie-out/cs-duo-first-dance.png

# 2. Higgsfield : une génération par image, avec les prompts ci-dessous

# 3. le montage
ffmpeg -i reaction.mp4 -i clip.mp4 -filter_complex \
"[0:v]crop=1920:540:0:270,setsar=1[top];[1:v]crop=1920:540:0:270,setsar=1[bot];[top][bot]vstack=inputs=2[v]" \
-map "[v]" -map 0:a? -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
-c:a aac -b:a 160k -shortest vsl-clip-1.mp4
```

Pour donner plus de place à la réaction, remplacer les deux crops par
`crop=1920:604:0:238` et `crop=1920:476:0:302` — 56/44 au lieu de 50/50. Les
deux hauteurs doivent rester paires, sinon libx264 refuse.

Pas de ffmpeg sur la machine : `brew install ffmpeg`, ou n'importe quel monteur
avec deux pistes empilées.

---

# CLIP 1 — les mariés, lendemain de noce

Chanson : leur première danse. Registre : joie incrédule qui bascule en larmes.

## 1A — la réaction (référence : `cs-duo-vsl1-reaction.png`)

```
Use the reference image as the exact starting frame: same couple, same sofa, same room,
same screen light. Do not change the framing, the lens or the lighting. The camera stays
locked off on a tripod for the whole shot, with a barely perceptible slow push in.

They are watching a music video made about them for the first time.

0-1s: both settled, half-smiling, expecting something ordinary, her shoulders relaxed.
1-3s: the song starts. Her smile changes shape, the corners pulling down before they go
up. He turns his head to look at her instead of the screen.
3-5s: she brings one hand up over her mouth. Her breath catches and her chest lifts
sharply once. Her eyes fill but nothing falls yet.
5-7s: he pulls her into him. She laughs, wet and broken, and the laugh cracks in the
middle.
7-9s: one tear runs and she does not wipe it. He kisses the top of her head, still
watching the screen over her.
9-10s: both go quiet, holding each other, the screen light flickering across their faces.

Audio: no dialogue and no words. A sharp intake of breath around 3s, a broken wet laugh
at 5-6s, one shaky exhale at 8s, and room tone. Faint muffled music as if leaking from
laptop speakers, never clear enough to follow.

Photorealistic, full-frame camera, 35mm lens at f/2, lit only by the screen and one warm
lamp behind them, realistic skin with visible pores, tears catching the screen light,
subtle film grain. Not an illustration, not a render, no plastic skin, no over-smoothing.

Keep both faces on the same horizontal line, centred vertically, with empty headroom
above and floor below. No split screen, no second panel, no overlay, no text, no
watermark, no logo. One single continuous take, no cut.
```

## 1B — le clip musical (référence : `cs-duo-vsl1-musicvideo.png`)

```
Use the reference image as the exact starting frame. Extend it into one continuous
Super-8 wedding film: the bride and groom keep turning slowly through their first dance
under the string lights, her dress trailing with motion blur, the lights smearing into
halation behind them. Handheld with a slight gate weave and frame jitter, heavy film
grain, faded warm colours, a projector flicker in the exposure. The guests stay out of
focus throughout.

Audio: none, or only faint projector noise.

No split screen, no second panel, no text, no watermark, no logo. Keep the couple centred
vertically with empty headroom above and below. One single continuous take, no cut.
```

---

# CLIPS 2 ET 3 — les battements

Les prompts d'image de départ sont dans `tools/kie.py` (mode `vsl`). Seuls les
battements de jeu changent, et c'est ce qui doit rendre les trois clips
différents plutôt que trois fois le même sanglot.

## Clip 2 — la quarantaine, chanson-récit d'anniversaire

Registre : **retenue**. Ils ne s'effondrent pas, ils encaissent.

```
0-2s: both watching flatly, the way you watch something you expect to be nice.
2-4s: he recognises a detail and his eyebrows go up; he looks at her, not the screen.
4-6s: she keeps her eyes on the screen and her jaw tightens. No hand to the face.
6-8s: her hand slides across the table onto his and stays there. Still no crying.
8-10s: she blinks once, hard, and one tear goes. She laughs a single note at herself
and wipes it immediately with the back of her hand.
Audio: no dialogue. One surprised half-laugh from him around 3s, a long slow exhale from
her at 7s, one short embarrassed laugh at 9s, room tone.
```

## Clip 3 — les soixante-dix ans, cinquante ans de mariage

Registre : **submergé, sans spectacle**. C'est le plus fort si on ne le surjoue pas.

```
0-2s: both leaning forward towards the small screen, hands already joined.
2-4s: she stops moving completely. Her mouth opens very slightly.
4-6s: he is the first to go: his chin drops and his eyes close hard for a full second.
6-8s: she squeezes his forearm and does not look away from the screen. Tears are on
both faces without either of them reacting to them.
8-10s: he lifts her hand and holds it against his chest, still watching.
Audio: no dialogue. One long unsteady breath from him at 5s, nothing from her, the room
very quiet, faint muffled music from the tablet.
```

---

# Grille de rejet

Relancer plutôt que sauver, une génération coûte moins cher qu'un clip mou.

1. **La séparation apparaît dans la source** — un bandeau, une bordure, un
   second panneau : le prompt a été mal lu, relancer.
2. **Le cadrage dérive vers le haut ou le bas** — après recadrage en 540 px il
   ne reste plus les deux visages : relancer, la clause de bandeau n'a pas pris.
3. **De la parole** — si on entend des syllabes, c'est du faux anglais : relancer.
4. **Le regard part vers l'objectif** — ils doivent regarder l'écran, hors champ.
   Un regard caméra casse la position de spectateur.
5. **Les larmes arrivent à 0 s** — l'émotion doit se construire, sinon il n'y a
   rien à regarder. Le battement vaut plus que l'intensité.
6. **Les mains** — c'est encore le point faible des modèles, et ici elles sont au
   centre (main sur la bouche, mains jointes). Vérifier avant de monter.
