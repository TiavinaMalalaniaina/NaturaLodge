# NaturaLodge — back-office

Application React du personnel de l'hôtel : planning, séjours, clients, chambres, factures,
paiements, comptabilité, permissions. Démarrage et vue d'ensemble : [`../README.md`](../README.md).

```bash
npm install
cp .env.example .env      # VITE_API_URL, par défaut http://localhost:4000/api
npm run dev               # http://localhost:3000
npm run typecheck && npm run lint
```

Organisation de `src/` (chaque ressource suit le même schéma page → hook → api) :

| Dossier | Contenu |
|---|---|
| `pages/` | Un écran par fichier, déclarés dans `App.tsx` |
| `hooks/` | Lecture et écriture des données avec TanStack Query (`useBookings`, `useCreateBooking`…) |
| `api/` | Appels au serveur ; `client.ts` est l'instance axios commune |
| `components/` | Composants partagés ; `Modal.tsx` pour toute fenêtre modale, `AppLayout.tsx` pour le menu |
| `lib/` | Statuts, couleurs, formatage, schémas de formulaires |
| `locales/` | Textes FR / EN / MG : aucun texte d'interface en dur (le lint le refuse) |

Conventions détaillées : [`../CLAUDE.md`](../CLAUDE.md).
