# Multiplayer Tic-Tac-Toe with Nakama Backend

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with **React** (frontend) and **Nakama** (backend). Features real-time matchmaking, leaderboards, timed game mode, and concurrent game support.

## 🎮 Features

| Feature | Description |
|---|---|
| **Server-Authoritative** | All game logic runs on the Nakama server — move validation, win detection, state management |
| **Real-time Matchmaking** | Auto-pairs players using Nakama's matchmaker with mode-based filtering |
| **Leaderboard** | Global ranking with W/L/D stats, win streaks, and score tracking |
| **Timer Mode** | 30-second turn timer with auto-forfeit on timeout |
| **Concurrent Games** | Multiple isolated game sessions running simultaneously |
| **Disconnection Handling** | Auto-forfeit when a player disconnects mid-game |
| **Responsive UI** | Mobile-first design with dark theme, animations, and glassmorphism |

## 🏗️ Architecture

```
┌─────────────────┐        WebSocket         ┌───────────────────┐
│  React Frontend │◄───────────────────────►│   Nakama Server    │
│  (Vite + TS)    │        REST API          │   (Docker)         │
│                 │◄───────────────────────►│                    │
│ • NicknameScreen│                          │ • Match Handlers   │
│ • MatchmakingUI │                          │ • Game Logic       │
│ • GameBoard     │                          │ • Leaderboard      │
│ • ResultScreen  │                          │ • Matchmaking      │
└─────────────────┘                          └────────┬──────────┘
                                                      │
                                               ┌──────┴───────┐
                                               │  PostgreSQL   │
                                               └──────────────┘
```

### Design Decisions

| Decision | Rationale |
|---|---|
| Server-authoritative model | Prevents cheating — clients only send move positions, server validates everything |
| Device authentication | Zero-friction onboarding — no registration forms needed |
| OpCode-based protocol | Clean message types: MOVE(1), STATE_UPDATE(2), GAME_OVER(3), TIMER_SYNC(4), etc. |
| Docker Compose | Standard Nakama deployment — reproducible across dev/staging/prod |
| Vite + React + TypeScript | Fast dev experience, type safety, modern tooling |
| Rollup bundling (server) | Nakama requires single JS file; Rollup bundles all TS modules into ES5 |

### OpCode Protocol

| OpCode | Direction | Description |
|---|---|---|
| 1 (MOVE) | Client → Server | `{ position: 0-8 }` |
| 2 (STATE_UPDATE) | Server → Client | Board state + current turn after validated move |
| 3 (GAME_OVER) | Server → Client | Winner, reason, winning line |
| 4 (TIMER_SYNC) | Server → Client | Remaining time for current turn |
| 5 (GAME_START) | Server → Client | Player assignments, initial board |
| 6 (ERROR) | Server → Client | Validation error message |
| 7 (OPPONENT_LEFT) | Server → Client | Opponent disconnected |

## 📋 Prerequisites

- **Docker Desktop** (for running Nakama + PostgreSQL)
- **Node.js** v18+ (for frontend development)
- **npm** v9+

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Lila_Games_Tic_Tac_Toe
```

### 2. Start Nakama Server

```bash
docker compose up --build -d
```

This starts:
- **PostgreSQL** on port 5432
- **Nakama Server** on ports 7349 (gRPC), 7350 (HTTP/WebSocket), 7351 (Console)

Verify the server is running:
- Nakama Console: http://localhost:7351 (admin/password)
- Health check: http://localhost:7350/healthcheck

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

### 4. Play!

1. Open **two browser tabs** at http://localhost:5173
2. Enter a nickname in each tab
3. Select game mode (Classic or Timed)
4. Click "Continue" — both players will be matched automatically
5. Play! The server validates all moves in real-time

## 🧪 Testing Multiplayer

### Two-Player Flow
1. Open two incognito/different browser windows
2. Enter different nicknames
3. Both select the same game mode
4. They'll be matched automatically

### Timer Mode
1. Select "Timed (30s)" mode
2. Each turn has a 30-second countdown
3. If time runs out, the player forfeits

### Disconnection
1. Start a game between two players
2. Close one browser tab
3. The remaining player wins by forfeit

### Concurrent Games
1. Open 4+ browser tabs
2. Create 2+ simultaneous matches
3. Each match is fully isolated

### Leaderboard
1. Play several games
2. Check the result screen for updated rankings
3. W/L/D stats and scores are tracked persistently

## ☁️ AWS Deployment

### Prerequisites
- AWS account with EC2 or ECS access
- Domain name (optional, for HTTPS)

### Option A: EC2 Deployment

```bash
# 1. Launch an EC2 instance (Ubuntu 22.04, t3.medium recommended)
# 2. Install Docker and Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER

# 3. Clone the repository
git clone <repository-url>
cd Lila_Games_Tic_Tac_Toe

# 4. Update docker-compose.yml for production
# - Change POSTGRES_PASSWORD to a secure value
# - Add restart policies

# 5. Start services
docker compose up --build -d

# 6. Configure security group
# - Open ports 7350 (Nakama API), 80/443 (frontend)
```

### Option B: ECS with Fargate

For production-grade deployment, use AWS ECS:

1. **Push Docker images** to Amazon ECR
2. **Create ECS task definitions** for Nakama + PostgreSQL (or use RDS)
3. **Set up ALB** for load balancing with HTTPS
4. **Configure service** with desired count for scaling

### Frontend Deployment

```bash
# Build static files
cd frontend
npm run build

# Deploy to S3 + CloudFront
aws s3 sync dist/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Environment Variables (Frontend)

Create `.env.production` in `frontend/`:
```env
VITE_NAKAMA_HOST=your-nakama-server.example.com
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=true
VITE_NAKAMA_SERVER_KEY=defaultkey
```

## 📁 Project Structure

```
Lila_Games_Tic_Tac_Toe/
├── docker-compose.yml          # Orchestrates Nakama + PostgreSQL
├── README.md
├── nakama-server/
│   ├── Dockerfile              # Multi-stage: compile TS → Nakama image
│   ├── package.json
│   ├── tsconfig.json
│   ├── rollup.config.js
│   ├── local.yml               # Nakama server config
│   └── src/
│       ├── main.ts             # Entry point — registers handlers & RPCs
│       ├── match-handler.ts    # Server-authoritative match logic
│       ├── game-logic.ts       # Board operations, win detection
│       ├── leaderboard.ts      # Score tracking, player stats
│       └── matchmaking.ts      # Matchmaker callback
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── main.tsx            # React entry point
        ├── App.tsx             # Screen router + Nakama event handling
        ├── index.css           # Design system (dark theme, animations)
        ├── lib/
        │   └── nakama.ts       # Nakama client singleton
        └── screens/
            ├── NicknameScreen.tsx
            ├── MatchmakingScreen.tsx
            ├── GameScreen.tsx
            └── ResultScreen.tsx
```

## 🔧 Configuration

### Nakama Server (`nakama-server/local.yml`)
- `runtime.js_entrypoint`: Path to compiled JS module
- `match.*`: Queue sizes for match processing
- `session.token_expiry_sec`: Session duration

### Frontend Environment Variables
| Variable | Default | Description |
|---|---|---|
| `VITE_NAKAMA_HOST` | `127.0.0.1` | Nakama server hostname |
| `VITE_NAKAMA_PORT` | `7350` | Nakama HTTP API port |
| `VITE_NAKAMA_USE_SSL` | `false` | Enable HTTPS/WSS |
| `VITE_NAKAMA_SERVER_KEY` | `defaultkey` | Nakama server key |

## 📄 License

MIT
