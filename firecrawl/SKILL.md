---
name: firecrawl
description: "Web search, scrape, crawl, map, browse, and agent via Firecrawl CLI. Use when: (1) searching the web, (2) scraping a URL to extract content, (3) crawling a site for docs or structure, (4) discovering URLs on a site, (5) browser automation, (6) AI-powered web research. NOT for: when no FIRECRAWL_API_KEY is configured."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔥",
        "requires": { "bins": ["firecrawl"], "env": ["FIRECRAWL_API_KEY"] },
      },
  }
---

# Firecrawl Skill

Search the web, scrape pages to markdown, crawl sites, discover URLs, automate browsers, and run AI research agents using the [Firecrawl CLI](https://docs.firecrawl.dev/sdks/cli).

## When to Use

- Searching for information on the web
- Extracting content from a URL
- Scraping a page to markdown for analysis
- Crawling a site to understand its structure or gather docs
- Discovering all URLs on a site (map)
- Browser automation with cloud Chromium sessions
- AI-powered web research with natural language prompts
- Getting clean content from JS-heavy or bot-protected pages

## Requirements

- `FIRECRAWL_API_KEY` env var
- `firecrawl` CLI installed (`npm install -g firecrawl-cli`)

## Authentication

```bash
# Interactive login (opens browser)
firecrawl login --browser

# Login with API key directly
firecrawl login --api-key fc-YOUR-API-KEY

# Or set via environment variable
export FIRECRAWL_API_KEY=fc-YOUR-API-KEY

# Check status (auth, credits, concurrency)
firecrawl --status

# View config
firecrawl view-config
```

## Commands

### Scrape

Scrape a single URL. Default output is markdown.

```bash
# Scrape a URL (shorthand — just pass a URL)
firecrawl https://example.com

# Recommended: clean output without nav/footer
firecrawl https://example.com --only-main-content

# Get HTML output
firecrawl https://example.com --html

# Multiple formats (returns JSON)
firecrawl https://example.com --format markdown,links

# Other formats: html, rawHtml, links, screenshot, json, images, summary, changeTracking, attributes, branding
firecrawl https://example.com --format images
firecrawl https://example.com --format summary

# Wait for JS rendering
firecrawl https://example.com --wait-for 3000

# Include/exclude specific HTML tags
firecrawl https://example.com --include-tags article,main
firecrawl https://example.com --exclude-tags nav,footer

# Save output to file
firecrawl https://example.com -o output.md

# Take a screenshot
firecrawl https://example.com --screenshot

# Show request timing
firecrawl https://example.com --timing
```

**Scrape Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--format <formats>` | `-f` | Output formats (comma-separated) |
| `--html` | `-H` | Shortcut for `--format html` |
| `--only-main-content` | | Extract only main content |
| `--wait-for <ms>` | | Wait time in ms for JS rendering |
| `--screenshot` | | Take a screenshot |
| `--include-tags <tags>` | | HTML tags to include |
| `--exclude-tags <tags>` | | HTML tags to exclude |
| `--output <path>` | `-o` | Save output to file |
| `--json` | | Force JSON output |
| `--pretty` | | Pretty print JSON |
| `--timing` | | Show request timing |

### Search

Search the web and optionally scrape the results.

```bash
# Search the web
firecrawl search "your query" --limit 5

# Search specific sources
firecrawl search "AI" --sources web,news,images

# Filter by category
firecrawl search "react hooks" --categories github
firecrawl search "machine learning" --categories research,pdf

# Time-based filtering
firecrawl search "tech news" --tbs qdr:h   # Last hour
firecrawl search "tech news" --tbs qdr:d   # Last day
firecrawl search "tech news" --tbs qdr:w   # Last week
firecrawl search "tech news" --tbs qdr:m   # Last month
firecrawl search "tech news" --tbs qdr:y   # Last year

# Location-based search
firecrawl search "restaurants" --location "Berlin,Germany" --country DE

# Search and scrape results
firecrawl search "documentation" --scrape --scrape-formats markdown

# Save to file
firecrawl search "firecrawl" --pretty -o results.json
```

**Search Options:**

| Option | Description |
|--------|-------------|
| `--limit <number>` | Max results (default: 5, max: 100) |
| `--sources <sources>` | Sources: `web`, `images`, `news` |
| `--categories <categories>` | Filter: `github`, `research`, `pdf` |
| `--tbs <value>` | Time: `qdr:h`, `qdr:d`, `qdr:w`, `qdr:m`, `qdr:y` |
| `--location <location>` | Geo-targeting (e.g., "Berlin,Germany") |
| `--country <code>` | ISO country code (default: US) |
| `--scrape` | Scrape search results |
| `--scrape-formats <formats>` | Formats for scraped content (default: markdown) |
| `--only-main-content` | Main content only when scraping (default: true) |
| `--output <path>` | Save to file |
| `--pretty` | Pretty print JSON |

### Map

Discover all URLs on a website quickly.

```bash
# Discover all URLs
firecrawl map https://example.com

# Limit number of URLs
firecrawl map https://example.com --limit 500

# Filter URLs by search query
firecrawl map https://example.com --search "blog"

# Include subdomains
firecrawl map https://example.com --include-subdomains

# Control sitemap usage
firecrawl map https://example.com --sitemap include   # Use sitemap
firecrawl map https://example.com --sitemap skip      # Skip sitemap
firecrawl map https://example.com --sitemap only      # Only use sitemap

# Save to file
firecrawl map https://example.com -o urls.txt
firecrawl map https://example.com --json --pretty -o urls.json
```

**Map Options:**

| Option | Description |
|--------|-------------|
| `--limit <number>` | Maximum URLs to discover |
| `--search <query>` | Filter URLs by search query |
| `--sitemap <mode>` | `include`, `skip`, or `only` |
| `--include-subdomains` | Include subdomains |
| `--ignore-query-parameters` | Treat URLs with different params as same |
| `--wait` | Wait for map to complete |
| `--timeout <seconds>` | Timeout in seconds |
| `--output <path>` | Save to file |
| `--json` | Output as JSON |

### Crawl

Crawl an entire website starting from a URL.

```bash
# Start a crawl (returns job ID immediately)
firecrawl crawl https://example.com

# Wait for crawl to complete with progress
firecrawl crawl https://example.com --wait --progress

# Limit depth and pages
firecrawl crawl https://example.com --limit 100 --max-depth 3 --wait

# Include/exclude specific paths
firecrawl crawl https://example.com --include-paths /blog,/docs --wait
firecrawl crawl https://example.com --exclude-paths /admin,/login --wait

# Rate limiting
firecrawl crawl https://example.com --delay 1000 --max-concurrency 2 --wait

# Check crawl status using job ID
firecrawl crawl <job-id>

# Save results
firecrawl crawl https://example.com --wait --pretty -o results.json
```

**Crawl Options:**

| Option | Description |
|--------|-------------|
| `--wait` | Wait for crawl to complete |
| `--progress` | Show progress indicator |
| `--limit <number>` | Maximum pages to crawl |
| `--max-depth <number>` | Maximum crawl depth |
| `--include-paths <paths>` | Paths to include (comma-separated) |
| `--exclude-paths <paths>` | Paths to exclude (comma-separated) |
| `--sitemap <mode>` | `include`, `skip`, or `only` |
| `--allow-subdomains` | Include subdomains |
| `--allow-external-links` | Follow external links |
| `--crawl-entire-domain` | Crawl entire domain |
| `--delay <ms>` | Delay between requests |
| `--max-concurrency <n>` | Max concurrent requests |
| `--poll-interval <seconds>` | Polling interval (default: 5) |
| `--timeout <seconds>` | Timeout when waiting |
| `--output <path>` | Save to file |

### Browser

Launch cloud browser sessions and execute code remotely. Each session runs a full Chromium instance — no local browser needed.

```bash
# Launch a session
firecrawl browser launch-session

# Agent-browser commands (default — recommended for AI agents)
firecrawl browser execute "open https://example.com"
firecrawl browser execute "snapshot"
firecrawl browser execute "click @e5"
firecrawl browser execute "fill @e3 'search query'"
firecrawl browser execute "scrape"

# Playwright Python
firecrawl browser execute --python 'await page.goto("https://example.com")
print(await page.title())'

# Playwright JavaScript
firecrawl browser execute --node 'await page.goto("https://example.com"); console.log(await page.title());'

# Launch with custom TTL and live view
firecrawl browser launch-session --ttl 600 --stream

# List sessions
firecrawl browser list
firecrawl browser list active --json

# Close the active session
firecrawl browser close
```

**Browser Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `launch-session` | Launch a new cloud browser session |
| `execute <code>` | Execute agent-browser, Python, JS, or bash in a session |
| `list [status]` | List sessions (filter by `active` or `destroyed`) |
| `close` | Close a browser session |

**Execute Options:** `--bash` (default), `--python`, `--node`, `--session <id>`, `-o <path>`

**Launch Options:** `--ttl <seconds>`, `--ttl-inactivity <seconds>`, `--profile <name>`, `--stream`

### Agent

Search and gather data from the web using natural language prompts.

```bash
# Basic usage — URLs are optional
firecrawl agent "Find the top 5 AI startups and their funding amounts" --wait

# Focus on specific URLs
firecrawl agent "Compare pricing plans" --urls https://slack.com/pricing,https://teams.microsoft.com/pricing --wait

# Structured output with schema
firecrawl agent "Get company information" --urls https://example.com --schema '{"name": "string", "founded": "number"}' --wait

# Schema from file
firecrawl agent "Get product details" --urls https://example.com --schema-file schema.json --wait

# Higher accuracy model
firecrawl agent "Competitive analysis" --model spark-1-pro --wait

# Limit costs
firecrawl agent "Gather contact info" --max-credits 100 --wait

# Check status of existing job
firecrawl agent <job-id> --status
```

**Agent Options:**

| Option | Description |
|--------|-------------|
| `--urls <urls>` | URLs to focus on (comma-separated) |
| `--model <model>` | `spark-1-mini` (default, cheaper) or `spark-1-pro` (higher accuracy) |
| `--schema <json>` | JSON schema for structured output |
| `--schema-file <path>` | Path to JSON schema file |
| `--max-credits <number>` | Maximum credits to spend |
| `--wait` | Wait for completion |
| `--poll-interval <seconds>` | Polling interval (default: 5) |
| `--timeout <seconds>` | Timeout |
| `--output <path>` | Save to file |

### Other

```bash
# Check credit usage
firecrawl credit-usage
firecrawl credit-usage --json --pretty

# Version
firecrawl version
```

## Global Options

| Option | Short | Description |
|--------|-------|-------------|
| `--status` | | Show version, auth, concurrency, credits |
| `--api-key <key>` | `-k` | Override API key for this command |
| `--api-url <url>` | | Custom API URL (self-hosted/local) |
| `--help` | `-h` | Show help |
| `--version` | `-V` | Show version |

## Tips

- **Scrape** is fastest for single pages — use it when you have a URL
- **Search** is best for discovering URLs you don't have yet
- **Map** is for discovering all URLs on a site quickly
- **Crawl** burns more API credits — use sparingly with low limits
- **Agent** is best for complex research tasks across multiple pages
- **Browser** is for interactive automation that needs clicks/forms
- Use `--only-main-content` on scrape for cleaner output
- Single format outputs raw content; multiple formats output JSON
- Output goes to stdout — pipe to `jq`, `head`, or redirect to files
- Use `--pretty` for human-readable JSON
