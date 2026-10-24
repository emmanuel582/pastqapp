# focalPoint — Play Console submission pack

Prepared 24 October 2026 from the actual mobile source and current Google Play documentation. This is a field-by-field draft, not a declaration that release gates have passed. Do not submit statements marked HOLD until they are true.

## App creation and listing

| Field            | Answer                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| App name         | focalPoint                                                                                                                                       |
| Default language | English (United Kingdom), if that is the language used for support                                                                               |
| App or game      | App                                                                                                                                              |
| Category         | Education                                                                                                                                        |
| Download price   | Free at launch                                                                                                                                   |
| Contact email    | wealthconsort@gmail.com                                                                                                                          |
| Website          | Do not enter usefocalpoint.com; the owner has not purchased it yet. A website is optional where Console permits it.                              |
| Package name     | com.pastq.study — keep this existing identifier for signing, upgrades and Firebase. The display name is focalPoint.                              |
| Tags             | Choose relevant available Console tags such as Education, Exam preparation or Study tools; the exact available choices are controlled by Google. |

### Short description (within 80 characters)

Practise exam questions offline, review topics and study your own papers.

### Full description (within 4,000 characters)

focalPoint helps you turn your questions into focused study.

Practise downloaded exam papers offline, prepare your own materials, and review the topics that need more attention.

STUDY YOUR WAY
• Browse available papers, including WAEC and UTME materials.
• Download the subjects and papers you want to keep on your phone.
• Choose subjects, topics and timed practice settings.
• Answer written/theory questions with their original numbered parts.

WORK THROUGH THE QUESTION
• Swipe between questions without leaving your exam.
• Use the movable calculator and expandable writing board.
• Keep your working with each question so you can revisit your reasoning.
• Resume saved practice sessions.

LEARN FROM YOUR RESULTS
• Review answers from the first question or jump to a question number.
• See correct, wrong and unanswered questions in answer review.
• Explore your topic results and choose what to practise next.

BRING YOUR OWN MATERIALS
Upload question photos, PDFs or text, review the prepared questions, and save them for practice. Uploading and question extraction require an internet connection.

DOWNLOADED PAPERS WORK OFFLINE
New downloads, sign-in, uploads and account synchronisation require internet access. Previously saved papers and working can be used offline. Some features depend on available source content; written answers are not automatically marked.

focalPoint is an independent study app and is not affiliated with or endorsed by WAEC, JAMB or other examination bodies.

Support: wealthconsort@gmail.com

Do not add claims of guaranteed scores, official endorsement, a million-user capacity, free lifetime access, or material you do not have the rights to distribute.

## App content declarations

| Console question                       | Current app answer                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contains ads?                          | No advertising SDK or ad placements were found. Select No for the current build, provided administrator campaigns are not used to serve third-party ads.                                                                  |
| Access restrictions?                   | Some or all functionality is restricted by sign-in. Supply a working, confirmed, reusable email/password account.                                                                                                         |
| News or magazine app?                  | No. This is study/practice software.                                                                                                                                                                                      |
| Government app?                        | No. Do not claim to represent an examination board or government body.                                                                                                                                                    |
| Health features?                       | No health features. Biology exam questions are not a medical service. Reassess if medical advice or health tracking is added.                                                                                             |
| Financial features?                    | My app does not provide financial features. Future study subscriptions are not a banking or money-transfer feature.                                                                                                       |
| COVID-19 tracing/status?               | No, if this legacy form is shown.                                                                                                                                                                                         |
| Advertising ID?                        | No advertising-ID use was found in app code. Verify the final AAB merged manifest and SDK behaviour before final submission.                                                                                              |
| External downloads of executable code? | No such feature was found; question-paper downloads are data, not app updates.                                                                                                                                            |
| Real-money gambling or contests?       | No.                                                                                                                                                                                                                       |
| Account creation?                      | Yes: email/password and Google OAuth.                                                                                                                                                                                     |
| Data deletion?                         | The native Help & privacy page has an account deletion request path. Public deletion page and operational handling must be verified before declaring complete. Removing a session or signing out is not account deletion. |

## Target audience — HOLD

The owner wants anyone of any age to be able to study. That product goal must not be converted into an inaccurate “all ages” declaration. Google asks which ages the actual content and experience were designed for.

Current WAEC/UTME/university workflows support secondary-school and older students. The current audit has not established suitability for preschool children or early readers. Do not tick “5 and under” or “6–8” just because installation should be available to everybody.

If any child age group is selected, complete the mixed/child audience review: age-appropriate content, parent/guardian consent where required, provider terms, authentication and SDK data collection, uploads containing personal information, and store artwork. Do not mark Families-compliant or Teacher Approved without evidence. The actual age-group selections remain a release gate.

## Content rating (IARC)

- Contact email: wealthconsort@gmail.com.
- Questionnaire app type: usually All other app types for an education utility; use the category actually offered by Console.
- Users cannot chat, message or publicly interact with other users in the current student UI. Private uploads and question reports are not a public social network.
- No unrestricted web-browser feature, live location sharing, gambling, digital currency trading or random-item purchases were found.
- No paid products are implemented in the current build. Update the rating answers when purchases are added.
- Do not answer No indiscriminately to violence, sex/nudity, drugs, language or frightening content. Review all distributed questions and diagrams, particularly biology/reproduction/anatomy and historical or literary passages, and answer each question exactly. Educational context does not automatically mean the content is absent.
- Google/IARC assigns the rating; do not enter an invented rating such as Everyone or 3+ as if already awarded.

## Data safety — actual app mapping

### Top-level answers

- Does the app collect or share user data? YES. Offline practice does not make the whole app data-free.
- Encrypted in transit? HTTPS is used for API/auth/provider traffic; HTTP remote question images were removed. Verify all final build endpoints before selecting Yes.
- Account creation methods: email/password; OAuth (Google).
- Independent security review? NO qualifying independent audit has been completed.
- Delete account: YES only after the in-app request path, public URL and real support handling are verified.
- Delete some data without deleting the account: local session/download removal exists. Do not claim every cloud copy is erased until the deletion/outbox checks pass.

### Data types and purposes

The classifications below come from app code. Required/optional and sharing answers need a final check of the shipped SDK configuration and service-provider arrangements.

| Type                                        | Why it is used                                                                                       | Control / purpose                                                                                                                                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal info → Name                        | Email signup and Google profile; Supabase account/profile                                            | Required in email signup; Account management and App functionality                                                                                                                                                                        |
| Personal info → Email address               | Sign-in, authentication and account requests                                                         | Required; Account management and App functionality                                                                                                                                                                                        |
| Personal info → User IDs                    | Supabase identity and owner-bound progress/materials                                                 | Required; Account management and App functionality                                                                                                                                                                                        |
| Personal info → Phone number                | Optional profile field supported by the profile screen and metadata update                           | Optional if exposed/used; Account management. Remove this row only if the shipped build truly cannot collect it.                                                                                                                          |
| Photos and videos → Photos                  | Student-uploaded question photographs                                                                | Optional; App functionality                                                                                                                                                                                                               |
| Files and docs                              | Uploaded PDFs/text documents                                                                         | Optional; App functionality                                                                                                                                                                                                               |
| App activity → Other user-generated content | Pasted question text and student-written reports                                                     | Optional; App functionality                                                                                                                                                                                                               |
| App activity → App interactions             | Answers selected, session results, question/topic outcomes and practice timing                       | Automatic when cloud synchronisation runs; App functionality, Personalisation; Analytics where used to analyse learning/activity                                                                                                          |
| Device or other IDs                         | Push tokens and installation identifiers; Firebase messaging installation behaviour must be verified | Notifications are optional at app level; verify Firebase automatic initialisation before declaring collection optional. App functionality and Developer communications; add Advertising or marketing if using the channel for promotions. |
| Personal info → Other info, if applicable   | Chosen school/exam, undergraduate status and study preferences                                       | Optional details, except required onboarding selections; Personalisation and App functionality                                                                                                                                            |

Do not add location, contacts, microphone/audio, SMS, call logs, installed-app lists, financial information or payment history merely because the app uses a camera or internet. No such access was found in the app feature audit. IP address processing must be included under the relevant actual use (for example approximate location only if location is inferred); do not invent geolocation use.

Crash logs/diagnostics are not automatically declared solely because local error messages exist. Audit any enabled production telemetry and provider SDKs separately.

### Ephemeral processing

Account information, uploaded papers and stored study outcomes are retained, so answer No to ephemeral processing for those types. Do not describe stored uploads as memory-only processing. Purely local drawing-board strokes and written answers are not transmitted by the normal progress-sync payload; user-selected backup/export destinations are separate.

### Sharing — HOLD on a blanket “No data shared” claim

The VPS, Supabase, Expo/Firebase/Apple and extraction providers participate in the service. Google has a service-provider exception, but it applies only where the provider processes data on the developer’s behalf under the relevant conditions.

OpenRouter routes uploaded content to model providers with differing retention/training practices. Until the selected provider settings and applicable arrangements are verified, do not select blanket No sharing. Uploaded Photos, Files/docs and Other user-generated content need a specific provider/sharing decision. Do not claim zero retention, no model training or end-to-end encryption without proof.

## Privacy and deletion URLs

Prepared routes on the existing HTTPS API host (must return public HTML with no login before submission):

- Privacy: https://76.13.110.6.nip.io/legal/privacy
- Account deletion: https://76.13.110.6.nip.io/legal/delete-account
- Terms: https://76.13.110.6.nip.io/legal/terms

These are preparation targets, not claimed live until the deployment checks pass. The support address is wealthconsort@gmail.com. A future custom domain can replace them after it is owned, secured and reachable.

Account deletion must cover the account and associated cloud profile/progress/private uploads; an email link alone does not prove the support process fulfils requests. Maintain an authenticated ownership-verification process, remove associated provider-held data as applicable, and disclose legitimate retention exceptions. Do not publish an invented deletion deadline.

## Reviewer access instructions — copy after supplying private credentials

Instruction title: focalPoint reviewer access.

Use the email and password supplied privately in this App access section. The account must be email-confirmed, available without a one-time code, and kept active throughout review. Do not require reviewers to use their personal Google account.

1. Open focalPoint and select Sign in.
2. Sign in with the supplied email and password.
3. If onboarding appears, choose the learner option and a study focus.
4. Open Library, select an available paper and download a subject/paper.
5. Start practice, answer questions, open the calculator/writing board, then finish.
6. Select Review answers to open Question 1; use question numbers to inspect outcomes.
7. Open Progress or Past sessions to review completed practice.
8. Upload a permitted PDF/photo/text file, review the prepared questions and save the material.
9. Open Preferences → Help & privacy for policy and account deletion information.

Internet is needed for first sign-in, new downloads and upload processing. Downloaded practice works offline. No subscription or payment is required in this build. Provide real, repeatable access to all reviewable functionality; do not substitute a static demo or hide broken features.

## Graphics

- App icon: store/icon-512.png, 512×512 PNG, opaque.
- Feature graphic: 1024×500 JPEG/opaque PNG; create with the real focalPoint branding.
- Minimum two real screenshots. Recommended set: library, timed question with writing board, answer review, topic progress, uploads. Use actual app screens without synthetic scores or unsupported claims. Up to eight per device type.
- A promotional video is optional.

## New personal account: closed test and production access

Before production access, at least 12 testers must remain opted in continuously for 14 days. Real engagement matters. A sideloaded EAS APK does not count as a Play closed-test opt-in. Complete account/identity and Android device verification when Console requests it. Then distribute the AAB through Play’s testing track.

Google’s production-access form commonly asks:

1. How did you recruit testers? Give the real channels and relationships used. Do not invent recruitment or tester counts.
2. How easy was recruitment? Select the real experience.
3. What engagement did you receive? State actual features tested, devices and frequency, supported by records.
4. What feedback did testers provide and how was it collected? Summarise real reports and the channel used.
5. Who is the intended audience? Describe the actual learner age groups/content design after the audience gate is resolved.
6. How does the app provide value? Suggested answer: “focalPoint combines offline question practice, imported study materials, per-question working and topic-level review so students can practise and understand where they need more work.”
7. How many installs do you expect in the first year? Choose your genuine estimate; there is no evidence-based number to fabricate here.
8. What changes did you make after the test? List changes actually made during the closed test. Existing fixes are not proof of a future test.
9. How did you decide it was ready? Use measured stability, complete critical journeys, feedback resolution and release-gate results. Passing unit tests alone is insufficient.

## Build and launch sequence

1. Finish the child-audience/provider/deletion/schema/access gates in docs/PRODUCTION_READINESS.md.
2. Verify Android target SDK and manifest. The last successful 1.0.7 build targeted API 36, matching the current new-app minimum.
3. Use an Android App Bundle (.aab), not the preview APK. Preserve the signing key/package identity and enable Google Play App Signing.
4. Validate the production EAS environment’s API/auth variables. Do not point production at an unverified preview environment or enable fixture paths.
5. Upload the first AAB manually in Play Console; Expo documents this first-upload requirement before API submission can be used. Follow the local-download restriction agreed with the owner when arranging the transfer.
6. Complete listing, declarations and restricted-access credentials, then start internal/closed testing.
7. Run the required genuine closed test, apply for production access, and wait for approval before public rollout.

## Free now, paid later

Keep the download free if the plan is free installation with premium study features later. Google does not let an app offered free later become a paid download under the same package. Future paid digital features/subscriptions generally require Google Play Billing unless a specific policy/program exception applies. Add billing, restore/manage/cancel flows, accurate pricing and updated privacy/Data safety before charging.

## Official sources

- Listing fields: https://support.google.com/googleplay/android-developer/answer/9859152
- App content: https://support.google.com/googleplay/android-developer/answer/9859455
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Target audience: https://support.google.com/googleplay/android-developer/answer/9867159
- Families: https://support.google.com/googleplay/android-developer/answer/9893335
- Content rating: https://support.google.com/googleplay/android-developer/answer/9859655
- Reviewer login: https://support.google.com/googleplay/android-developer/answer/15748846
- Preview graphics: https://support.google.com/googleplay/android-developer/answer/9866151
- Personal-account testing: https://support.google.com/googleplay/android-developer/answer/14151465
- API targets: https://developer.android.com/google/play/requirements/target-sdk
- Future pricing: https://support.google.com/googleplay/android-developer/answer/6334373
- Payments: https://support.google.com/googleplay/android-developer/answer/10281818
- Expo submission: https://docs.expo.dev/submit/android/
- Extraction provider data practices: https://openrouter.ai/privacy

## Latest verified implementation
- Public privacy URL: https://76.13.110.6.nip.io/legal/privacy (HTTP 200, no sign-in).
- Public deletion-request URL: https://76.13.110.6.nip.io/legal/delete-account (HTTP 200, no sign-in).
- Support URL: https://76.13.110.6.nip.io/legal/support (HTTP 200). Support email remains wealthconsort@gmail.com.
- Upload intake supports JPEG/PNG/WebP/GIF/HEIC/HEIF, PDF, DOCX/DOC, PPTX/PPT, ODT/RTF and TXT/Markdown/JSON. Word/slides convert to PDF. A document is limited to 200 MB (photos 40 MB; text 10 MB), a transfer to 300 MB and PDFs to 1,000 pages; unsupported/encrypted/unreadable material can be rejected with a retry/PDF-copy message. Do not advertise every possible file format.
- Real PNG, PDF and DOCX extraction and private confirmation passed on the VPS. Native background/resume adapters have tests; actual phone suspension/relaunch checks on 1.0.8 remain pending.
- New-account summary cloud sync passed with the existing schema. Detailed topic graphs are computed from local attempts; full topic cloud synchronization is queued until the detailed tables exist. Do not advertise complete cross-device working/analytics sync yet.
- Included original graphic: store/feature-graphic-1024x500.png. Icon: store/icon-512.png. Capture final store screenshots from a real installed build; a browser preview alone is insufficient device evidence.
