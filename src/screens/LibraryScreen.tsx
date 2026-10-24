import { useContentTransition } from "../hooks/useContentTransition";
import QuestionSearchResults from "../components/QuestionSearchResults";
import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, FlatList, Animated } from "react-native";
import Upload from "lucide-react-native/icons/upload";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import Download from "lucide-react-native/icons/download";
import Plus from "lucide-react-native/icons/plus";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import BookOpen from "lucide-react-native/icons/book-open";
import { useApp } from "../state/AppContext";
import {
  Header,
  Title,
  Text,
  Muted,
  Button,
  SearchField,
  Tabs,
  Empty,
  ErrorText,
  IconButton,
  Dialog,
  Row,
} from "../components/ui";
import ExamArtwork from "../components/ExamArtwork";
import Scholar from "../components/Scholar";
import { StudyArt } from "../components/StudyArt";
import type { Navigation } from "../navigation/types";
import type { Material, Organization, Bundle } from "../domain/types";
import { fonts } from "../theme/tokens";
import * as Crypto from "expo-crypto";
import { getBundle } from "../services/library";
import { searchSavedQuestions } from "../services/search";
import { matchesBundle, type QuestionMatch } from "../domain/search";
import { resolveQuestion } from "../storage/bank";
import { createAttempt } from "../domain/attempt";
import { saveAttempt } from "../storage/practice";
import Skeleton from "../components/Skeleton";
import PendingDownloads from "../components/PendingDownloads";
type Category = "institution" | "exam_board" | "professional_body" | "all";
type Entry =
  | { kind: "category"; id: string; title: string; category: Category }
  | { kind: "org"; id: string; org: Organization }
  | { kind: "exam"; id: string; title: string }
  | { kind: "material"; id: string; material: Material }
  | { kind: "bundle"; id: string; bundle: Bundle };
const category = (type?: string): Category =>
  ["university", "polytechnic", "college", "school"].includes(type || "")
    ? "institution"
    : ["exam_board", "examboard"].includes(type || "")
      ? "exam_board"
      : ["professional_body", "professionalbody"].includes(type || "")
        ? "professional_body"
        : "all";
export default function LibraryScreen({
  navigation,
}: {
  navigation: Navigation;
}) {
  const {
    palette,
    owner,
    refreshSaved,
    refreshPractice,
    saved,
    materials,
    catalog,
    libraryStatus,
    libraryError,
    refreshLibrary,
    preferences,
  } = useApp();
  const content = useContentTransition();
  const [tab, setTab] = useState<"browse" | "flat" | "downloaded">("browse"),
    [query, setQuery] = useState(""),
    [choice, setChoice] = useState<Category | null>(null),
    [expanded, setExpanded] = useState<string[]>([]),
    [scope, setScope] = useState<{ ids: string[]; title: string } | null>(null),
    [exploring, setExploring] = useState(false),
    [environment, setEnvironment] = useState<string | null>(null);
  const [questionMatches, setQuestionMatches] = useState<QuestionMatch[]>([]),
    [searching, setSearching] = useState(false),
    [actionError, setActionError] = useState(""),
    [opening, setOpening] = useState(false);
  function selectEnvironment(name: string | null) {
    content.transition(
      () => {
        setEnvironment(name);
        setQuery("");
      },
      name ? 1 : -1,
    );
  }
  function browseMore(next: boolean) {
    content.transition(
      () => {
        setExploring(next);
        setQuery("");
      },
      next ? 1 : -1,
    );
  }
  useEffect(() => {
    let active = true;
    setQuestionMatches([]);
    if (query.trim().length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void searchSavedQuestions(owner, saved, query)
        .then((rows) => {
          if (active) setQuestionMatches(rows);
        })
        .catch((e) => {
          if (active) setActionError(e.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, owner, saved]);
  async function openQuestion(match: QuestionMatch) {
    if (opening) return;
    setOpening(true);
    setActionError("");
    try {
      const value = await resolveQuestion(owner, match.question);
      const bundle = await getBundle(owner, match.bundleId);
      const next = createAttempt(
        { ...bundle, assets: { ...bundle.assets, ...value.assets } },
        [value.question],
        1200,
        "practice",
        owner,
        Crypto.randomUUID(),
      );
      await saveAttempt(next, true);
      await refreshPractice();
      navigation.navigate("Exam", { attemptId: next.id });
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Could not open this question.",
      );
    } finally {
      setOpening(false);
    }
  }
  const preparing = preferences.preparation && !exploring;
  const groups = useMemo(() => {
    const map = new Map<string, Bundle[]>();
    for (const b of saved) {
      const name = b.university || b.examType || "Other materials";
      map.set(name, [...(map.get(name) || []), b]);
    }
    return [...map].map(([name, bundles]) => ({ name, bundles }));
  }, [saved]);
  const raw = catalog.organizations?.length
    ? catalog.organizations
    : catalog.universities || [];
  const needle = query.trim().toLowerCase();
  const categories: { id: Category; title: string }[] = [
    { id: "institution", title: "Schools & universities" },
    { id: "exam_board", title: "Tests & qualifications" },
    { id: "professional_body", title: "Professional study" },
  ];
  if (raw.some((o) => category(o.type) === "all") || catalog.ungrouped?.length)
    categories.push({ id: "all", title: "Other materials" });
  const entries = useMemo<Entry[]>(() => {
    if (tab !== "browse")
      return (
        tab === "downloaded"
          ? [
              ...new Map(
                [...materials.filter((b) => b.ownerId === owner), ...saved].map(
                  (b) => [b.id, b],
                ),
              ).values(),
            ]
          : materials
      )
        .filter((b) => matchesBundle(b, needle))
        .map((bundle) => ({ kind: "bundle", id: bundle.id, bundle }));
    const rows: Entry[] = [];
    for (const c of categories) {
      if (!needle && choice && choice !== c.id) continue;
      rows.push({ kind: "category", id: c.id, title: c.title, category: c.id });
      const open = choice === c.id || !!needle;
      if (!open) continue;
      for (const org of raw.filter((o) => category(o.type) === c.id)) {
        const exams = org.examTypes
          .map((exam) => ({
            ...exam,
            materials: (exam.materials || exam.manufacturers || []).filter(
              (m) =>
                !needle ||
                [
                  org.name,
                  org.shortName,
                  exam.name,
                  m.title,
                  m.name,
                  ...(m.subjects || []),
                ].some((value) => value?.toLowerCase().includes(needle)),
            ),
          }))
          .filter((e) => e.materials.length);
        if (!exams.length) continue;
        rows.push({
          kind: "org",
          id: org.id,
          org: { ...org, examTypes: exams },
        });
        if (expanded.includes(org.id) || needle)
          for (const exam of exams) {
            rows.push({ kind: "exam", id: org.id + exam.id, title: exam.name });
            for (const m of exam.materials)
              rows.push({
                kind: "material",
                id: org.id + exam.id + (m.bundleId || m.id),
                material: m,
              });
          }
      }
      if (c.id === "all")
        for (const m of catalog.ungrouped || [])
          if (!needle || m.name.toLowerCase().includes(needle))
            rows.push({ kind: "material", id: m.bundleId, material: m });
    }
    return needle
      ? rows.filter(
          (row, index) =>
            row.kind !== "category" ||
            (!!rows[index + 1] && rows[index + 1].kind !== "category"),
        )
      : rows;
  }, [tab, saved, materials, catalog, query, choice, expanded]);
  function open(id: string, title: string) {
    if (saved.some((b) => b.id === id))
      navigation.navigate("Setup", { bundleId: id });
    else if (materials.some((b) => b.id === id && b.ownerId === owner)) {
      if (opening) return;
      setOpening(true);
      setActionError("");
      void getBundle(owner, id)
        .then(refreshSaved)
        .then(() => navigation.navigate("Setup", { bundleId: id }))
        .catch((e) => setActionError(e.message))
        .finally(() => setOpening(false));
    } else setScope({ ids: [id], title });
  }
  const downloadDialog = scope ? (
    <Dialog title="Download subjects" onClose={() => setScope(null)}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Scholar
          state="encourage"
          width={72}
          sceneWidth={82}
          sceneHeight={86}
          animated
        />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold }}>{scope.title}</Text>
        </View>
      </View>
      <Row
        title="All subjects"
        detail="Save everything in this collection."
        icon={<Download size={22} color={palette.accent} />}
        onPress={() => {
          navigation.navigate("Download", { ...scope, mode: "all" });
          setScope(null);
        }}
      />
      <Row
        title="Choose subjects"
        detail="Pick only the subjects and papers you need."
        icon={<BookOpen size={22} color={palette.accent} />}
        onPress={() => {
          navigation.navigate("Download", { ...scope, mode: "select" });
          setScope(null);
        }}
      />
    </Dialog>
  ) : null;
  if (preparing)
    return (
      <View style={{ flex: 1 }}>
        <Header
          onBack={environment ? () => selectEnvironment(null) : undefined}
          title={environment || "Library"}
          style={{ minHeight: 60, paddingVertical: 10 }}
          right={
            <Button kind="text" onPress={() => browseMore(true)}>
              <Text style={{ color: palette.accent, fontSize: 13 }}>
                Find more
              </Text>
              <Plus size={17} color={palette.accent} />
            </Button>
          }
        />
        <Animated.View style={[{ flex: 1, minHeight: 0 }, content.style]}>
          <FlatList<Bundle | { name: string; bundles: Bundle[] }>
            data={
              environment
                ? (
                    groups.find((g) => g.name === environment)?.bundles || []
                  ).filter((b) => matchesBundle(b, needle))
                : groups.filter(
                    (g) =>
                      !needle ||
                      g.name.toLowerCase().includes(needle) ||
                      g.bundles.some((b) =>
                        b.title.toLowerCase().includes(needle),
                      ),
                  )
            }
            keyExtractor={(item) => ("id" in item ? item.id : item.name)}
            contentContainerStyle={{
              padding: 22,
              paddingTop: 16,
              paddingBottom: 36,
              maxWidth: 744,
              width: "100%",
              alignSelf: "center",
            }}
            ListHeaderComponent={
              <View>
                {
                  <>
                    <PendingDownloads navigation={navigation} />
                    <SearchField
                      value={query}
                      onChangeText={setQuery}
                      placeholder={
                        environment
                          ? "Find a publisher, subject or question"
                          : "Find an exam, material or question"
                      }
                      style={{ marginBottom: 16 }}
                    />
                  </>
                }
              </View>
            }
            renderItem={({ item }) =>
              "id" in item ? (
                <Row
                  title={item.manufacturer || "Saved material"}
                  detail={
                    item.title +
                    " · " +
                    (item.question_count || item.questions.length) +
                    " questions"
                  }
                  icon={<ExamArtwork identity={item} />}
                  onPress={() => open(item.id, item.title)}
                  style={{ paddingVertical: 24 }}
                />
              ) : (
                <Pressable
                  onPress={() => selectEnvironment(item.name)}
                  style={{
                    minHeight: 112,
                    padding: 22,
                    borderWidth: 1,
                    borderColor: palette.line,
                    borderRadius: 12,
                    backgroundColor: palette.panel,
                    flexDirection: "row",
                    gap: 18,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <ExamArtwork identity={item.name} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Title size={22}>{item.name}</Title>
                    <Muted style={{ fontSize: 11 }}>
                      {item.bundles.length} saved{" "}
                      {item.bundles.length === 1 ? "collection" : "collections"}
                    </Muted>
                  </View>
                  <ArrowRight size={19} color={palette.accent} />
                </Pressable>
              )
            }
            ListEmptyComponent={
              <View>
                {
                  <Empty
                    title={
                      saved.length
                        ? "No matching downloaded exams."
                        : "No saved exams yet."
                    }
                    icon={<BookOpen size={30} color={palette.muted} />}
                  >
                    <Button arrow onPress={() => browseMore(true)}>
                      Find an exam
                    </Button>
                    <Button
                      kind="text"
                      onPress={() => navigation.navigate("Upload")}
                    >
                      Add material
                    </Button>
                  </Empty>
                }
              </View>
            }
            ListFooterComponent={
              <View>
                <QuestionSearchResults
                  query={query}
                  matches={questionMatches}
                  searching={searching}
                  error={actionError}
                  opening={opening}
                  enabled={saved.length > 0}
                  onOpen={(match) => void openQuestion(match)}
                />
                <>
                  {saved.length ? (
                    <Button
                      kind="text"
                      onPress={() => navigation.navigate("Upload")}
                      style={{ marginTop: 24 }}
                    >
                      Add your own material
                    </Button>
                  ) : null}
                </>
              </View>
            }
          />
        </Animated.View>
        {downloadDialog}
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      {preferences.preparation ? (
        <Button kind="text" onPress={() => browseMore(false)}>
          Your downloaded exams
        </Button>
      ) : null}
      <Header
        title="Library"
        style={{ minHeight: 60, paddingVertical: 10 }}
        right={
          <Button
            kind="secondary"
            onPress={() => navigation.navigate("Upload")}
          >
            <Upload size={16} color={palette.ink} />
            <Text style={{ fontSize: 12, fontFamily: fonts.semibold }}>
              Add material
            </Text>
          </Button>
        }
      />
      <Animated.View style={[{ flex: 1, minHeight: 0 }, content.style]}>
        <FlatList
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <QuestionSearchResults
              query={query}
              matches={questionMatches}
              searching={searching}
              error={actionError}
              opening={opening}
              enabled={saved.length > 0}
              onOpen={(match) => void openQuestion(match)}
            />
          }
          data={entries}
          keyExtractor={(item) => item.kind + item.id}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 35,
            width: "100%",
            maxWidth: 1144,
            alignSelf: "center",
          }}
          ListHeaderComponent={
            <View>
              {
                <>
                  <SearchField
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search a school, subject or test"
                  />
                  <Tabs
                    value={tab}
                    onChange={(value) =>
                      content.transition(() => setTab(value))
                    }
                    options={[
                      { id: "browse", label: "Explore" },
                      { id: "flat", label: "All materials" },
                      {
                        id: "downloaded",
                        label:
                          "Saved" + (saved.length ? " " + saved.length : ""),
                      },
                    ]}
                  />
                  {libraryStatus === "loading" &&
                  tab !== "downloaded" &&
                  !materials.length ? (
                    <Skeleton kind="catalog" />
                  ) : null}
                  {libraryStatus === "error" && tab !== "downloaded" ? (
                    <>
                      <ErrorText>
                        {libraryError || "Your library couldn’t load."}
                      </ErrorText>
                      <Button kind="text" onPress={() => void refreshLibrary()}>
                        Try again
                      </Button>
                    </>
                  ) : null}
                  <View style={{ height: 20 }} />
                </>
              }
            </View>
          }
          renderItem={({ item }) =>
            item.kind === "category" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  expanded: choice === item.category || !!needle,
                }}
                onPress={() =>
                  content.transition(
                    () => {
                      setChoice(
                        choice === item.category ? null : item.category,
                      );
                      setExpanded([]);
                    },
                    choice === item.category ? -1 : 1,
                  )
                }
                style={{
                  borderWidth: 1,
                  borderColor: palette.line,
                  borderRadius: 12,
                  minHeight: 76,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  gap: 14,
                  alignItems: "center",
                  backgroundColor: palette.panel,
                  marginBottom: 10,
                }}
              >
                <StudyArt type={item.category} />
                <Text
                  style={{ fontSize: 13, fontFamily: fonts.semibold, flex: 1 }}
                >
                  {item.title}
                </Text>
                {choice === item.category ? (
                  <ChevronDown size={17} color={palette.muted} />
                ) : (
                  <ChevronRight size={17} color={palette.muted} />
                )}
              </Pressable>
            ) : item.kind === "org" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: palette.line,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Row
                    title={item.org.name}
                    detail={item.org.examTypes.length + " collections"}
                    icon={<ExamArtwork identity={item.org} />}
                    onPress={() =>
                      setExpanded((old) =>
                        old.includes(item.id)
                          ? old.filter((id) => id !== item.id)
                          : [...old, item.id],
                      )
                    }
                    style={{ borderBottomWidth: 0 }}
                    right={<ChevronRight size={19} color={palette.muted} />}
                  />
                </View>
                <IconButton
                  label={"Download " + item.org.name}
                  onPress={() =>
                    setScope({
                      title: item.org.name,
                      ids: [
                        ...new Set(
                          item.org.examTypes.flatMap((e) =>
                            (e.materials || e.manufacturers).map(
                              (m) => m.bundleId,
                            ),
                          ),
                        ),
                      ],
                    })
                  }
                >
                  <Download size={19} color={palette.muted} />
                </IconButton>
              </View>
            ) : item.kind === "exam" ? (
              <Muted
                style={{ paddingTop: 16, paddingBottom: 8, paddingLeft: 18 }}
              >
                {item.title}
              </Muted>
            ) : item.kind === "material" ? (
              <Row
                title={item.material.title || item.material.name}
                detail={(item.material.questionCount || 0) + " questions"}
                icon={<ExamArtwork identity={item.material} />}
                onPress={() =>
                  open(
                    item.material.bundleId,
                    item.material.title || item.material.name,
                  )
                }
                style={{ marginLeft: 18 }}
              />
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: palette.line,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Row
                    title={item.bundle.title}
                    detail={
                      (item.bundle.question_count ||
                        item.bundle.questions?.length ||
                        0) +
                      " questions" +
                      (saved.some((b) => b.id === item.id)
                        ? " · Ready offline"
                        : "")
                    }
                    icon={<ExamArtwork identity={item.bundle} />}
                    onPress={() => open(item.id, item.bundle.title)}
                    style={{ borderBottomWidth: 0 }}
                    right={
                      saved.some((b) => b.id === item.id) ? null : (
                        <Download size={20} color={palette.muted} />
                      )
                    }
                  />
                </View>
                {saved.some((b) => b.id === item.id) ? (
                  <Button
                    arrow
                    onPress={() => open(item.id, item.bundle.title)}
                  >
                    Start
                  </Button>
                ) : null}
              </View>
            )
          }
          ListEmptyComponent={
            <View>
              {libraryStatus === "loading" ||
              searching ||
              questionMatches.length ? null : (
                <Empty
                  title={
                    needle
                      ? "No matching materials."
                      : tab === "downloaded"
                        ? "No saved materials yet."
                        : "No materials here yet."
                  }
                  icon={<BookOpen size={28} color={palette.muted} />}
                >
                  <Button
                    kind="text"
                    arrow
                    onPress={() => navigation.navigate("Upload")}
                  >
                    Add material
                  </Button>
                </Empty>
              )}
            </View>
          }
        />
      </Animated.View>
      {downloadDialog}
    </View>
  );
}
