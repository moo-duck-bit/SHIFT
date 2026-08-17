# SHIFT

An LLM-based adaptive interface for short-form video viewing intervention.
SHIFT combines a user's viewing goals with real-time behavioral patterns to
generate personalized intervention messages.

## Method

**VLM-based content analysis and classification.**
An Accessibility Service runs in the background, monitoring scroll coordinates
and foreground status in real time. Only minimal app-status checks are performed
while short-form apps are inactive, to limit battery consumption. When a content
switch is detected from scrolling, a screenshot is captured and analyzed by a VLM
to extract a concise description and key tags of the content being viewed.
Content type, viewing time, and cumulative viewing count are recorded in logs.
When the user selects the planned or an alternative action, a photo taken by the
camera is processed by the same VLM to verify that the chosen activity is
actually being performed.

**Prompt-based intervention message generation.**
Four prompting strategies are applied to the collected data: (1) VLM
reconstruction of the extracted information; (2) goal-achievement-focused
messages generated from plans and viewing patterns; (3) motivational
recommendations based on pre-selected alternative activities and previously
successful messages; and (4) embedding space integration.

**Adaptive intervention and learning.**
When the 15-minute threshold is reached, personalized intervention messages —
current viewing statistics and recommended alternative activities — are presented
as overlays through the System Alert Window. All user responses are recorded in
Firebase to continuously learn individual intervention effectiveness.

## Structure

| Path | |
| --- | --- |
| `modules/my-module/android/` | Accessibility Service, screen capture, overlay, message generation |
| `src/VLM/vlm.ts` | VLM content classification and plan verification |
| `src/config/firebase.ts` | plans, viewing logs, intervention results |
| `src/screens/` | plan, home, camera, statistics, report |
| `App.tsx` | permissions, listeners, navigation |

## Setup

```bash
npm install
cp .env.example .env    # fill in API key and Firebase config
npx expo prebuild -p android
npx expo run:android
```

Grant manually in Android settings after first launch: **Accessibility**,
**Display over other apps**, **Usage access**, and **Camera**.

## License

MIT
