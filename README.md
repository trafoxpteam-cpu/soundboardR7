# MemeDeck

Eine deutschsprachige Soundboard-Web-App zum Entdecken, Hochladen, Anhören, Favorisieren und Herunterladen von Meme-Sounds. Die App verwendet Supabase für E-Mail/Passwort-Konten, Datenbank und Dateispeicher.

## Lokal starten

1. Node.js 20.19+ installieren.
2. `npm install`
3. `.env.example` nach `.env` kopieren und `VITE_SUPABASE_URL` sowie `VITE_SUPABASE_PUBLISHABLE_KEY` aus dem Supabase-Projekt eintragen. Der ältere Variablenname `VITE_SUPABASE_ANON_KEY` wird ebenfalls unterstützt.
4. Den Inhalt von [`supabase/schema.sql`](./supabase/schema.sql) im SQL Editor des Supabase-Projekts ausführen.
5. Unter **Authentication → URL Configuration** die lokale URL `http://localhost:5173` als Site URL und Redirect URL erlauben.
6. `npm run dev` ausführen.

Ohne Supabase-Zugangsdaten zeigt die App einen Einrichtungsmodus. Anmeldung, Uploads, Favoriten und die Community-Bibliothek werden nicht lokal vorgetäuscht.

## Auf GitHub Pages veröffentlichen

Der Workflow unter [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) baut und veröffentlicht die App automatisch bei jedem Push auf `main`.

1. In GitHub unter **Settings → Secrets and variables → Actions** zwei Repository-Secrets anlegen:
   - `VITE_SUPABASE_URL`: die Project URL aus Supabase
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: der Publishable-/anon-Key aus Supabase
2. Unter **Settings → Pages** als Build and deployment source **GitHub Actions** auswählen.
3. In Supabase unter **Authentication → URL Configuration** diese Redirect URL erlauben: `https://trafoxpteam-cpu.github.io/soundboardR7/`
4. Den Workflow **Deploy to GitHub Pages** ausführen oder auf einen Push nach `main` warten.

Die Website ist dann unter <https://trafoxpteam-cpu.github.io/soundboardR7/> erreichbar. Nach Änderungen kann es einige Minuten dauern, bis GitHub Pages die neue Version ausliefert.

## Enthaltene Funktionen

- Registrierung und Anmeldung per E-Mail und Passwort
- Öffentliche Sound-Bibliothek mit Suche und Audio-Player
- Upload von MP3-, WAV- und OGG-Dateien (bis 20 MB)
- Favoriten pro Benutzerkonto
- Sound-Dateien herunterladen
- Row Level Security für Sound-Metadaten, Favoriten und Storage-Dateien

Uploader müssen bestätigen, die nötigen Rechte am Sound zu besitzen und ihn anderen zum Anhören und Herunterladen bereitzustellen. Vor einem öffentlichen Launch sollte zusätzlich ein Melde- und Moderationsprozess für rechtswidrige oder unerwünschte Inhalte eingerichtet werden.
