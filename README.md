# SHIFT

An LLM-powered If-Then feedback tracker for short-form video self-regulation.
SHIFT combines a user's viewing goals with real-time behavioral patterns to
generate personalized intervention messages.

> **SHIFT: LLM-powered If-Then feedback tracker for short-form video self-regulation**
> Hayeon Yang, Jiheun Hong, Jingyeong Park, Jumin Seo, Hayoung Oh
> UIST '25 Adjunct · [10.1145/3746058.3758397](https://doi.org/10.1145/3746058.3758397)

## How it works

- **Sensing** — an Accessibility Service monitors scroll coordinates and foreground status, capturing a screenshot on each content switch.
- **Analysis** — a VLM extracts a description and key tags from the screenshot; content type, viewing time, and cumulative count are logged.
- **Intervention** — at the threshold, an overlay presents viewing statistics and a recommended alternative activity; the user's chosen action is verified by the same VLM from a camera photo, and all responses are logged to Firebase.

## Structure

| Path | |
| --- | --- |
| `modules/my-module/android/` | Accessibility Service, screen capture, overlay |
| `src/VLM/vlm.ts` | content classification, plan verification |
| `src/config/firebase.ts` | plans, viewing logs, intervention results |
| `src/screens/` | plan, home, camera, statistics, report |

## Setup

```bash
npm install
cp .env.example .env
npx expo prebuild -p android
npx expo run:android
```

Grant **Accessibility**, **Display over other apps**, **Usage access**, and
**Camera** in Android settings after first launch.

## Citation

```bibtex
@inproceedings{yang2025shift,
  title     = {SHIFT: LLM-powered If-Then Feedback Tracker for Short-form Video Self-Regulation},
  author    = {Yang, Hayeon and Hong, Jiheun and Park, Jingyeong and Seo, Jumin and Oh, Hayoung},
  booktitle = {Adjunct Proceedings of the 38th Annual ACM Symposium on User Interface Software and Technology},
  year      = {2025},
  pages     = {1--4},
  publisher = {ACM},
  doi       = {10.1145/3746058.3758397}
}
```

## License

MIT
