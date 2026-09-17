# Teardown UniqueSong — le mécanisme réel

Source : Trendtrack (MCP), relevé du **2026-09-17**. Le site lui-même n'a pas pu être
ouvert depuis l'environnement de travail (domaine bloqué par la politique réseau) : tout
ce qui suit vient des données Trendtrack (boutique, produits, emails captés, créas et
transcripts), pas d'une lecture de page. Les endroits où ça change la lecture sont
signalés « non vérifié sur page ».

---

## 1. L'échelle réelle

| Indicateur | Valeur |
|---|---|
| Visites mensuelles | **2 481 783** |
| Croissance trafic 30 j | **+71,2 %** |
| Créas actives | **747** (367 suivies dans le brandtracker) |
| Reach 30 j | 884 262 |
| Reach cumulé | 17 696 693 |
| Page Facebook / Instagram | 85 534 likes / 119 746 abonnés |
| Pays d'immatriculation | PT (Portugal) |
| Catégorie | Arts & Entertainment |

**Géographie — c'est une machine anglophone tier 1, sur 5 pays seulement.**

| | US | AU | CA | NZ | reste |
|---|---|---|---|---|---|
| Diffusion pub | 38,6 % | 15,0 % | 15,0 % | 15,0 % | ~16 % (UE/BR/CY/CZ… résiduel) |
| Trafic site | **91,5 %** | 6,9 % | — | 0,4 % (GB) | 1,2 % (TH) |

Le trafic est à 91,5 % américain. Il n'y a **pas de marché francophone** chez eux.

---

## 2. Le ladder de prix — comment l'argent rentre

| Rang | Produit | Prix | Rôle dans le ladder |
|---|---|---|---|
| 2 | Custom UniqueSong \| 48 hours | **79 $** | cœur d'offre |
| 3 | Custom UniqueSong \| 30min | **119 $** | upsell **vitesse** (+40 $) |
| 4 | 3rd verse | 49 $ | upsell contenu |
| 7 | Song available on Spotify | 49 $ | upsell **distribution / statut** |
| 1 | Lyrics | 19 $ | entrée de gamme / add-on |
| 5 | The Full Song Upgrade (SH) | **295 $** | upsell haut de gamme |
| 9 | VIP Song Club Membership (essai 14 j) | **89,97 $** | **récurrent** |

Panier théorique maximal : 79 + 49 + 49 + 19 + 295 ≈ **491 $**, plus l'abonnement.
Le cœur est à **79 $**, pas à 39 $.

Détail révélateur : l'image du produit « Full Song Upgrade » est nommée
`hf_20260313_180542_....jpg`. Le préfixe `hf_` = **Higgsfield**. Ils génèrent leurs visuels
marketing avec le même outil que CraftStory.

---

## 3. Le tunnel, tel qu'il est décrit dans leurs propres créas

Reconstitué depuis les transcripts et les copies publicitaires (non vérifié sur page) :

1. **Créa vidéo** (100 % des créas actives analysées : 20/20 vidéo, CTA « SHOP NOW » 19/20)
2. → **une seule landing page dédiée** : `/pages/create-your-song-landing` (19/20 des créas).
   Ni la home, ni une page produit. Variante saisonnière observée :
   `/pages/landing-preview-mothers-day`.
3. **Quiz de 5 questions**, annoncé « 2 minutes », sans compétence requise
   (« you're not writing the song, just answering questions about her »)
4. **Preview gratuite** : « free song preview in **10 min** » (version enfants : « under
   six minutes »), **livrée par email** (« in your inbox »)
5. **Paywall** : version complète à 79 $, « studio quality », 48 h — ou 119 $ en 30 min
6. **Séquence email** sur l'actif déjà créé au nom du destinataire
7. **Upsells** post-achat (couplet, Spotify, abonnement VIP)

### Les leviers réels, dans l'ordre d'importance

1. **La preview gratuite en 10 minutes.** C'est l'offre. Le risque est nul, l'attente est
   courte, et l'actif existe déjà avant le paiement.
2. **La capture email.** La preview arrive *dans la boîte mail* : l'email n'est pas un
   champ de formulaire, c'est la condition de livraison. Conversion différée par design.
3. **L'aversion à la perte.** Une fois la chanson faite au nom du conjoint, la séquence
   email joue la destruction de l'actif (voir §4).
4. **La spécificité comme preuve.** Les paroles contiennent dates, villes, événements de
   vie (voir §5). C'est ce qui rend « non-template » crédible.
5. **La rareté opérationnelle** : « limited number of songs created each day »,
   « limited cloud storage ».
6. **Le renversement de risque** : « if you don't love it, you don't pay a dime ».

---

## 4. La séquence email — c'est là que se joue la conversion

12 emails captés, ~**3 emails/semaine**, longueur moyenne **791 caractères**.
Type dominant : *Product Campaign*. **Promotion dominante : aucune** — ils ne
discountent pas, ils rappellent que l'actif existe.

| Date | Objet | Ce que ça fait |
|---|---|---|
| 09-16 | « Did you listen to the preview we recorded? » | relance sur l'actif |
| 09-14 | « "I pressed play and we both burst into tears" » | preuve sociale en citation |
| 09-12 | « 🎤 We recorded your loved one's song » | l'actif **existe déjà** |
| 09-07 | « Your loved one's preview is ready » | livraison |
| 09-04 | « Their custom song is SO GOOD ❤️ » | validation tierce |
| 08-30 | « -, should we delete your song? » | **aversion à la perte** (classé *Survey*) |
| 08-28 | « -, what's stopping you » | levée d'objection (*Win-back*) |
| 08-26 | « Click this link to hear your loved one's song » | accès direct |

Le verbe est toujours **« we recorded »** — pas « we generated ». Le vocabulaire est celui
d'un studio, jamais celui d'un modèle. À noter : ils écrivent aussi « their team does the
rest » dans les VSL. L'IA n'est jamais mise en avant.

---

## 5. Les créas : deux moteurs distincts

### Format A — la chanson jouée + une réaction réelle (le monstre de volume)

- **1 742 207 impressions** sur un seul transcript, **85-86 jours** de diffusion, 13 créas
  dérivées du même audio.
- Structure : la chanson personnalisée joue, et la vidéo se termine sur une **voix humaine
  réelle qui réagit** : « I love you, I love you », « Wow, I like it », « This is amazing.
  How did you do this? », « Oh, my God. »
- Les paroles sont **hyper-spécifiques** — c'est tout l'argument :
  - « From San Diego dreams to Louisville nights »
  - « We got engaged, set our vows, bought our very first house »
  - « April 19, 2015 — you said goodbye to mom / July 2019 — daddy left us »
  - prénoms en clair : Corey, Laura, Britney, Marcus, David
- Avatars couverts par ce format : épouse, mari, **frère** (Marcus), bébé/fille, mère.

### Format B — VSL parlée « I dare you » (ce qui scale en septembre 2026)

Script complet relevé, structure en 10 temps :

1. Défi + gratuit — « I dare you to create a custom love song for your wife for free. »
2. Renversement de risque — « if you don't love it after your free preview, you don't pay a dime »
3. **Le moment de bascule** — « the second her name comes through your speakers and your
   whole story is right there in the song and you realize nothing you've ever given her
   has felt this personal »
4. Ancrage prix — « the lowest price they've ever offered »
5. Rareté — « a limited number of songs that can get created each day »
6. Vitesse garantie — « studio quality song within hours, not days »
7. Levée d'objection — « you don't need to know a single thing about writing songs. The
   whole thing takes you maybe two minutes. Their team does the rest »
8. Preuve sociale — « over 10,000 people have already created their own unique song »
9. Urgence — « a discount running right now that disappears when this video does »
10. CTA — « Click the link now and create your free preview »

### Format C — VSL en questions-réponses (ping-pong)

Le positionnement le plus fort de tout le corpus y apparaît :

> « why — because **this is the one thing she can't do for herself** »

Enchaînement : « for who / for your wife » → « what does she hear / her name in the
lyrics, your words turned into music, whatever style she likes » → « **not a template** »
→ « what if I'm not good with words / you're not writing the song, just answering
questions about her » → « what kind of questions / how you met, what you love about her,
**the stuff nobody else knows** » → « when do I hear it / preview comes in ten minutes »
→ « what does it cost / nothing up front ».

### Format D — angle parents/enfants

**Ils occupent déjà l'avatar de CraftStory** : « Kids everywhere are getting the ultimate
confidence boost as parents are creating completely custom songs for their children for
free… answer a two minute quiz about your child… their name in the lyrics, your favorite
memories together, and their best qualities highlighted… free preview guaranteed to arrive
in under six minutes… full studio quality song guaranteed in under 24 hours. »

---

## 6. La créa evergreen n°1 — et elle n'est pas où on l'attend

Créa active depuis **195 jours**, reach **1 407 537**, vidéo, CTA SHOP NOW :

> **« She was ready to walk away… then he played her a song written just for her. »**
>
> « When "I'm sorry" isn't enough, say it in a way she'll never forget: a custom song that
> speaks directly to HER heart. Make her feel SEEN, UNDERSTOOD & LOVED again. »

**L'angle qui tient le plus longtemps n'est pas la célébration, c'est la réparation du
couple en crise.** Pas un mariage, pas un anniversaire : un homme qui risque de perdre sa
femme. C'est l'angle le plus émotionnellement tendu du corpus, et c'est celui qui a la
durée de vie la plus longue.

Deuxième evergreen (180 j) : le même. Troisième (134 j) : Fête des Mères, sur une LP dédiée.

### La créa récente la plus explicite sur le mécanisme (13 j)

> « **The one thing she can't get for herself…** One custom song. Your love story. Her
> reaction changed everything. Hit "Start My Song" below. Tell us your story in **5 quick
> questions**. Get a **radio-quality** unique song in your inbox **within 24 hours**. Any
> genre. Your story. Her reaction. **(Get your FREE song preview in 10min)** »

---

## 7. Ce qui convertit vraiment vs ce qui est cosmétique

| Levier | Verdict |
|---|---|
| Preview gratuite livrée en 10 min | **structurel** — c'est l'offre |
| Livraison par email (= capture) | **structurel** — conditionne toute la relance |
| Séquence email sur l'actif + « should we delete your song? » | **structurel** |
| Spécificité des paroles (dates, villes, événements) | **structurel** — la preuve produit |
| Réaction humaine réelle en fin de créa | **structurel** — la preuve émotionnelle |
| Renversement de risque « you don't pay a dime » | **structurel** |
| Upsell vitesse (48 h → 30 min, +40 $) | **fort** — monétise l'impatience déjà créée |
| Vocabulaire studio (« we recorded », « their team ») | **fort** — l'IA n'est jamais citée |
| Rareté quotidienne / « limited cloud storage » | **moyen** — plausible, non vérifiable |
| « over 10,000 people » | **moyen** — chiffre rond, jamais sourcé |
| Upsell Spotify 49 $ | **moyen** — marge pure, faible volume attendu |
| Discount « disappears when this video does » | **cosmétique** — jamais de promo dans les emails |
| Abonnement VIP 89,97 $ | **à vérifier** — probablement marginal en volume |

---

## 8. Ce que je n'ai pas pu vérifier

- La landing page `/pages/create-your-song-landing` elle-même : structure, VSL, sections,
  preuve sociale affichée, nombre d'avis.
- Le formulaire de personnalisation : les 5 questions exactes, l'ordre, le moment de la
  capture email.
- Le tunnel de commande étape par étape, les upsells post-achat réels (bump au checkout ?
  page de confirmation ?).
- La preview elle-même : durée, audio seul ou audio + visuel, avec ou sans watermark.
- Le délai réel vs promis.

Ces cinq points demandent une ouverture du site (bloquée ici) ou un achat test.
