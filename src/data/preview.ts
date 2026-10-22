import type { Bundle, Catalog } from "../domain/types";
// The three source App.tsx DEMO_QUESTIONS, available only in explicit development preview.
export const previewBundle: Bundle = {
  id: "design-preview",
  title: "UTME practice",
  examType: "UTME",
  questions: [
    {
      id: 1,
      subject: "Use of English",
      topic: "Vocabulary",
      year: "2025",
      paper: "2025",
      question:
        "Choose the word that is nearest in meaning to the italicized word: The man's *audacity* was quite surprising.",
      options: ["boldness", "foolishness", "cowardice", "cleverness"],
      correct: 0,
      explanation:
        "Audacity means a willingness to take bold risks, which is synonymous with boldness.",
    },
    {
      id: 2,
      subject: "Mathematics",
      topic: "Linear equations",
      year: "2025",
      paper: "2025",
      question: "If 2x + 3 = 11, what is the value of x?",
      options: ["2", "3", "4", "5"],
      correct: 2,
      explanation:
        "Subtract 3 from both sides to get 2x = 8. Divide by 2 to get x = 4.",
    },
    {
      id: 3,
      subject: "Physics",
      topic: "Scalars and vectors",
      year: "2025",
      paper: "2025",
      question: "Which of the following is a scalar quantity?",
      options: ["Velocity", "Force", "Speed", "Acceleration"],
      correct: 2,
      explanation:
        "Speed is a scalar quantity because it only has magnitude, unlike vector quantities which have both magnitude and direction.",
    },
  ],
};
export const previewCatalog: Catalog = {
  universities: [
    {
      id: "jamb",
      name: "Joint Admissions and Matriculation Board",
      shortName: "JAMB",
      type: "exam_board",
      examTypes: [
        {
          id: "utme",
          name: "UTME",
          manufacturers: [
            {
              id: "preview",
              bundleId: "design-preview",
              name: "UTME practice",
              questionCount: 3,
            },
          ],
        },
      ],
    },
  ],
};
