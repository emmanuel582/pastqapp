# Design traceability

Reference: the frozen web source in ../reference/web, copied from C:/Users/DELL/PastQ/client. Source edits remain confined to the mobile folder.

| Source feature | Mobile implementation | Evidence / limit |
| --- | --- | --- |
| study-theme.css dark/light colors | src/theme/tokens.ts | Direct palette transcription |
| Manrope / Outfit / Lora / JetBrains Mono | App.tsx static font requires | Only twelve used font faces bundled |
| BottomNav curved center/camera | src/components/BottomNav.tsx | Original SVG path; native safe-area inset |
| Welcome greeting, blink and wave | Greeting + original bundled SVG/HTML | Original timings; reduced motion; isolated display WebView |
| Scholar sprite atlas | Scholar and lossless frame crops | Existing artwork/poses; no invented replacement mascot |
| Library exam/category artwork | ExamArtwork / StudyArt | Original assets; exam bitmaps resized to 192px for 42px views |
| Authentication and onboarding | AuthShell / AuthScreen / OnboardingScreen | Original hierarchy, typography and controls |
| Setup subjects/session/review | SetupScreen | Same three-step layout; topic search/counts and dated-topic mode repaired |
| Exam tools, questions and review | ExamScreen / StudyTools / RichText | Native controls; isolated HTML/math view only for rich question content |
| Results | ResultsScreen | Source summary/artwork/subject bars plus the explicitly requested topic table |
| Upload/manual/processing/review | UploadScreen / ManualScreen / ProcessingScreen / ReviewMaterialScreen | Native document picker/camera; close control and recovery added where needed |
| Preferences/history/storage/etc. | Corresponding screens | Native adaptations using source palette/type/spacing |

The requested topic table contains presented, attempted, correct, missed, unanswered and ungraded counts. It separates identical topic names across subjects, preserves source section fallback, and scrolls horizontally on narrow phones.

Browser QA has exercised the React Native Web implementation with sample questions. A 390x844 screenshot was inspected for results and the topic table; the initial local walkthrough also used the default desktop viewport. This is not proof of pixel equivalence on iOS/Android. Still required: side-by-side source/device screenshots at 360/390/430 widths, both themes, keyboard/safe areas, native text metrics, larger accessibility fonts, and animation recordings. The profile now reproduces the original light form, 88px avatar, phone field and fixed footer. Native dialogs and profile text metrics still need device comparison. Exact design parity remains an acceptance gate, not a completed claim.
