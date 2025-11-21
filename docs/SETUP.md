# Setup Guide

[← Back to README](../README.md)

Complete installation and configuration guide for Job Seeker.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** v18 or higher
- **pnpm** v10.22.0 (automatically enforced by packageManager field)
- **PostgreSQL** 14+ with pgvector extension
- **Redis** for background job processing
- **Ollama** installed and running locally
- **Google Cloud Project** with Gmail API enabled

## Installation Steps

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# PostgreSQL Configuration
PGHOST=localhost
PGPORT=5432
PGDATABASE=jobseeker
PGUSER=jobseeker
PGPASSWORD=your_secure_password

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434

# Application Configuration
MIN_SIMILARITY=0.6  # Blacklist similarity threshold (0.0-1.0)
FETCH_DESCRIPTIONS=true  # Auto-fetch job descriptions
NODE_ENV=development  # or production
```

### 3. Start PostgreSQL and Redis

Using Docker Compose (recommended):

```bash
docker-compose up -d
```

This starts:
- PostgreSQL 15 with pgvector extension
- Redis 7 for queue management

**Manual installation** (if you prefer local installations):

PostgreSQL:
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt install postgresql-15 postgresql-contrib
sudo systemctl start postgresql

# Enable pgvector extension
psql -d postgres -c "CREATE EXTENSION vector;"
```

Redis:
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### 4. Initialize the Database

Run the PostgreSQL migration script:

```bash
./migrations-pg/migrate.sh
```

This creates the database schema with tables for:
- emails (with pgvector embeddings)
- jobs (with salary, description)
- platforms (crawlability management)
- blacklist (keyword filtering)
- logs (centralized logging)
- migrations (migration tracking)

See [Database Guide →](DATABASE.md) for schema details.

### 5. Set Up Google Cloud Credentials {#google-oauth-setup}

#### Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Gmail API"
   - Click **Enable**

#### Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Configure the OAuth consent screen if prompted:
   - User Type: **External** (for personal use)
   - Add your email as a test user
4. Choose **Desktop app** as the application type
5. **IMPORTANT**: Add `http://localhost:3000` as an authorized redirect URI
6. Download the credentials JSON file
7. Save it as `credentials.json` in the project root

**Example credentials.json structure:**
```json
{
  "installed": {
    "client_id": "your-client-id.apps.googleusercontent.com",
    "project_id": "your-project",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "your-client-secret",
    "redirect_uris": ["http://localhost:3000"]
  }
}
```

**Note**: If you get redirect URI errors, make sure `http://localhost:3000` is listed in your OAuth client's authorized redirect URIs.

### 6. Install and Configure Ollama

#### Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Or download from:** [ollama.com](https://ollama.com/)

#### Pull Required Models

```bash
# Language model for AI operations (choose one)
ollama pull llama3.2     # Recommended: 3B params, fast
ollama pull llama3.1     # Alternative: 8B params, more accurate
ollama pull mistral      # Alternative: 7B params, good balance
ollama pull phi3         # Alternative: 3.8B params, lightweight

# Embedding model for semantic search (required)
ollama pull nomic-embed-text
```

#### Start Ollama Server

```bash
ollama serve
```

The application will automatically detect and use the best available model.

**Verify installation:**
```bash
curl http://localhost:11434/api/tags
```

### 7. Install Git Hooks (Optional but Recommended)

Install the pre-commit hook to automatically run tests before each commit:

```bash
./hooks/install.sh
```

This installs a pre-commit hook that:
- ✅ Automatically runs all tests before every commit
- ✅ Blocks commits if any tests fail
- ✅ Ensures code quality
- ✅ Shows test output in real-time

**Manual installation** (if script fails):
```bash
cp hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**To bypass the hook** (use sparingly):
```bash
git commit --no-verify
```

## Verification

Verify your setup:

```bash
# 1. Check PostgreSQL connection
psql -d jobseeker -c "SELECT version();"

# 2. Check Redis connection
redis-cli ping

# 3. Check Ollama
curl http://localhost:11434/api/tags

# 4. Run tests
pnpm test

# 5. Start the application
pnpm dev
```

If all checks pass, you're ready to use Job Seeker!

## Next Steps

- [Usage Guide →](USAGE.md) - Learn the workflows
- [Database Guide →](DATABASE.md) - Explore the schema
- [Troubleshooting →](TROUBLESHOOTING.md) - Fix common issues

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PGHOST` | `localhost` | PostgreSQL host |
| `PGPORT` | `5432` | PostgreSQL port |
| `PGDATABASE` | `jobseeker` | Database name |
| `PGUSER` | `jobseeker` | Database user |
| `PGPASSWORD` | - | Database password (required) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `MIN_SIMILARITY` | `0.6` | Blacklist similarity threshold (0.0-1.0) |
| `FETCH_DESCRIPTIONS` | `true` | Auto-fetch job descriptions |
| `NODE_ENV` | `development` | Environment (development/production) |

## Security Notes

- `credentials.json` and `token.json` are git-ignored for security
- Never commit these files to version control
- Keep your OAuth credentials secure and private
- All LLM processing happens locally via Ollama
- Email content is only analyzed locally and never sent to external services
- Database credentials should be strong and unique
