# Project Knowledge Base: Badminton Scoring & Tournament Management System

This document serves as the comprehensive source of truth for the Badminton Scoring system. it covers the architectural decisions, feature sets, business logic, and implementation history from inception to the current state.

## 1. Project Overview
A full-stack tournament management system designed for live badminton events. It supports real-time scoring, automated bracket/league generation, court scheduling, and live spectator signage.

### Core Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion (Animations), Lucide React (Icons).
- **Backend**: Node.js, Express, MongoDB (Mongoose).
- **Real-time**: Socket.io for instantaneous score updates across umpire, scheduler, and signage views.

---

## 2. Feature Breakdown

### A. Tournament Formats
1. **Single Elimination (Knockout)**:
   - Supports 2^n and non-2^n player counts using "Bye" logic.
   - Seed-aware pairing algorithm to ensure top players don't meet in early rounds.
   - Mathematically precise bracket visualization with dynamic connector lines.
   - **Golden Point**: Supports tie-breaker points (e.g., golden point at 20-20 or 29-29).
2. **Round Robin (League)**:
   - Automated match generation for all-play-all formats.
   - Real-time standings table calculating Matches Played, Wins, Losses, Games Won/Lost, and Point Difference (PD).
   - **Golden Point**: Configurable parameter for league matches to enforce a sudden-death finish.

### B. Scheduler & Management
- **Court Assignment**: Manual selection-based assignment of matches to available courts (Note: Drag-and-drop is **not** implemented).
- **Player Availability Logic**: Real-time tracking of player status (Available, On Court, In Queue).
- **Tournament Overview**: Summary statistics showing match progress per category (Total Matches, Completed, Ongoing). Note: "Bye" matches are excluded from total counts to avoid misleading scheduler stats.
- **Data Portability**: CSV/JSON import for players, participations, and categories.

### C. Device Compatibility & Screens
- **Mobile-Friendly (Touch Optimized)**:
    - **Umpire UI** (`Scoreboard.jsx`): Designed for mobile/tablet use on-court.
    - **Mobile Live Score** (`MobileLiveScore.jsx`): Personal spectator view for smartphones.
- **Big Display (Signage Optimized)**:
    - **Tournament Signage** (`SignageView.jsx`): High-visibility grid for large hall displays.
    - **Court Signage** (`SignageCourtPanel.jsx`): Dedicated display for specific court status.
- **Desktop/Admin**:
    - **Scheduler View** (`SchedulerView.jsx`): Comprehensive dashboard for tournament directors.

### D. Live Scoring (Umpire UI)
- **Match Lifecycle**: 6-stage status flow (Assigned -> Toss -> Warmup -> In Progress -> Win Confirmation -> Completed).
- **Undo Logic**: Robust state management allowing umpires to undo points or match completion mistakes.
- **Rules Engine**: Automated game switching (best of 3), side changes, and service tracking.

---

## 3. Performance & Data Logic

### Fast vs. Normal Data Fetching
To handle large tournaments with hundreds of matches, the system implements a two-tier fetching strategy:
1. **Normal Fetching**: Individual document lookups used for single-match updates.
2. **Fast Fetching (Bulk Mapping)**: Used in Bracket and Tournament Overview pages. The system pre-fetches all Players, Participations, and Live Matches in a single parallel query block. These are converted into O(1) lookup maps before processing the bracket tree, reducing rendering times from seconds to <30ms for 128-player brackets.

---

## 4. Design & Aesthetics
- **Theme**: Dark Mode (Slate-950/900) with high-vibrancy accents (Amber for trophies/primary, Emerald for success/live).
- **Visual Style**: Glassmorphism (backdrop-blur), rounded corners (3xl/2xl), and subtle spring animations for a premium feel.
- **Typography**: 'Outfit' font family for a modern, athletic look.
- **Guardrail**: No native browser alerts. All feedback uses custom themed modals (`AlertModal`, `ConfirmModal`).

---

## 5. Database Schema (Mongoose)
- **Player**: Profile ID, Full Name (Note: Gender is **not** tracked).
- **Category**: Tournament categories (e.g., "Men's Singles").
- **Participation**: Maps players to categories (supports doubles).
- **TournamentMatch**: Core tournament structure (Round, Seed, Status, Team IDs).
- **Match**: The "Live" instance of a match being scored (Scores, Game History, Umpire Locks).
- **Court**: Court status, active/upcoming match IDs.
- **RoundRobinStanding**: Calculated standings per player/category.
- **TournamentResult**: Finalized podium data.

---

## 6. Implementation Timeline & Major Phases

### Phase 1: Foundation & Scoring Engine
- **Objective**: Create the live scoring logic and umpire UI.
- **Key Logic**: Implementing the point-by-point state machine and WebSockets.

### Phase 2: Tournament Brackets (Knockout)
- **Objective**: Automate bracket generation and visualization.
- **Key Logic**: Seeded pairing and the "Connector Line" algorithm for tree visualization.

### Phase 3: Round Robin & Standings
- **Objective**: Support league-style tournaments.
- **Key Logic**: Cross-table generation and real-time standing calculations (G/PD/Points).

### Phase 4: Hardening & UI Polish (Current)
- **Objective**: Finalize UX and data integrity.
- **Key Logic**: Custom modal system, scrollbar jump fixes, Fast Fetching optimizations, and result gating.

---

## 7. Operational Guardrails
- **Scrollbar Stability**: Use `overflow-y: scroll !important` and `scrollbar-gutter: stable` on root.
- **Component Reusability**: Use `BracketCard` for all match displays across views.
- **Real-time Sync**: Always trigger `io.emit('scheduler_update')` on backend data mutations.
- **Mobile First**: All umpire-facing modals must be tested for viewport height (`96vh` limit).
- **Navigation Stability**: Use fixed-width grids for tab bars to prevent horizontal shifting.

---

**Last Updated**: 2026-05-01
