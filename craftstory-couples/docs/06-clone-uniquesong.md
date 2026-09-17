# Clonage de la page UniqueSong, adapté couples + musique + vidéo

2026-09-17. Source : leur page enregistrée (416 Ko, 7 274 lignes), fournie par le
propriétaire. Analysée hors ligne — le domaine reste bloqué par la politique réseau.

## Leur page, dans l'ordre

| # | Section | Ce qu'elle fait |
|---|---|---|
| 1 | Barre d'annonce | « SUMMER SALE - 75% OFF » |
| 2 | Ligne étoilée | ★★★★★ « The #1 Custom Song Platform — 10,000+ Songs Created » |
| 3 | Hero | vidéo **autoplay muette** + « Tap to Unmute », **H1 = une citation client** entre guillemets, sous-titre, CTA, « 100% Money-Back Guarantee · Delivered by Email » |
| 4 | Bandeau de confiance | 10k+ · ★★★★★ · « Ready in as little as 6 hours » · « No shipping needed » |
| 5 | « How It Works (Simple as 1-2-3) » | 3 étapes + CTA |
| 6 | « Why +10,000 Customers Love UniqueSong » | **carrousel Splide** d'images d'avis + une vidéo avec bouton play |
| 7 | « Gift a Song… » | 9 cartes d'occasions (partner, children, loss, parents, yourself, strength, healing, prayers, breakthroughs) |
| 8 | « What's Included » | **lecteur audio d'une vraie chanson** (1:52, « Song for Vanessa - Pop ») + 3 items cochés |
| 9 | FAQ | 7 questions |
| 10 | Footer | |

**Leur meilleure idée, et elle est gratuite : le H1 est une phrase de client**, pas une
promesse produit — *« I Pressed Play and We Both Started Crying »*.

## Trois failles relevées chez eux

1. La livraison express est à **$49** dans une réponse de FAQ et à **$59** dans la
   suivante. Sur la même page.
2. Le délai est annoncé **« 7 days »**, **« 24h-7 Days »** et **« as little as 6 hours »**
   à trois endroits différents.
3. Il reste dans leur code des images d'un autre produit :
   `Rebranding_Lumera_-_Bust_Lif_OIl_48.webp`, `BustLiftOil_-_All_Images…`. Thème de
   boutique de cosmétique recyclé, jamais nettoyé.

On les bat sur la précision : **un seul délai, un seul prix, zéro contradiction**. La FAQ
de notre page annonce « preview en quelques minutes, chanson et clip sous 48 heures », et
cette phrase est la même partout.

## Notre page, section par section

`head → ann → hero → trust → steps → reviews → occasions → vsl → demos → offer → faq → bar`

| Section | Fichier | Équivalent chez eux |
|---|---|---|
| Barre d'annonce | `cs-duo-ann` | leur barre de promo |
| Hero | `cs-duo-hero` | leur hero — ligne étoilée, H1-citation, autoplay muet + Tap to unmute, garantie |
| Bandeau de confiance | `cs-duo-trust` | leur bande sous le hero |
| Comment ça marche | `cs-duo-steps` | leur 1-2-3 |
| Avis | `cs-duo-reviews` | leur carrousel Splide |
| Occasions | `cs-duo-occasions` | leurs 9 cartes |
| VSL | `cs-duo-vsl` | *notre ajout* — la vidéo n'existe pas chez eux |
| Démos | `cs-duo-demos` | leur lecteur audio, en musique **+ vidéo** |
| Offre | `cs-duo-offer` | leur « What's Included » |
| FAQ | `cs-duo-faq` | leurs 7 questions, réécrites |
| Barre collante | `cs-duo-bar` | *notre ajout* |

### Les 9 occasions, traduites pour les couples

première danse · la demande · anniversaire de mariage · matin du mariage · noces d'or ·
la distance · retrouver son chemin · le cadeau des invités · juste parce que

Leurs 9 catégories couvrent enfants, deuil, parents, prières. Les nôtres restent sur le
couple, et incluent l'angle **le plus durable de leur bibliothèque pub** : la réparation
(« quand pardon ne suffit pas »), créa active depuis 195 jours chez eux.

## Les avis : le système, pas le contenu

`cs-duo-reviews` reproduit leur architecture : rangée swipeable, deux formats par bloc
(capture d'écran d'un message, ou citation tapée), puce de note.

**La section se masque d'elle-même sur la boutique tant que tous les blocs sont vides** —
la page ne montre jamais d'étagère vide. Vérifié au rendu : avec 4 blocs vides, elle ne
s'affiche pas.

Rien n'est inventé : pas de faux avis, pas de faux noms, pas de compteur client. Trois
raisons, dans l'ordre d'importance business :

1. **Illégal sur le marché visé.** 91,5 % de leur trafic est américain. La règle FTC sur
   les faux avis (en vigueur depuis 2024) couvre les avis inventés *et* le mensonge sur le
   nombre de clients, avec une pénalité civile par violation.
2. **Meta refuse les créas à témoignage fabriqué.** Un compte pub bloqué coûte plus qu'une
   section d'avis vide.
3. **« 10 000+ » est leur chiffre.** Le copier revient à revendiquer leurs clients.

Les emplacements honnêtes qui portent la preuve en attendant : le H1-citation (dès le
premier vrai retour), la démonstration jouable (chanson + clip, plus forte qu'un
témoignage), la garantie, et le cadre « clients fondateurs » — rareté vraie et vérifiable.

## Images

Aucune générée : `api.kie.ai` est bloqué par la politique réseau de l'environnement
d'exécution (403 sur le `CONNECT`, avant tout envoi de la clé). Chaque emplacement affiche
un **placeholder dégradé conçu** dans les tokens de la marque, pas un rectangle gris, et
accepte n'importe quel format de photo (`object-fit: cover`).

Le générateur autonome est dans `tools/kie_images.py` : il tourne sur la machine du
propriétaire, où rien ne filtre, et produit les 9 visuels d'occasions plus 3 visuels de
démo avec la ressemblance du couple.

## Mesures de rendu (Chromium local)

| Largeur | Débordement H | CTA < pli | CTA y | Page | Tap < 44 px | Texte coupé |
|---|---|---|---|---|---|---|
| 320 | aucun | oui | 417 | 6856 | 0 | aucun |
| 375 | aucun | oui | 448 | 6585 | 0 | aucun |
| 390 | aucun | oui | 448 | 6631 | 0 | aucun |
| 414 | aucun | oui | 465 | 6547 | 0 | aucun |
| 768 | aucun | oui | 618 | 8199 | 0 | aucun |
| 1280 | aucun | oui | 528 | 7128 | 0 | aucun |

Grille d'occasions : **94 % de remplissage sur desktop et sur mobile**.

## Trois bugs trouvés au rendu, corrigés

1. **Grille à trous.** Des tuiles à ratios mélangés en CSS grid laissent chaque rangée
   prendre la hauteur de sa plus haute carte : gros vides sous les cartes courtes. Un
   masonry en colonnes a corrigé les trous mais finissait déséquilibré (3ᵉ colonne 490 px
   plus courte). Retenu : **tuiles uniformes 4:5 + `object-fit: cover`**, plus une case
   « vedette » sur 2 colonnes, plus une règle qui étire automatiquement la dernière carte
   quand leur nombre est impair. 94 % de remplissage aux deux largeurs.
2. **`:hover` supprimé** par une de mes substitutions. Restauré, et vérifié par la
   `transform` calculée (`matrix(1,0,0,1,0,-3)`).
3. **Ligne d'attribution au-dessus du titre sur mobile.** Le hero ordonne ses éléments
   avec `order` ; un élément sans `order` vaut 0 et remonte devant tout le reste. Les 7
   rangs sont maintenant explicites, et l'ordre visuel est vérifié aux deux largeurs.

## État de la vérification

- **Les 11 sections** : empreintes MD5 côté Shopify identiques aux fichiers locaux.
- **Le template** : le thème porte une version écrite à la main, le dépôt une version
  re-sérialisée par `json.dump`. Les octets diffèrent donc. J'ai validé le local par
  parsing ; je n'ai **pas** comparé octet par octet celui du thème.
- **Le rendu sur la vraie boutique** : non vérifié, le domaine est bloqué.
