import { View } from "react-native";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import { Text, Muted, Row, ErrorText } from "./ui";
import { useApp } from "../state/AppContext";
import { fonts } from "../theme/tokens";
import type { QuestionMatch } from "../domain/search";
export default function QuestionSearchResults({
  query,
  matches,
  searching,
  error,
  opening,
  enabled,
  onOpen,
}: {
  query: string;
  matches: QuestionMatch[];
  searching: boolean;
  error: string;
  opening: boolean;
  enabled: boolean;
  onOpen: (match: QuestionMatch) => void;
}) {
  const { palette } = useApp();
  return (
    <View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {opening ? <Muted>Opening your material…</Muted> : null}
      {query.trim().length >= 2 && enabled ? (
        <View style={{ paddingVertical: 20 }}>
          <Text style={{ fontFamily: fonts.semibold, marginBottom: 12 }}>
            In downloaded questions
          </Text>
          {searching ? (
            <Muted>Searching…</Muted>
          ) : matches.length ? (
            matches.map((match, i) => (
              <Row
                key={match.bundleId + ":" + i}
                title={
                  match.question.question
                    .replace(/<[^>]*>/g, " ")
                    .slice(0, 180) || "View question / diagram"
                }
                detail={[
                  match.question.subject,
                  match.question.topic || match.question.section,
                  match.question.year,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => onOpen(match)}
                right={<ArrowRight size={17} color={palette.accent} />}
              />
            ))
          ) : (
            <Muted>No matching downloaded questions.</Muted>
          )}
          {matches.length === 40 ? (
            <Muted>Showing the first 40 matches. Refine your search.</Muted>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
