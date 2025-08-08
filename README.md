# Logalyze

Upload server logs to S3, analyze basic metrics, and ask AI questions about the log.

## Setup

1. Copy env

```bash
cp .env.example .env
# edit .env with your AWS and Cohere credentials
```

2. Install deps

```bash
npm install
```

3. Run

```bash
npm start
```

Open http://localhost:3000

## Notes
- Uses AWS SDK v3 and streams S3 objects for parsing
- Caches recent logs in-memory to speed up AI queries
- EJS views: `views/index.ejs`, `views/files.ejs`, `views/report.ejs`