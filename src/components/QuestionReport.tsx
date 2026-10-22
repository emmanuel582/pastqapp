import React, { useState } from "react";
import { View } from "react-native";
import MessageSquareWarning from "lucide-react-native/icons/message-square-warning";
import { useApp } from "../state/AppContext";
import { IconButton, Dialog, Muted, Button, Field, ErrorText, Row } from "./ui";
import Select from "./Select";
import { queueReport, syncReports } from "../services/reports";
import type { Question } from "../domain/types";
export default function QuestionReport({
  bundleId,
  version,
  question,
}: {
  bundleId: string;
  version?: string;
  question: Question;
}) {
  const { owner, palette } = useApp();
  const [open, setOpen] = useState(false),
    [category, setCategory] = useState("answer"),
    [note, setNote] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <IconButton
        label="Report a question issue"
        onPress={() => {
          setOpen(true);
          setSent(false);
          setError("");
        }}
      >
        <MessageSquareWarning size={17} color={palette.muted} />
      </IconButton>
      {open ? (
        <Dialog
          title="Report question"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          {sent ? (
            <>
              <Muted>
                Saved. Your report will be sent when connected and checked by a
                person.
              </Muted>
              <Button onPress={() => setOpen(false)} style={{ marginTop: 20 }}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Row
                title="Issue"
                right={
                  <Select
                    label="Issue"
                    value={category}
                    options={[
                      { value: "answer", label: "Answer key" },
                      { value: "diagram", label: "Diagram" },
                      { value: "wording", label: "Question or options" },
                      { value: "solution", label: "Solution" },
                      { value: "topic", label: "Topic" },
                    ]}
                    onChange={setCategory}
                  />
                }
              />
              <Field
                label="Details (optional)"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={2000}
                style={{ height: 120, marginTop: 12, textAlignVertical: "top" }}
              />
              {error ? <ErrorText>{error}</ErrorText> : null}
              <Button
                busy={busy}
                onPress={() => {
                  setBusy(true);
                  setError("");
                  void queueReport(owner, {
                    bundleId,
                    questionId: String(question.id),
                    version: version || null,
                    category,
                    note,
                    subject: question.subject,
                    year: String(question.year || ""),
                  })
                    .then(() => {
                      setSent(true);
                      void syncReports(owner).catch(() => {});
                    })
                    .catch(() =>
                      setError(
                        "This report could not be saved. Check device storage and try again.",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
                style={{ marginTop: 20 }}
              >
                Send report
              </Button>
            </>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
