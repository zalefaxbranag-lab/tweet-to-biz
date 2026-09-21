# La preview couples : le chemin retenu

Un seul chemin, celui qui coute le moins et se branche le plus vite. Les autres
ont ete pesees et ecartees, la raison est a chaque fois dans la colonne de
droite.

## Ce qu'on livre

**30 secondes de chanson + 30 secondes d'animation ou ils se voient**, avec
leurs details a eux ecrits dedans. Gratuit, immediat, sans compte.

## Les deux appels, et rien de plus

| # | Appel | Ce qu'on obtient | Cout |
|---|---|---|---|
| 1 | Suno via KIE — `POST /api/v1/generate` | la chanson complete, **2 variantes** | ~0,05 $ |
| 2 | `nano-banana-pro` × 3 | 3 images : **leurs visages** dans 3 scenes | ~0,27 $ |
| — | l'animation | faite **dans le navigateur** | 0 $ |

**~0,32 $ par preview, 90 a 120 secondes.** Le rebours de l'ecran d'attente en
prevoit 5 : la marge est large.

### 1. La chanson

`customMode: true`, `instrumental: false`, `model: "V5"`, `callBackUrl` vers le
worker. `style` vient du genre et de la voix choisis, `title` de leurs prenoms,
`prompt` porte les paroles construites depuis leurs reponses — qualites,
histoire, occasion, message.

**On ne choisit pas la duree, et ca ne change rien.** Suno facture **a la
generation**, pas a la seconde : une generation = un morceau entier (2-3 min) +
une seconde variante, pour 0,05 $. Generer 30 secondes ne couterait pas moins.
Donc on genere une fois, et **la lecture s'arrete a 30 secondes** cote
navigateur (`timeupdate` → `pause`). Zero frais en plus, et le jour ou elle
achete, **le morceau complet est deja la** : livraison immediate.

### 2. Les visages

Exactement le tour de force du tunnel enfants : `image_input: [scene, photo1,
photo2]`. La **scene est pre-generee** (voir plus bas) avec un couple
quelconque, leur photo sert de verite de terrain, et **le prompt ne decrit
jamais leurs visages** — il decrit la scene. C'est ce qui donne la
ressemblance.

Trois images au lieu d'une : c'est ce qui fait une video plutot qu'une carte
postale. Les scenes 2 et 3 existent deja cote worker (`SCENE_2`, `SCENE_3`).

### 3. L'animation, sans modele video

Les 30 secondes sont montees **dans la page** : lent zoom sur chaque image,
fondus enchaines, et **leurs mots a eux qui s'inscrivent a l'ecran** — prenoms,
la date, le lieu, la phrase du message — sur le tempo de la chanson.

**Pourquoi pas un vrai modele video :** `kling-2.6` coute ~0,28 $ les 10
secondes. 30 secondes = 0,84 $, soit **trois fois le reste de la preview
reunie**, pour 5 a 8 minutes d'attente de plus. Sur une preview gratuite, chaque
visiteur qui n'achete pas est une perte seche. Le modele video est pour **le
produit paye**, pas pour l'appat.

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

## Ce qui est deja en place

- l'ecran photo, obligatoire, une ou deux images reduites a 1280 px et envoyees
  **en dataURL dans le meme JSON que les reponses** — le format que le worker
  des enfants lit deja ;
- le reglage **API URL** du tunnel : le remplir suffit, rien a recoder ;
- l'ecran d'attente sur la page, son rebours garde, son bouton qui n'apparait
  qu'a 100 % ;
- la page d'apres, qui relit leurs reponses et compose ses titres avec.

## Ce qui reste a ecrire

1. la route couples du worker : lire ce JSON, poster la photo en base64, lancer
   les deux appels **en parallele**, rendre `{songUrl, images[], taskId}` ;
2. le montage des 30 secondes dans `cs-duo-pv-song` : les 3 images, leurs mots,
   l'arret a 30 secondes ;
3. **faire tourner la cle KIE de production** — elle a ete collee dans une
   conversation. Rien ne doit partir en production avant.
