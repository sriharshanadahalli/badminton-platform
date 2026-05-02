# Project Guardrails: Badminton Scoring & Tournament System

> [!NOTE]
> For a full history of requirements, features, business logic, and implementation phases, refer to the [Project Knowledge Base](file:///d:/BadmintonScoring/project_knowledge_base.md).

## 1. UI & UX Standards
- **Standardized Modals**: No native browser `alert()` or `confirm()`. Use the custom themed modals from `TournamentModals.jsx` (Alert/Confirm) or specific functional modals (MatchSetup/WinConfirmation).
- **Navigation Stability**: Use fixed-width grid layouts for tab navigation to prevent horizontal "jumps" when font weights or labels change.
- **Persistent Viewport**: Force `overflow-y: scroll !important` on the HTML root to prevent layout shifts when switching between scrollable and non-scrollable pages.
- **Standardized Tables**: Every data table MUST include a serial number (`#`) column as the first column for better scannability and professional alignment.
- **Visual Theme**: Maintain the "Premium Slate" aesthetic (Slate-950 background, Amber/Emerald accents, backdrop-blur for overlays).

## 2. Core Feature Map (The "Do Not Break" List)

| Feature | Primary Logic Location | Critical Dependencies | Failure Symptom |
| :--- | :--- | :--- | :--- |
| **Device Lock** | `MatchContext.jsx` / `server.js` | `lockedByDeviceId`, `localStorage` | Multiple tablets can score the same court. |
| **Bracket View** | `server.js` (Bracket API) | `mapMatchDataGlobal` (Bulk mode) | "Bracket not loading" or 500 Error. |
| **Score Sync** | `server.js` (Socket.io) | `io.to(room).emit` | Scores don't update on Signage/Mobile. |
| **Result Retention** | `server.js` / `SignageCourtPanel.jsx` | `lastMatch`, `updatedAt` timestamps | Finished matches disappear too quickly. |
| **Score Highlights** | `LiveScoreDisplay.jsx` | `checkWinner`, `isWinningScore` | Match winners don't turn green/emerald. |
| **Match Zoom** | `SchedulerView.jsx` (`jumpToMatch`) | `scrollIntoView`, DOM IDs (`match-{ID}`) | Navigation from Player View fails to center the match. |

---

## 2. Shared Core Utilities
*   **`mapMatchDataGlobal(matchId, preFetchedData)`**: This is the most sensitive function in the backend. 
    *   **Rule**: It must support both "Single Fetch" (Umpire App) and "Bulk Fetch" (Bracket View).
    *   **Rule**: Never remove fields from the returned object; only add them.
    *   **Rule**: If adding a database query (like `Match.findOne`), ensure it uses the `preFetchedData` cache to avoid "N+1" performance issues in loops.

---

## 3. Mandatory Verification Checklist
*Before declaring a task "Done", the following MUST be verified:*

- [ ] **Umpire Access**: Can an umpire load the scoring screen for an assigned court?
- [ ] **Device Lock**: If a court is open on Tablet A, does Tablet B get an "Access Denied" error?
- [ ] **Signage Update**: Do points scored by the umpire appear instantly on the signage screen?
- [ ] **Bracket Integrity**: Does the tournament bracket load without a 500 error?
- [ ] **Match Zoom**: In the Player View, can you click a category and be "zoomed" (scrolled/highlighted) to the correct match in the Brackets tab?
- [ ] **Completion Workflow**: When a match is completed, does the winner turn green, and does the court remain occupied for 5 minutes (Result Retention)?

---

## 4. Known "Fragile" Areas
- **`TournamentMatch` vs `Match`**: Remember that `TournamentMatch` is the source of truth for the bracket, while `Match` is the source of truth for real-time scoring. Synchronization between these two is critical.
- **Socket Rooms**: Room names are strictly formatted as `spectator_court_{ID}` or `court_status_{ID}`. Changing these will break real-time updates.
- **Match Zoom Reliability**: The `jumpToMatch` feature relies on DOM `scrollIntoView`.
    - **Rule**: Any changes to tab transitions (e.g. `AnimatePresence`), global CSS (overflow properties), or `SchedulerView` layout MUST be verified against the "zoom from player view" flow.
    - **Rule**: Bracket container IDs (`bracket-view-container`) and card IDs (`match-{_id}`) must remain stable.
    - **Rule**: Avoid `display: none` for tabs if possible; use conditional rendering or visibility to ensure the scroll target can be found by `document.getElementById`.

---

## 5. Recent Regression Log (Lessons Learned)
- **Shadowing Bug**: Fixed a bug where a local variable named `tMatch` hid the actual match document in `mapMatchDataGlobal`, breaking the bracket.
- **Lock Data Starvation**: Fixed a bug where optimizing the backend fetch removed the `lockedByDeviceId`, effectively breaking the device lock feature.
- **Reference Errors**: Ensure all hardcoded team IDs (1 or 2) in UI components are correctly scoped within their respective loops.
- **UI Consistency**: Use themed custom modals instead of native `window.alert()` or `window.confirm()` calls to maintain branding and premium feel.
