# Badminton Tournament Management System 🏸

A comprehensive, full-stack application designed to streamline the management of badminton tournaments. This platform handles everything from player registrations and court assignments to real-time scoring and bracket progression.

## 🚀 Key Features

- **Tournament Dashboard**: A central hub for monitoring tournament progress, court status, and upcoming matches.
- **Real-Time Scoring**: Live match scoring with instant updates across all connected devices using Socket.io.
- **Dynamic Court Management**: Assign matches to specific courts and track court availability in real-time.
- **Round Robin & Brackets**: Support for both Round Robin league stages and Knockout bracket stages.
- **Player Management**: Track player registrations, availability, and match history.
- **Responsive UI**: A premium, modern interface built with React and Vite, optimized for both desktop and tablet use.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Vanilla CSS (for custom, premium styling), Socket.io-client.
- **Backend**: Node.js, Express, Socket.io (real-time signaling).
- **Tooling**: Git for version control.

## 📁 Project Structure

```text
BadmintonScoring/
├── frontend/           # React + Vite application
├── backend/            # Node.js + Express server
├── README.md           # Project documentation
└── .gitignore          # Git exclusion rules
```

## ⚙️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sriharshanadahalli/badminton-platform.git
   cd badminton-platform
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   npm install
   # Create a .env file based on .env.example
   npm start
   ```

3. **Setup Frontend**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

## 🛡️ Project Guardrails

This project follows strict UI/UX standards:
- **Serial Numbering**: All data tables must include a serial number (`S.No`) column for better readability.
- **Consistent Styling**: Use predefined CSS variables for colors, spacing, and typography to maintain a premium look.

---

Developed with ❤️ for the Badminton Community.
