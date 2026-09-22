# L'API de la preview couples

Une fonction Supabase Edge (`couples`), projet **craftstory-couples**
(`iopuyhggzsncconzmgjj`, us-east-1, plan gratuit).

```
POST https://iopuyhggzsncconzmgjj.supabase.co/functions/v1/couples/start
POST https://iopuyhggzsncconzmgjj.supabase.co/functions/v1/couples/status
POST https://iopuyhggzsncconzmgjj.supabase.co/functions/v1/couples/callback
```

## Le seul reglage : la cle KIE

Supabase > projet craftstory-couples > **Edge Functions > Secrets** > ajouter
`KIE_KEY`. Pris en compte tout de suite, sans redeployer. Tant qu'elle
manque, `/start` repond `503 not configured` et **aucun credit n'est
depense**.

La cle ne passe jamais par le chat, le code, le depot ou les logs.

## Ce que fait /start

1. depose les photos (1 ou 2) chez KIE, une fois ;
2. lance **en meme temps** la chanson complete (Suno V5, paroles ecrites par
   Suno depuis un brief de moins de 500 caracteres ou tout vient des
   reponses) et **six images** `nano-banana-pro` avec leurs photos en
   reference ;
3. rend un **jeton signe** qui porte les identifiants des sept taches.

L'API ne garde rien : pas de base, pas de fichier. Tout l'etat est dans le
jeton, signe (HMAC) pour qu'on ne puisse pas suivre les taches d'un autre.

## Ce que fait /status

La page l'appelle toutes les cinq secondes. Il relance **une fois** une
image refusee (sans leurs mots libres) et **une fois** une chanson perdue,
comble une image manquante par une voisine, et rend a la fin la table de
montage exacte que le lecteur joue : six images, cinq secondes chacune, un
leger zoom, la chanson dessous, calee sur le premier mot chante quand Suno
sait le dire.

## Garde-fous

- seule la boutique (craftstory.co, *.myshopify.com) peut l'appeler depuis
  un navigateur ;
- cinq lancements par adresse et par dix minutes ;
- photos : dataURL image uniquement, 4 Mo au plus ; e-mail requis.

## Tests

```
node api-couples/test/run.mjs                                            # 90+ verifications, faux KIE
node --experimental-strip-types --no-warnings api-couples/test/entry.mjs  # l'entree Deno sous Node
```

Zero credit, zero reseau.

## Pourquoi Supabase et pas Vercel

Le connecteur Vercel n'a pas le droit de creer un projet (403), et deployer
dans un projet existant aurait remplace un autre site. Le projet Supabase
est neuf et ne sert qu'a ca. Un projet gratuit se met en pause apres une
semaine **sans aucune requete** : avec du trafic ca n'arrive pas, et sinon
un clic sur « Restore » dans Supabase le relance.
