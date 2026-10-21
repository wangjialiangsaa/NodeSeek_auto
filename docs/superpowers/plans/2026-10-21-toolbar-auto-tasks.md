# Compact toolbar and automatic tasks

**Goal:** Keep the native editor header compact, preserve existing colored buttons, add configurable lottery replies and daily attendance.

**Design:** `toolbar.js` groups the existing buttons in a floating panel. Template dialogs remain children of the existing app. Upload feedback lives inside the panel; its compact trigger shows a busy indicator without changing width. `auto-tasks.js` owns settings, account scoped task records, browser locks, daily attendance and native editor reply submission. User confirmed the single menu design and an empty default reply: automatic replies are disabled until a phrase is saved and enabled. Daily attendance defaults on and uses fixed rewards (`random=false`). No background crawling or posting outside the current thread.

**Constraints:** Preserve draft content and existing features. Never use live comments or real uploads in tests. Never automatically retry a reply with uncertain delivery. Only official NodeSeek lottery links in the current thread starter qualify. Skip expired lotteries, own posts and any previously replied threads. An occupied editor is left untouched. Daily tasks run while NodeSeek is open and use Beijing calendar dates.

1. Write toolbar regression tests: one compact trigger, existing button labels preserved in a hidden panel, accessible toggle, outside/Escape dismissal, template modal behavior, private editor compatibility, upload feedback containment.
2. Implement `installEditorToolbar(app)` and call after the existing feature setup. Test narrow/light/dark/fixed editor layouts.
3. Write automatic task tests: saved settings, matching official lottery link, native reply and draft safety, per-account/per-thread deduplication, uncertain submissions, dates, attendance JSON success versus failure, same-day/multiple-tab suppression, disable and runtime teardown.
4. Implement `installAutomaticTasks()`, `openAutomaticTaskSettings()` and helpers. Reuse user identification, lottery parsing and native editor functions; use the documented attendance endpoint with same-origin credentials. Confirm native posting by observing a new own comment; retain a submitted record when the result is unknown.
5. Integrate build modules and menu/settings entry. Update README and release metadata to 1.4.53. Build, run all regression tests, syntax/diff checks, request independent review, then publish to the existing authorized GitHub repository.

**Validation:** Node test runner + jsdom; controlled local browser preview only. The production NodeSeek page is inspected read-only. A new browser lock is required before an automatic task mutates server state; unavailable locks produce an explanatory status instead of racing another tab.

**Review adjustment:** Cached/visible comments cannot rule out an old reply. Before preparing a reply, query the existing official user comment history under the same post lock, up to 10 pages. Only a verified empty terminal page permits submission. A matching old reply, failed request or incomplete history skips posting. Network operations have a 20-second timeout; failed history checks wait five minutes before retry. Revalidate account, route, settings and draft after every asynchronous lookup before changing the editor.
