import { syncAccount } from "../services/sync";
import { remoteHistory, type PracticeSummary } from "../services/history";
import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { AppState, useColorScheme, Platform } from "react-native";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  manageAuthLifecycle,
  handleAuthUrl,
  readCachedStudySession,
} from "../services/auth";
import * as records from "../storage/records";
import * as library from "../services/library";
import {
  listAttempts,
  listBookmarks,
  deletedAttemptIds,
  type AttemptHeader,
} from "../storage/practice";
import { syncHistory } from "../services/history";
import { syncReports } from "../services/reports";
import type {
  Profile,
  Preferences,
  Bundle,
  Catalog,
  Bookmark,
} from "../domain/types";
import { dark, light, type Palette } from "../theme/tokens";
import { previewBundle, previewCatalog } from "../data/preview";
export const designPreview =
  __DEV__ && process.env.EXPO_PUBLIC_DESIGN_PREVIEW === "true";
const defaults: Preferences = {
  theme: "dark",
  preparation: false,
  reminders: {
    enabled: false,
    mode: "smart",
    time: "18:00",
    days: [1, 2, 3, 4, 5, 6, 0],
    personalized: true,
  },
};
interface State {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  owner: string;
  palette: Palette;
  preferences: Preferences;
  setPreferences: (value: Preferences) => Promise<void>;
  updateProfile: (value: Partial<Profile>) => Promise<void>;
  saved: Bundle[];
  materials: Bundle[];
  catalog: Catalog;
  libraryStatus: "loading" | "ready" | "error";
  libraryError: string;
  refreshLibrary: () => Promise<void>;
  refreshSaved: () => Promise<void>;
  refreshPractice: () => Promise<void>;
  attempts: AttemptHeader[];
  bookmarks: Bookmark[];
  signOut: () => Promise<void>;
  remoteSessions: PracticeSummary[];
  syncError: string;
  deletedSessions: ReadonlySet<string>;
  syncNow: () => Promise<void>;
}
const Context = createContext<State | null>(null);
export const useApp = () => {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider is missing");
  return value;
};
export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [preferences, setPrefs] = useState(defaults),
    [saved, setSaved] = useState<Bundle[]>([]),
    [materials, setMaterials] = useState<Bundle[]>([]),
    [catalog, setCatalog] = useState<Catalog>({ universities: [] }),
    [libraryStatus, setLibraryStatus] =
      useState<State["libraryStatus"]>("loading"),
    [libraryError, setLibraryError] = useState(""),
    [attempts, setAttempts] = useState<AttemptHeader[]>([]),
    [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [deletedSessions, setDeletedSessions] = useState<Set<string>>(
    new Set(),
  );
  const libraryBusy = useRef(new Set<string>()),
    syncBusy = useRef(new Set<string>());
  const [remoteSessions, setRemoteSessions] = useState<PracticeSummary[]>([]),
    [syncError, setSyncError] = useState("");
  const owner =
      session?.user.id || (designPreview ? "design-preview" : "guest"),
    ownerRef = useRef(owner);
  ownerRef.current = owner;
  const scheme = useColorScheme();
  const palette =
    preferences.theme === "light" ||
    (preferences.theme === "system" && scheme === "light")
      ? light
      : dark;
  useEffect(() => {
    let active = true;
    const cleanup = manageAuthLifecycle();
    records
      .read<Preferences>("device", "preferences", "current")
      .then((value) => {
        if (active && value) setPrefs({ ...defaults, ...value });
      })
      .catch(() => {});
    if (designPreview) {
      setProfile({
        id: "design-preview",
        email: "student@example.com",
        full_name: "Student",
        onboarding_complete: true,
      });
      setReady(true);
    }
    if (supabase) {
      let receivedAuthEvent = false;
      void readCachedStudySession()
        .then((cached) => {
          if (active && !receivedAuthEvent && cached) setSession(cached);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setReady(true);
        });
      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (active && !error) {
            receivedAuthEvent = true;
            setSession(data.session);
          }
        })
        .catch(() => {});
      const { data } = supabase.auth.onAuthStateChange((_event, current) => {
        receivedAuthEvent = true;
        if (active) setSession(current);
      });
      const link = Linking.addEventListener("url", ({ url }) => {
        void handleAuthUrl(url).catch(() => {});
      });
      void Linking.getInitialURL().then((url) => {
        if (url) void handleAuthUrl(url).catch(() => {});
      });
      return () => {
        active = false;
        cleanup();
        data.subscription.unsubscribe();
        link.remove();
      };
    }
    setReady(true);
    return () => {
      active = false;
      cleanup();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setSaved([]);
    setAttempts([]);
    setBookmarks([]);
    setMaterials((rows) =>
      rows.filter((b) => !b.ownerId || b.ownerId === owner),
    );
    setRemoteSessions([]);
    setDeletedSessions(new Set());
    setSyncError("");
    void records
      .read<PracticeSummary[]>(owner, "remote-history", "current")
      .then((rows) => {
        if (active && rows) setRemoteSessions(rows);
      })
      .catch(() => {});
    if (!session) {
      if (!designPreview) setProfile(null);
      return;
    }
    const user = session.user;
    void (async () => {
      const cached = await records
        .read<Profile>(owner, "profile", "current")
        .catch(() => null);
      if (active)
        setProfile(
          cached || {
            id: user.id,
            email: user.email || "",
            full_name:
              user.user_metadata.full_name ||
              user.user_metadata.name ||
              "Student",
            onboarding_complete: !!user.user_metadata.study_preferences,
            study_focus: user.user_metadata.study_preferences?.focus,
          },
        );
      try {
        let { data } = await supabase!
          .from("users")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (!data && active) {
          const base = {
            id: user.id,
            email: user.email || "",
            full_name: user.user_metadata.full_name || "Student",
            onboarding_complete: !!user.user_metadata.study_preferences,
          };
          const result = await supabase!
            .from("users")
            .upsert(base, { onConflict: "id" })
            .select()
            .single();
          if (result.error) throw result.error;
          data = result.data;
        }
        if (data && active) {
          const next = {
            ...data,
            avatar_local_uri: cached?.avatar_local_uri,
            avatar_url:
              data.avatar_url ||
              user.user_metadata.avatar_url ||
              user.user_metadata.picture,
            phone_number:
              user.user_metadata.contact_phone || cached?.phone_number || "",
            onboarding_complete:
              !!user.user_metadata.study_preferences ||
              data.onboarding_complete,
            study_focus: user.user_metadata.study_preferences?.focus,
          };
          setProfile(next);
          await records.write(owner, "profile", "current", next);
        }
      } catch {
        /* Cached profile supports offline launch. */
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user.id, owner]);
  const refreshSaved = useCallback(async () => {
    const id = owner;
    let rows = await library.savedBundles(id);
    if (designPreview && !rows.length) {
      await library.saveBundle(id, previewBundle);
      rows = await library.savedBundles(id);
    }
    if (ownerRef.current === id)
      setSaved(
        designPreview && !rows.length
          ? [{ ...previewBundle, question_count: 3 }]
          : rows,
      );
  }, [owner]);
  const syncNow = useCallback(async () => {
    if (
      owner === "guest" ||
      owner === "design-preview" ||
      syncBusy.current.has(owner)
    )
      return;
    syncBusy.current.add(owner);
    try {
      const results = await Promise.allSettled([
        syncAccount(owner),
        remoteHistory(owner),
      ]);
      const remote =
        results[1].status === "fulfilled" ? results[1].value : null;
      const failure = results.find((r) => r.status === "rejected");
      if (ownerRef.current === owner) {
        if (remote) {
          setRemoteSessions(remote);
          await records.write(owner, "remote-history", "current", remote);
        }
        setSyncError(
          failure?.status === "rejected"
            ? "Saved on this device. Some changes could not sync. Tap Retry sync."
            : "",
        );
      }
    } catch (e) {
      if (ownerRef.current === owner)
        setSyncError(
          e instanceof Error
            ? e.message
            : "Saved on this device. Sync will retry when connected.",
        );
    } finally {
      syncBusy.current.delete(owner);
    }
  }, [owner]);
  const refreshPractice = useCallback(async () => {
    const id = owner;
    const [history, marks, deleted] = await Promise.all([
      listAttempts(id),
      listBookmarks(id),
      deletedAttemptIds(id),
    ]);
    if (ownerRef.current === id) {
      setAttempts(history.filter((row) => !deleted.has(row.id)));
      setDeletedSessions(deleted);
      setBookmarks(marks);
    }
  }, [owner]);
  const refreshLibrary = useCallback(async () => {
    if (designPreview) {
      setCatalog(previewCatalog);
      setMaterials([previewBundle]);
      setLibraryStatus("ready");
      return;
    }
    if (libraryBusy.current.has(owner)) return;
    libraryBusy.current.add(owner);
    let cached = false;
    try {
      const [tree, rows, uploads] = await Promise.all([
        records.read<Catalog>("public", "catalog", "current"),
        records.read<Bundle[]>("public", "materials", "current"),
        records.list<Bundle>(owner, "remote-material"),
      ]);
      if (ownerRef.current !== owner) return;
      cached = !!tree || !!rows?.length || !!uploads.length;
      if (tree) setCatalog(tree);
      if (rows || uploads.length) setMaterials([...(rows || []), ...uploads]);
      setLibraryStatus(cached ? "ready" : "loading");
      setLibraryError("");
      const [freshTree, freshRows] = await Promise.all([
        library.catalog(),
        library.materials(),
      ]);
      if (ownerRef.current !== owner) return;
      setCatalog(freshTree);
      setMaterials([...freshRows, ...uploads]);
      setLibraryStatus("ready");
      await records.restore("public", [
        { kind: "catalog", id: "current", value: freshTree },
        { kind: "materials", id: "current", value: freshRows },
      ]);
      if (owner !== "guest") {
        const remoteUploads = await library
          .savedUploads(owner)
          .catch(() => uploads);
        if (ownerRef.current === owner)
          setMaterials([...freshRows, ...remoteUploads]);
      }
    } catch {
      if (ownerRef.current === owner) {
        setLibraryStatus(cached ? "ready" : "error");
        setLibraryError(
          cached
            ? ""
            : "Connect to browse new materials. Your saved papers are available offline.",
        );
      }
    } finally {
      libraryBusy.current.delete(owner);
    }
  }, [owner]);
  useEffect(() => {
    void refreshSaved();
    void refreshPractice();
    void refreshLibrary();
    const sync = () => {
      void syncNow();
    };
    sync();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sync();
        void refreshPractice();
        void refreshLibrary();
        void refreshSaved();
      }
    });
    return () => sub.remove();
  }, [owner, refreshSaved, refreshPractice, refreshLibrary, syncNow]);
  const setPreferences = useCallback(async (value: Preferences) => {
    await records.write("device", "preferences", "current", value);
    setPrefs(value);
  }, []);
  const updateProfile = useCallback(
    async (value: Partial<Profile>) => {
      if (!profile) throw new Error("Sign in again.");
      if (session && supabase) {
        const fields = Object.fromEntries(
          Object.entries(value).filter(([key]) =>
            ["full_name", "avatar_url", "onboarding_complete"].includes(key),
          ),
        );
        if (Object.keys(fields).length) {
          const { error } = await supabase
            .from("users")
            .update(fields)
            .eq("id", owner);
          if (error) throw error;
        }
        const data: Record<string, string> = {};
        if (value.full_name) data.full_name = value.full_name;
        if (value.phone_number !== undefined)
          data.contact_phone = value.phone_number;
        if (Object.keys(data).length) {
          const result = await supabase.auth.updateUser({ data });
          if (result.error) throw result.error;
        }
      }
      const next = { ...profile, ...value };
      await records.write(owner, "profile", "current", next);
      setProfile(next);
    },
    [profile, owner, session],
  );
  const signOut = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    }
    setProfile(null);
    setSession(null);
    setSaved([]);
    setAttempts([]);
    setBookmarks([]);
  }, []);
  const value = useMemo(
    () => ({
      ready,
      session,
      profile,
      owner,
      palette,
      preferences,
      setPreferences,
      updateProfile,
      saved,
      materials,
      catalog,
      libraryStatus,
      libraryError,
      refreshLibrary,
      refreshSaved,
      refreshPractice,
      attempts,
      bookmarks,
      signOut,
      remoteSessions,
      deletedSessions,
      syncError,
      syncNow,
    }),
    [
      ready,
      session,
      profile,
      owner,
      palette,
      preferences,
      setPreferences,
      updateProfile,
      saved,
      materials,
      catalog,
      libraryStatus,
      libraryError,
      refreshLibrary,
      refreshSaved,
      refreshPractice,
      attempts,
      bookmarks,
      signOut,
      remoteSessions,
      deletedSessions,
      syncError,
      syncNow,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
