# Le format réel, mesuré sur la créa CraftStory

Source : `16695d3a…mp4`, 720×1276, 30 fps, 11,19 s, audio AAC stéréo.
Mesures prises sur 24 images extraites, pas estimées à l'œil.

## Géométrie

| Élément | Mesure | Conséquence |
|---|---|---|
| Cadre | 720×1276, ratio 0,5643 | **vertical 9:16**, pas paysage |
| Couture | **51,1 %** de la hauteur (stable sur 12 images sur 14) | le bandeau haut est légèrement plus grand que la moitié |
| Bandeau haut (réaction) | 720×652, ratio **1,10** | quasi carré |
| Bandeau bas (clip) | 720×624, ratio **1,15** | quasi carré |
| Pastille blanche | de 51,1 % à 58,5 %, **87,5 %** de la largeur, centrée | collée sous la couture, elle mange le haut du bandeau bas |
| Carton final | plat jaune + titre + logo, ~1,5 s | mouvement mesuré à 0,0 sur les 4 dernières images |

**Ce que ça invalide dans ce que j'avais écrit :** je partais sur du paysage
16:9 avec des bandeaux en 1920×540, soit du 32:9 ultra-large. Le format réel
donne des bandeaux **quasi carrés**. Il faut donc générer chaque moitié en
**1:1**, pas en 16:9 recadré. C'est aussi ce qui rend la créa intime : un
gros plan en cadre carré, pas une bande panoramique.

## Registre du jeu

La courbe de mouvement donne 11 à 44 entre images, avec une pointe à 100,8 —
une coupe franche vers le carton final. Ce n'est pas un plan au trépied :
c'est proche, ça bouge, des bras traversent l'objectif, le cadre se
recompose.

Et l'arc en 10 secondes tient en **trois battements**, pas six :

1. surprise, bouche ouverte, il regarde l'écran ;
2. explosion physique — bras en l'air, il se soulève du canapé ;
3. il se retourne et **serre la grand-mère dans ses bras**, elle rit et le tient.

Le troisième battement est le point que j'avais manqué : **l'émotion se
résout en un geste vers l'autre personne, pas en larmes face à l'écran.**
C'est ce qui rend la créa chaude au lieu de triste. Mon découpage précédent
— main sur la bouche, larme qui coule, on ne l'essuie pas — visait le
registre du chagrin. Celui qui performe ici est la joie qui déborde.

## Le bandeau bas ne bouge presque pas

Sur les 24 images, le bandeau bas tient **deux plans** : le héros en pied
face au coucher de soleil, puis la main tendue vers le petit dinosaure, avec
un troisième plan sur le tronc d'arbre à la fin. Quasi statique, lent.
Conclusion utile : la moitié « clip musical » ne demande presque pas de
mouvement. C'est la moitié la moins chère à produire, et elle n'a pas besoin
d'être spectaculaire — elle doit seulement justifier la réaction.

## L'audio

Spectrogramme : énergie continue sur les 11 s, sans silence. Bande basse très
chargée sous 1470 Hz, empilements harmoniques striés entre 200 Hz et 4 kHz
(donc **de la voix chantée**), transitoires verticaux réguliers (percussions).
Niveau : crête à **−1,0 dBFS**, moyenne à **−17,4 dB**.

C'est un morceau mixé et masterisé pour le mobile, posé sur toute la durée.
Pas du son d'ambiance, pas des respirations.

**Ce que ça invalide aussi :** j'avais écrit des consignes audio détaillées
dans chaque prompt — inspiration coupée à 3 s, rire cassé à 5-6 s, souffle
tremblant à 8 s. Inutile : **l'audio généré est jeté et remplacé par la
chanson au montage.** Une contrainte de moins à faire échouer au modèle.

## Assemblage, en vertical

Cible 1080×1920. Couture à 51,1 % → 980 px en haut, 940 px en bas (les deux
hauteurs doivent rester paires).

```bash
ffmpeg -i reaction.mp4 -i clip.mp4 -i chanson.mp3 -filter_complex \
"[0:v]scale=1080:1080,crop=1080:980:0:50,setsar=1[top];\
 [1:v]scale=1080:1080,crop=1080:940:0:70,setsar=1[bot];\
 [top][bot]vstack=inputs=2,\
 drawbox=x=68:y=980:w=945:h=144:color=white@1:t=fill,\
 drawtext=text='Create a custom song and music video about the two of you':\
fontcolor=black:fontsize=38:x=(w-text_w)/2:y=1032:line_spacing=8[v]" \
-map "[v]" -map 2:a -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
-c:a aac -b:a 192k -shortest reel.mp4
```

`drawbox` donne une pastille à coins droits ; les coins arrondis de la créa
d'origine se font au monteur. Le carton final (~1,5 s) se colle derrière en
concaténation.
