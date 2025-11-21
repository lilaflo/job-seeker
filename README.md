# Job Seeker

An automation tool that scans Gmail for job-related emails, extracts job descriptions, analyzes them against your skills using AI, and marks matching opportunities as important.

## ✨ Features

- ✅ **Gmail OAuth Authentication** - Secure authentication with automatic token refresh
- ✅ **AI-Powered Categorization** - Uses local Ollama LLM with multilingual support
- ✅ **Smart Job Extraction** - Intelligent URL and title extraction from emails
- ✅ **PostgreSQL Database** - Production-ready database with pgvector for semantic search
- ✅ **Web Scraping** - Fetches job descriptions from 15+ platforms
- ✅ **AI Salary Extraction** - Intelligently extracts salary information using Ollama
- ✅ **Vector Search (RAG)** - Semantic job search using embeddings
- ✅ **Real-time WebSocket Updates** - Live progress during scanning
- ✅ **Web Interface** - Browse and search jobs at http://localhost:3001
- ✅ **Background Processing** - Redis + Bull queues for async operations
- ✅ **Comprehensive Tests** - 310+ passing tests with Vitest

See the [full feature list →](docs/FEATURES.md)

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Installation and configuration
- **[Usage Guide](docs/USAGE.md)** - Commands and workflows
- **[Database Guide](docs/DATABASE.md)** - Schema, queries, and migrations
- **[Architecture](docs/ARCHITECTURE.md)** - How it works internally
- **[Development](docs/DEVELOPMENT.md)** - Contributing and testing
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[API Reference](docs/API.md)** - REST API endpoints

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ and **pnpm** v10.22.0
- **Ollama** installed and running locally
- **PostgreSQL** 14+ with pgvector extension
- **Redis** for background job processing
- **Google Cloud Project** with Gmail API enabled

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# 3. Start PostgreSQL and Redis
docker-compose up -d

# 4. Run database migrations
./migrations-pg/migrate.sh

# 5. Set up Gmail OAuth credentials
# See docs/SETUP.md#google-oauth-setup

# 6. Install Ollama models
ollama pull llama3.2
ollama pull nomic-embed-text

# 7. Start the application
pnpm dev
```

### Basic Usage

```bash
# Scan emails and extract jobs
pnpm scan:all

# Start web interface (includes Redis + Worker + Server)
pnpm dev

# Open browser
open http://localhost:3001
```

## 📖 Main Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services (Redis, Worker, Web Server) |
| `pnpm scan:all` | Complete workflow (emails + jobs) |
| `pnpm scan:emails` | Scan and categorize emails only |
| `pnpm scan:jobs` | Extract jobs and fetch descriptions |
| `pnpm test` | Run all unit tests |

See the [full command reference →](docs/USAGE.md)

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Gmail     │────▶│  Email Scan  │────▶│  Database   │
│     API     │     │  + AI Filter │     │ PostgreSQL  │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │ Job Extract  │────▶│   Redis     │
                    │ + Web Scrape │     │   Queue     │
                    └──────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  Ollama LLM  │     │   Worker    │
                    │ (Local AI)   │◀────│  Background │
                    └──────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │   Embeddings │     │ Web Server  │
                    │  (pgvector)  │◀────│   + API     │
                    └──────────────┘     └─────────────┘
```

See the [architecture guide →](docs/ARCHITECTURE.md)

## 🛠️ Technologies

- **TypeScript** - Type-safe JavaScript
- **Node.js** - Runtime environment
- **PostgreSQL + pgvector** - Vector database
- **Redis + Bull** - Job queue
- **Gmail API** - Email access
- **Ollama** - Local LLM inference
- **cheerio** - Web scraping
- **Vitest** - Testing framework

## 📝 Project Structure

```
job-seeker/
├── docs/                    # Documentation
├── migrations-pg/           # PostgreSQL migrations
├── public/                  # Web interface
├── src/
│   ├── __tests__/          # Unit tests (310+ tests)
│   ├── database/           # Database modules (email, job, platform, etc.)
│   ├── jobs/               # Background job processors
│   ├── gmail-auth.ts       # OAuth authentication
│   ├── email-scanner.ts    # Email fetching
│   ├── email-categorizer.ts # AI categorization
│   ├── url-extractor.ts    # Job extraction
│   ├── job-scraper.ts      # Web scraping
│   ├── embeddings.ts       # Vector search
│   ├── server.ts           # Web server
│   └── worker.ts           # Queue worker
├── docker-compose.yml      # PostgreSQL + Redis
└── package.json            # Dependencies
```

## 🤝 Contributing

Contributions welcome! Please see [DEVELOPMENT.md](docs/DEVELOPMENT.md) for guidelines.

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 🔒 Security

- OAuth credentials are git-ignored
- All LLM processing happens locally (Ollama)
- Email content never leaves your machine
- Database credentials stored in `.env` (not committed)

## 📄 License

ISC
