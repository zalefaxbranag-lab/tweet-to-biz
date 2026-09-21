# La preview couples : le chemin retenu

## Ce qu'on livre

**Les trente premieres secondes de leur vraie video** : la chanson ecrite
depuis leurs reponses, six plans ou ils se voient eux, et les coupes posees
sur la musique. Gratuit, immediat, sans compte.

La preview n'est pas un resume de la video : c'en est **le debut**. Meme
scenario, memes visages, memes decors — le jour ou elle achete, ca continue.

## Les six plans, coupes sur la chanson

**Trente secondes = six plans de cinq a six secondes**, et chaque plan est un
vrai clip IA ou ils se voient. Ce sont **les six premiers plans de la vraie
video**, pas un teaser fabrique autrement : le jour ou elle achete, le montage
continue sur le meme scenario, les memes visages, les memes decors.

| # | Appel | Ce qu'on obtient | Cout |
|---|---|---|---|
| 1 | Suno via KIE | la chanson entiere + une 2ᵉ variante, **et ses horodatages** | ~0,05 $ |
| 2 | `nano-banana-pro` × 6 | la premiere image de chaque plan, **leurs visages dedans** | ~0,54 $ |
| 3 | image-to-video × 6 | les six clips, **a la duree de leur coupe** | ~0,84 $ |

**~1,43 $ la preview, 4 a 6 minutes.** Le rebours de l'attente en prevoit 5.

### L'ordre, et pourquoi il ne peut pas etre autre

```
1. le scenario                     0 s, aucun appel
2. la chanson  ET  les six images  en parallele
3. les horodatages de la chanson   -> les coupes REELLES
4. les six clips                   aux durees des coupes
```

**La chanson d'abord, les animations ensuite.** On ne decide pas que chaque
plan dure cinq secondes : on demande a la chanson **a quel instant chaque ligne
est chantee**, et on coupe la. Les images, elles, ne dependent que de la photo :
elles partent donc en meme temps que la chanson, et seuls les **clips** attendent
les horodatages — parce que leur duree en decoule.

### Le scenario : la ligne chantee et le plan sont ecrits ensemble

`code/worker/couples-storyboard.js`. Six temps, le meme arc pour tout le monde :

| # | Temps | Ce qu'on chante | Ce qu'on voit |
|---|---|---|---|
| 1 | avant | `Before {name}, the days all looked the same` | seul, lumiere pale, plan large |
| 2 | la rencontre | **leurs mots** | le lieu de leur rencontre, la couleur revient |
| 3 | le quotidien | **leurs mots** | les deux, riant, heure doree |
| 4 | l'epreuve | `Through the year that tried to break us` | accroches l'un a l'autre, pluie |
| 5 | la promesse | `Still here. Still choosing you.` | le geste de leur occasion |
| 6 | aujourd'hui | `{name}, this one is yours.` | le plan le plus large et le plus lumineux |

La parole et le plan sont **sur la meme ligne de code**. On ne peut pas les
desynchroniser par accident, et **l'histoire se lit sans le son** : six etapes
reconnaissables, pas six jolies images sans ordre.

### La regle payee une fois : leurs mots occupent une ligne ENTIERE

`Then {how}, and nothing was ever quiet again` donnait, avec une vraie reponse :

> Then Un train rate a Lyon en 2019, on a, and nothing was ever quiet again

Grammaire cassee, majuscule au milieu, coupure sur « on a ». **Seule**, la meme
reponse fait une ligne qui se chante : « Un train rate a Lyon en 2019 ». Donc :
soit la ligne est a nous et ne porte que des jetons courts et surs (un prenom),
soit elle est a eux et elle est seule. Et leur detail se retrouve **aussi dans
le decor** du plan, ou il devient visible.

### Le prompt image ne decrit JAMAIS leurs visages

`image_input: [decor, photo1, photo2]`. Le decor donne le cadre et la lumiere,
la photo donne les visages, le texte ne parle **que du decor**. Decrire un
visage, c'est se battre contre la photo — et c'est la photo qui perd. C'est la
lecon du tunnel enfants, et une regle de securite du projet. Six assertions la
verifient.

### L'alignement, et son repli honnete

`alignBeats()` cherche chaque ligne dans les mots horodates, mot a mot, sans
jamais reculer. Si un seul repere manque, si les debuts reculent, ou si la
route des horodatages ne repond pas, on retombe sur **un decoupage regulier** :
la preview existe quand meme, elle est juste moins calee. On ne bricole pas une
coupe au hasard — c'est pire que regulier.

Elle repart aussi **de la premiere ligne chantee** : l'intro ne fait pas partie
des trente secondes, sinon la preview commence sur du vide.

### Le montage se joue dans la page

`cs-duo-pv-song`. Une piste audio fait l'horloge, six couches video empilees se
relaient dessus, et **la parole du plan s'inscrit a l'ecran mot a mot**. La
coupe est un fondu de 360 ms, chaque plan derive lentement pour coller les
coupes, une frise montre les six reperes, un rebours descend de 0:30, et a la
fin **la derniere image reste** avec la proposition dessus.

Aucun encodage, aucun serveur de rendu : c'est la chanson qui donne l'heure,
donc les coupes sont justes a l'image. Et si un clip manque, **son plan tombe
sur son image** plutot que sur cinq secondes de noir.

### Ce que ca coute de ne PAS faire ca

La version « une image + du mouvement CSS » coutait 0,32 $. Elle a ete
ecartee : une preview qui ne bouge pas ne fait pas acheter, et une preview qui
ne fait pas acheter coute 0,32 $ **pour rien**. A 1,43 $, il suffit qu'un
visiteur sur cinquante achete pour que ce soit le meilleur des deux.

## Ce qu'on pre-genere, et ce qu'on ne pre-genere jamais

**Oui — une fois pour toutes, reutilise par tout le monde :**

- **les scenes**, un jeu par occasion (mariage, demande, anniversaire, Saint-
  Valentin, « autre ») × 3 plans. ~15 images, ~1,35 $ **une seule fois**, puis
  plus rien. Meme principe que les `craftstory-sc5-*.png` des enfants ;
- le clip d'attente et les demos de la landing page.

**Non — jamais :**

- **la chanson** : c'est le produit. Une chanson pre-faite qu'on ressort a deux
  clients differents, et le produit n'existe plus ;
- **les paroles**, le texte a l'ecran, les prenoms : ils viennent de leurs
  reponses, et c'est precisement ce qu'ils sont venus chercher.

Autrement dit : « on genere des trucs de base et on change juste les tetes » —
oui, **pour le decor**. Pas pour l'histoire.

## Ce qui est deja ecrit et verifie

- **l'ecran photo**, obligatoire, une ou deux images reduites a 1280 px,
  envoyees en dataURL dans le meme JSON que les reponses ;
- **le scenario et l'alignement** — `code/worker/couples-storyboard.js`,
  54 verifications, aucun reseau ;
- **la fabrication** — `code/worker/couples-preview.js` : le scenario, la
  chanson et les six images en parallele, les horodatages, puis les six clips
  aux durees des coupes ;
- **le montage** — `cs-duo-pv-song`, 76 verifications dans un vrai navigateur :
  chaque coupe a son instant, sa parole, son rebours, sa frise, sa carte de
  fin, la relecture, la pause, et le plan sans clip qui tombe sur son image ;
- **le pont** : le tunnel met de cote la table rendue par l'API sous
  `csDuoTake`, et la page la joue a la place de celle de l'editeur. Meme
  chemin de code des deux cotes.

## Ce qui reste, et par qui

1. **Les decors pre-generes** (proprietaire) : un jeu par occasion, un couple
   quelconque dedans, deposes dans les Fichiers Shopify. Leurs noms sont dans
   `SCENES`, en haut de `couples-storyboard.js`.
2. **Deployer le worker** (proprietaire) avec `KIE_KEY`, puis coller son
   adresse dans le reglage **API URL** du tunnel. Rien d'autre a recoder.
3. **Confirmer deux routes** marquees `(a confirmer)` dans `R` : les
   horodatages Suno et le modele image-to-video. `api.kie.ai` et `docs.kie.ai`
   sont refuses par la politique de sortie de l'environnement de
   developpement, donc elles n'ont pas pu etre verifiees ici. Le code ne
   suppose jamais qu'elles repondent.
4. **Faire tourner la cle KIE de production** — elle a ete collee dans une
   conversation. Rien ne doit partir en production avant.
