import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  AudioLines,
  Check,
  CircleUserRound,
  CloudUpload,
  Disc3,
  Heart,
  LoaderCircle,
  LogOut,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Sound } from "./types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg"]);
const CANONICAL_AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

type AuthMode = "login" | "signup";
type LibraryMode = "all" | "favorites";

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(date));
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("all");
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openAuth = (mode: AuthMode = "login") => {
    if (!supabase) {
      setNotice("Bitte richte zuerst Supabase ein, um Accounts und Uploads zu aktivieren.");
      return;
    }
    setErrorMessage("");
    setNotice("");
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const openUpload = () => {
    if (!supabase) {
      setNotice("Bitte richte zuerst Supabase ein, um Sounds hochzuladen.");
      return;
    }
    if (!user) {
      openAuth("signup");
      return;
    }
    setErrorMessage("");
    setNotice("");
    setSelectedFileName("");
    setUploadOpen(true);
  };

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let active = true;
    const loadLibrary = async (currentUser: User | null) => {
      setIsLoading(true);
      setErrorMessage("");
      const { data: soundData, error: soundError } = await client
        .from("sounds")
        .select("id,user_id,title,description,file_path,mime_type,created_at")
        .order("created_at", { ascending: false });

      if (soundError) {
        if (active) {
          setErrorMessage(`Sounds konnten nicht geladen werden: ${soundError.message}`);
          setIsLoading(false);
        }
        return;
      }

      let favoriteIds: string[] = [];
      if (currentUser) {
        const { data, error } = await client
          .from("favorites")
          .select("sound_id")
          .eq("user_id", currentUser.id);
        if (error) {
          if (active) {
            setErrorMessage(`Favoriten konnten nicht geladen werden: ${error.message}`);
            setIsLoading(false);
          }
          return;
        }
        favoriteIds = data.map((favorite) => favorite.sound_id);
      }

      if (active) {
        setSounds(soundData);
        setFavorites(new Set(favoriteIds));
        setIsLoading(false);
      }
    };

    const loadSession = async () => {
      const { data, error } = await client.auth.getSession();
      if (error) {
        setErrorMessage(`Anmeldestatus konnte nicht geladen werden: ${error.message}`);
        setIsLoading(false);
        return;
      }
      if (!active) return;
      setUser(data.session?.user ?? null);
      await loadLibrary(data.session?.user ?? null);
    };

    void loadSession();
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      window.setTimeout(() => {
        if (active) void loadLibrary(currentUser);
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleSounds = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("de");
    return sounds.filter((sound) => {
      const matchesMode = libraryMode === "all" || favorites.has(sound.id);
      const matchesQuery =
        !normalizedQuery ||
        `${sound.title} ${sound.description}`.toLocaleLowerCase("de").includes(normalizedQuery);
      return matchesMode && matchesQuery;
    });
  }, [favorites, libraryMode, query, sounds]);

  const runAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setErrorMessage("");
    setNotice("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const result =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
            },
          });

    setIsSubmitting(false);
    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    if (authMode === "signup" && !result.data.session) {
      setNotice("Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.");
      return;
    }
    setAuthOpen(false);
    setNotice(authMode === "signup" ? "Dein Konto wurde erstellt." : "Du bist angemeldet.");
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(`Abmelden fehlgeschlagen: ${error.message}`);
      return;
    }
    setNotice("Du wurdest abgemeldet.");
  };

  const toggleFavorite = async (soundId: string) => {
    if (!supabase) return;
    if (!user) {
      openAuth("login");
      return;
    }

    const wasFavorite = favorites.has(soundId);
    setErrorMessage("");
    const { error } = wasFavorite
      ? await supabase.from("favorites").delete().eq("sound_id", soundId).eq("user_id", user.id)
      : await supabase.from("favorites").insert({ sound_id: soundId, user_id: user.id });

    if (error) {
      setErrorMessage(`Favorit konnte nicht gespeichert werden: ${error.message}`);
      return;
    }
    setFavorites((current) => {
      const next = new Set(current);
      if (wasFavorite) next.delete(soundId);
      else next.add(soundId);
      return next;
    });
  };

  const downloadSound = async (sound: Sound) => {
    if (!supabase) return;
    setErrorMessage("");
    const { data, error } = await supabase.storage.from("sounds").download(sound.file_path);
    if (error) {
      setErrorMessage(`Download fehlgeschlagen: ${error.message}`);
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sound.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "meme-sound"}.${getFileExtension(sound.file_path)}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const uploadSound = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !user) return;
    setErrorMessage("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const hasRights = formData.get("rights") === "on";

    if (!(file instanceof File) || file.size === 0) {
      setErrorMessage("Bitte wähle eine Audiodatei aus.");
      return;
    }
    const extension = getFileExtension(file.name);
    if (!AUDIO_EXTENSIONS.has(extension) || (file.type && !AUDIO_TYPES.has(file.type))) {
      setErrorMessage("Erlaubte Formate: MP3, WAV oder OGG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("Die Datei darf maximal 20 MB groß sein.");
      return;
    }
    if (!hasRights) {
      setErrorMessage("Bitte bestätige, dass du die nötigen Rechte an diesem Sound hast.");
      return;
    }

    setIsSubmitting(true);
    const filePath = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: storageError } = await supabase.storage.from("sounds").upload(filePath, file, {
      contentType: file.type || CANONICAL_AUDIO_TYPES[extension],
      upsert: false,
    });

    if (storageError) {
      setIsSubmitting(false);
      setErrorMessage(`Upload fehlgeschlagen: ${storageError.message}`);
      return;
    }

    const { error: insertError } = await supabase.from("sounds").insert({
      user_id: user.id,
      title,
      description,
      file_path: filePath,
      mime_type: file.type || `audio/${extension}`,
    });

    if (insertError) {
      const { error: cleanupError } = await supabase.storage.from("sounds").remove([filePath]);
      setIsSubmitting(false);
      setErrorMessage(
        cleanupError
          ? `Sound konnte nicht gespeichert werden (${insertError.message}). Die Datei konnte außerdem nicht entfernt werden (${cleanupError.message}).`
          : `Sound konnte nicht gespeichert werden: ${insertError.message}`,
      );
      return;
    }

    setIsSubmitting(false);
    setUploadOpen(false);
    setNotice("Dein Sound ist jetzt für alle verfügbar.");
    setIsLoading(true);
    const { data, error: reloadError } = await supabase
      .from("sounds")
      .select("id,user_id,title,description,file_path,mime_type,created_at")
      .order("created_at", { ascending: false });
    setIsLoading(false);
    if (reloadError) {
      setErrorMessage(`Sound wurde hochgeladen, aber die Liste konnte nicht aktualisiert werden: ${reloadError.message}`);
      return;
    }
    setSounds(data);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="MemeDeck Startseite">
          <span className="brand-mark"><AudioLines size={22} strokeWidth={2.6} /></span>
          <span>Meme<span className="brand-accent">Deck</span></span>
        </a>
        <div className="sidebar-label">DEIN SOUNDSPACE</div>
        <nav className="side-nav" aria-label="Bibliothek">
          <button className={`nav-item ${libraryMode === "all" ? "selected" : ""}`} onClick={() => setLibraryMode("all")}>
            <Disc3 size={18} /> Alle Sounds <span className="nav-count">{sounds.length}</span>
          </button>
          <button className={`nav-item ${libraryMode === "favorites" ? "selected" : ""}`} onClick={() => setLibraryMode("favorites")}>
            <Heart size={18} /> Favoriten
            {user && <span className="nav-count">{favorites.size}</span>}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="community-card">
            <Sparkles size={18} />
            <p><strong>Dein Moment. Dein Sound.</strong><br />Teile Sounds mit der ganzen Community.</p>
            <button onClick={openUpload}>Sound hochladen <span>↗</span></button>
          </div>
          <div className="sidebar-footer"><span className="status-dot" /> GEMEINSAM LAUTER</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">SOUNDSPACE <span>/</span> COMMUNITY</div>
          <div className="top-actions">
            <button className="upload-button" onClick={openUpload}>
              <CloudUpload size={16} /> Sound hochladen
            </button>
            {user ? (
              <div className="profile-actions">
                <span className="user-email">{user.email}</span>
                <button className="icon-button" aria-label="Abmelden" title="Abmelden" onClick={() => void signOut()}><LogOut size={18} /></button>
              </div>
            ) : (
              <button className="login-button" onClick={() => openAuth()}>
                <CircleUserRound size={17} /> Anmelden
              </button>
            )}
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> DIE COMMUNITY FÜR SOUND-MOMENTE</div>
            <h1>Dein Sound.<br /><span>Dein Auftritt.</span></h1>
            <p>Der richtige Sound zur richtigen Zeit. Entdecke, speichere und teile die Sounds, die jeden Moment legendär machen.</p>
            <button className="hero-cta" onClick={openUpload}>
              <CloudUpload size={17} /> Ersten Sound hochladen <span>↗</span>
            </button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-glow" />
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-disc"><AudioLines size={58} strokeWidth={1.4} /></div>
            <span className="art-chip chip-one">BOOM!</span>
            <span className="art-chip chip-two">✨ iconic</span>
            <span className="art-chip chip-three">BRUH</span>
            <div className="art-wave wave-one" />
            <div className="art-wave wave-two" />
          </div>
          <div className="hero-index">VOL. 01 <span>—</span> COMMUNITY EDITION</div>
        </section>

        <section className="library-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow muted-eyebrow">FRISCH AUS DER COMMUNITY</div>
              <h2>{libraryMode === "all" ? "Sounds entdecken" : "Deine Favoriten"} <span className="sound-count">{visibleSounds.length.toString().padStart(2, "0")}</span></h2>
            </div>
            <label className="search-field">
              <Search size={17} />
              <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sounds suchen..." aria-label="Sounds suchen" />
              <kbd>⌘ K</kbd>
            </label>
          </div>

          {!isSupabaseConfigured && (
            <div className="setup-notice">
              <div className="setup-icon"><CloudUpload size={20} /></div>
              <div><strong>Dein Soundspace wartet auf Supabase.</strong><p>Trage die Zugangsdaten in <code>.env</code> ein und richte das Datenbankschema ein, um Accounts, Uploads und Favoriten zu aktivieren.</p></div>
            </div>
          )}
          {errorMessage && <div className="alert error-alert" role="alert">{errorMessage}</div>}
          {notice && <div className="alert success-alert" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Meldung schließen"><X size={15} /></button></div>}

          {isLoading ? (
            <div className="empty-state"><LoaderCircle className="spinner" size={26} /><p>Sounds werden geladen…</p></div>
          ) : visibleSounds.length > 0 ? (
            <div className="sound-grid">
              {visibleSounds.map((sound) => {
                const publicUrl = supabase?.storage.from("sounds").getPublicUrl(sound.file_path).data.publicUrl ?? "";
                const isFavorite = favorites.has(sound.id);
                return (
                  <article className="sound-card" key={sound.id}>
                    <div className="sound-card-top">
                      <div className="sound-icon"><AudioLines size={20} /></div>
                      <button className={`favorite-button ${isFavorite ? "is-favorite" : ""}`} onClick={() => void toggleFavorite(sound.id)} aria-label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}>
                        <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <h3>{sound.title}</h3>
                    <p className="sound-description">{sound.description || "Ein Sound aus der MemeDeck-Community."}</p>
                    <audio controls preload="none" src={publicUrl}>Dein Browser unterstützt keine Audio-Wiedergabe.</audio>
                    <div className="sound-card-footer">
                      <span>{formatDate(sound.created_at)}</span>
                      <button className="download-button" onClick={() => void downloadSound(sound)}><ArrowDownToLine size={15} /> Download</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><AudioLines size={24} /></div>
              <h3>{libraryMode === "favorites" ? "Noch keine Favoriten" : query ? "Keine Sounds gefunden" : "Hier wird's bald laut."}</h3>
              <p>{libraryMode === "favorites" ? "Speichere Sounds mit dem Herz, um sie hier wiederzufinden." : query ? "Versuch's mit einem anderen Suchbegriff." : "Sobald Supabase eingerichtet ist, kannst du hier Sounds entdecken und teilen."}</p>
              {!query && libraryMode === "all" && <button className="text-button" onClick={openUpload}>Mach den Anfang <span>↗</span></button>}
            </div>
          )}
        </section>
        <footer className="page-footer"><span>MEMEDECK © 2025</span><span>GEMACHT FÜR DIE GUTEN MOMENTE <span className="footer-heart">♥</span></span></footer>
      </main>

      {authOpen && (
        <Modal title={authMode === "login" ? "Willkommen zurück." : "Werde Teil der Community."} onClose={() => setAuthOpen(false)}>
          <p className="modal-subtitle">{authMode === "login" ? "Melde dich an und speichere deine Lieblingssounds." : "Erstelle dein Konto und teile deine Sounds mit allen."}</p>
          <form className="modal-form" onSubmit={(event) => void runAuth(event)}>
            <label>E-Mail-Adresse<input type="email" name="email" autoComplete="email" placeholder="du@beispiel.de" required /></label>
            <label>Passwort<input type="password" name="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} placeholder="Mindestens 8 Zeichen" required /></label>
            {errorMessage && <div className="form-error" role="alert">{errorMessage}</div>}
            {notice && <div className="form-success" role="status">{notice}</div>}
            <button className="modal-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="spinner" size={17} /> : null}
              {authMode === "login" ? "Anmelden" : "Konto erstellen"}
            </button>
          </form>
          <p className="modal-switch">{authMode === "login" ? "Noch kein Konto?" : "Schon dabei?"} <button onClick={() => { setErrorMessage(""); setNotice(""); setAuthMode(authMode === "login" ? "signup" : "login"); }}>{authMode === "login" ? "Jetzt registrieren" : "Anmelden"}</button></p>
        </Modal>
      )}

      {uploadOpen && (
        <Modal title="Lade deinen Sound hoch." onClose={() => setUploadOpen(false)}>
          <p className="modal-subtitle">Dein Sound wird nach dem Upload für alle hörbar und herunterladbar.</p>
          <form className="modal-form" onSubmit={(event) => void uploadSound(event)}>
            <label>Titel<input name="title" maxLength={80} placeholder="z. B. Der perfekte Bruh" required /></label>
            <label>Beschreibung <span className="optional">(optional)</span><textarea name="description" maxLength={240} rows={3} placeholder="Wann passt dieser Sound am besten?" /></label>
            <label className="file-picker"><span><CloudUpload size={18} /> {selectedFileName || "Audiodatei auswählen"}</span><input type="file" name="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")} required /><small>MP3, WAV oder OGG · max. 20 MB</small></label>
            <label className="rights-check"><input type="checkbox" name="rights" required /><span>Ich habe die nötigen Rechte, diesen Sound hochzuladen und anderen zum Anhören und Herunterladen bereitzustellen.</span></label>
            {errorMessage && <div className="form-error" role="alert">{errorMessage}</div>}
            <button className="modal-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="spinner" size={17} /> : <CloudUpload size={17} />}
              Sound veröffentlichen
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Schließen"><X size={19} /></button>
        <div className="modal-kicker"><span className="live-dot" /> MEMEDECK COMMUNITY</div>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export default App;
