# Troubleshooting

[← Back to README](../README.md)

Common issues and their solutions.

## Gmail API Issues

### Error: "redirect_uri_mismatch"

**Cause:** OAuth redirect URI not configured correctly

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add: `http://localhost:3000`
5. Click **Save**
6. Delete `token.json` and try again

### Error: "invalid_grant" or "Token has been expired or revoked"

**Cause:** OAuth token expired or revoked

**Solution:**
```bash
# Delete the token and re-authenticate
rm token.json
dotenvx run -- pnpm scan:emails
```

### Error: "User rate limit exceeded"

**Cause:** Too many API requests

**Solution:**
- Reduce `maxResults` in email query
- Add delays between batch operations
- Check Gmail API quota in Google Cloud Console
- Wait before retrying

## Ollama Issues

### Error: "Ollama is not available"

**Cause:** Ollama server not running

**Solution:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Verify model is installed
ollama list

# Pull model if missing
ollama pull llama3.2
```

### Error: "model not found"

**Cause:** Required model not installed

**Solution:**
```bash
# Pull the language model
ollama pull llama3.2

# Pull the embedding model
ollama pull nomic-embed-text

# Verify installation
ollama list
```

### Slow Ollama Response

**Cause:** Large model or insufficient resources

**Solution:**
- Use a smaller model (llama3.2 instead of llama3.1)
- Close other applications
- Check system resources (CPU, RAM)
- Consider GPU acceleration if available

## Database Issues

### Error: "connection refused" (PostgreSQL)

**Cause:** PostgreSQL not running

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps

# Start PostgreSQL
docker-compose up -d

# Or if running locally
systemctl status postgresql
sudo systemctl start postgresql
```

### Error: "database does not exist"

**Cause:** Database not created

**Solution:**
```bash
# Create database
docker-compose exec postgres createdb -U jobseeker jobseeker

# Or via psql
psql -U postgres -c "CREATE DATABASE jobseeker;"

# Run migrations
./migrations-pg/migrate.sh
```

### Error: "pgvector extension not found"

**Cause:** pgvector extension not installed

**Solution:**
```bash
# Install extension
docker-compose exec postgres psql -U jobseeker -d jobseeker -c "CREATE EXTENSION vector;"

# Or restart containers (docker-compose.yml includes extension)
docker-compose down
docker-compose up -d
```

### Migration Errors

**Issue:** Migration fails or gets stuck

**Solution:**
```bash
# Check applied migrations
psql -d jobseeker -c "SELECT * FROM migrations ORDER BY applied_at;"

# Manually mark migration as applied (if needed)
psql -d jobseeker -c "INSERT INTO migrations (filename) VALUES ('012_migration.sql');"

# Or reset database (caution: deletes all data)
# Via API: POST http://localhost:3001/api/reset
```

## Redis Issues

### Error: "Redis connection refused"

**Cause:** Redis not running

**Solution:**
```bash
# Check if Redis is running
redis-cli ping  # Should return PONG

# Start Redis
docker-compose up -d redis

# Or if running locally
sudo systemctl start redis
```

### Queue Jobs Not Processing

**Cause:** Worker not running

**Solution:**
```bash
# Start the worker
pnpm worker

# Or start all services
pnpm dev

# Check queue status
curl http://localhost:3001/api/queue/status
```

## Application Issues

### Tests Failing

**Issue:** Tests fail when running `pnpm test`

**Solution:**
```bash
# Clear test cache
rm -rf node_modules/.vitest

# Reinstall dependencies
pnpm install

# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test src/__tests__/email-scanner.test.ts
```

### TypeScript Compilation Errors

**Issue:** Code doesn't compile

**Solution:**
```bash
# Check all type errors
pnpm build

# Update TypeScript
pnpm add -D typescript@latest

# Clean build
rm -rf dist/
pnpm build
```

### Port Already in Use

**Error:** "Port 3001 is already in use"

**Solution:**
```bash
# Find process using port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3002 pnpm serve
```

### WebSocket Not Connecting

**Issue:** Real-time updates not working

**Solution:**
1. Check browser console for errors
2. Verify server is running: `curl http://localhost:3001/health`
3. Check firewall settings
4. Try a different browser
5. Clear browser cache

### Hot-Reload Not Working

**Issue:** Frontend doesn't reload on changes

**Solution:**
```bash
# Ensure development mode
NODE_ENV=development pnpm serve:dev

# Check file watching (macOS)
# Increase file watch limit if needed
ulimit -n 10240

# Restart server
# Hot-reload only works in dev mode
```

## Performance Issues

### Slow Email Scanning

**Issue:** Email scanning takes too long

**Solution:**
- Reduce `maxResults` to scan fewer emails
- Use more specific Gmail queries
- Skip already-scanned emails (automatic)
- Run during off-peak hours

### Slow Job Processing

**Issue:** Job description fetching is slow

**Solution:**
- Reduce rate limiting delay (careful with servers)
- Process in smaller batches
- Use `FETCH_DESCRIPTIONS=false` to skip descriptions
- Run worker on more powerful hardware

### High Memory Usage

**Issue:** Application uses too much memory

**Solution:**
- Process in smaller batches
- Restart worker periodically
- Check for memory leaks with profiler
- Increase system swap space
- Use smaller Ollama model

## Common Workflow Issues

### No Jobs Extracted

**Issue:** `scan:jobs` doesn't find any jobs

**Possible causes:**
1. No high-confidence emails in database
2. Email bodies don't contain job URLs
3. URL patterns not recognized

**Solution:**
```bash
# Check high-confidence emails
psql -d jobseeker -c "SELECT COUNT(*) FROM emails WHERE confidence='high';"

# Check email bodies
psql -d jobseeker -c "SELECT id, subject FROM emails WHERE body IS NOT NULL LIMIT 5;"

# Run email scan first
dotenvx run -- pnpm scan:emails
```

### Jobs Not Being Blacklisted

**Issue:** Blacklist keywords not working

**Possible causes:**
1. Worker not running (embeddings not generated)
2. Similarity threshold too high
3. Keywords too specific

**Solution:**
```bash
# Check MIN_SIMILARITY in .env (try 0.5 or 0.6)
echo "MIN_SIMILARITY=0.6" >> .env

# Ensure worker is running
pnpm worker

# Check blacklist embeddings
psql -d jobseeker -c "SELECT COUNT(*) FROM blacklist_embeddings;"

# Use broader keywords
# Instead of "Junior Support Engineer"
# Try "Support" or "Junior"
```

### Embeddings Not Generated

**Issue:** Semantic search doesn't work

**Solution:**
```bash
# Ensure Ollama has embedding model
ollama pull nomic-embed-text

# Start worker
pnpm worker

# Trigger embedding generation
curl -X POST http://localhost:3001/api/embeddings/generate

# Check progress
curl http://localhost:3001/api/queue/status
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs**
   ```bash
   # Application logs
   psql -d jobseeker -c "SELECT * FROM logs WHERE level='error' ORDER BY created_at DESC LIMIT 10;"
   
   # Docker logs
   docker-compose logs
   ```

2. **Enable debug output**
   ```bash
   DEBUG=* dotenvx run -- pnpm scan:emails
   ```

3. **Create an issue** on GitHub with:
   - Description of the problem
   - Steps to reproduce
   - Error messages
   - System information (OS, Node version, etc.)
   - Relevant logs

## See Also

- [Setup Guide →](SETUP.md) - Initial setup
- [Usage Guide →](USAGE.md) - Command reference
- [Development →](DEVELOPMENT.md) - Debugging tips
