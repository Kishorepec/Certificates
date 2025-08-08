require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// AWS S3 SDK v3
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const readline = require('readline');

// Cohere AI
const { CohereClientV2 } = require('cohere-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static (optional)
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

// Multer (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Cohere client
const cohere = new CohereClientV2({ token: process.env.COHERE_API_KEY || '' });

// In-memory LRU-ish cache for logs
const MAX_CACHE_ITEMS = 8;
const logCache = new Map(); // key -> string

function setCache(key, value) {
  if (logCache.has(key)) logCache.delete(key);
  logCache.set(key, value);
  while (logCache.size > MAX_CACHE_ITEMS) {
    const firstKey = logCache.keys().next().value;
    logCache.delete(firstKey);
  }
}

function getCache(key) {
  if (!logCache.has(key)) return undefined;
  const value = logCache.get(key);
  // refresh recency
  logCache.delete(key);
  logCache.set(key, value);
  return value;
}

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/upload', upload.single('logfile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const original = req.file.originalname || 'log.log';
    const ext = path.extname(original) || '.log';
    const base = path.basename(original, ext).replace(/[^a-zA-Z0-9-_\.]/g, '_');
    const key = `${base}-${uuidv4()}${ext}`;

    const uploadParams = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || 'text/plain'
    };

    await s3.send(new PutObjectCommand(uploadParams));
    res.redirect(`/analyze?file=${encodeURIComponent(key)}`);
  } catch (error) {
    console.error('S3 Upload Error:', error);
    res.status(500).send('Failed to upload to S3');
  }
});

app.get('/files', async (req, res) => {
  try {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET
    }));

    const files = (response.Contents || []).map(o => o.Key).sort();
    res.render('files', { files });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).send('Failed to list files.');
  }
});

app.get('/analyze', async (req, res) => {
  const fileKey = req.query.file;
  if (!fileKey) return res.status(400).send('No file specified.');

  try {
    const s3Response = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: fileKey
    }));

    const stream = s3Response.Body;

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let total = 0;
    let errors = 0;
    const ipMap = {};
    const urlMap = {};
    const statusMap = {};

    let logText = '';

    for await (const line of rl) {
      logText += line + '\n';
      total++;

      const ipMatch = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
      const methodPathMatch = line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) ([^ ]+)/);
      const statusMatch = line.match(/" (\d{3})/);

      const ip = ipMatch?.[1];
      const urlPath = methodPathMatch?.[2];
      const status = statusMatch?.[1];

      if (ip) ipMap[ip] = (ipMap[ip] || 0) + 1;
      if (urlPath) urlMap[urlPath] = (urlMap[urlPath] || 0) + 1;
      if (status) {
        statusMap[status] = (statusMap[status] || 0) + 1;
        if (status.startsWith('4') || status.startsWith('5')) errors++;
      }
    }

    const topIP = Object.entries(ipMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topURL = Object.entries(urlMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    setCache(fileKey, logText);

    const statusLabels = Object.keys(statusMap);
    const statusCounts = Object.values(statusMap);

    res.render('report', {
      total,
      errors,
      topIP,
      topURL,
      statusLabels,
      statusCounts,
      logText,
      logId: fileKey,
      summary: `Requests: ${total}. Errors: ${errors}. Top IP: ${topIP}. Top URL: ${topURL}.`
    });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).send('Failed to analyze file.');
  }
});

app.get('/logs/:key/raw', async (req, res) => {
  const key = req.params.key;
  try {
    const cached = getCache(key);
    if (cached) {
      res.type('text/plain').send(cached);
      return;
    }
    const s3Response = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    res.type('text/plain');
    s3Response.Body.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(404).send('Log not found');
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { logId, query } = req.body || {};
    if (!logId || !query) return res.status(400).json({ answer: 'Missing logId or query' });

    let context = getCache(logId);
    if (!context) {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: logId }));
        const rl = readline.createInterface({ input: obj.Body, crlfDelay: Infinity });
        let text = '';
        for await (const line of rl) text += line + '\n';
        context = text;
        setCache(logId, text);
      } catch (e) {
        return res.status(404).json({ answer: 'Log not found.' });
      }
    }

    const maxContext = 4000;
    const promptContext = context.length > maxContext ? context.slice(0, maxContext) : context;

    const response = await cohere.chat({
      model: process.env.COHERE_MODEL || 'command-r',
      messages: [
        { role: 'system', content: 'You are an expert log analysis assistant. Provide brief, actionable answers with specific paths, IPs, and counts when relevant.' },
        { role: 'user', content: `Here is a server log snippet (truncated if long):\n\n${promptContext}\n\nQuestion: ${query}` }
      ]
    });

    const answer = response?.text || response?.message?.content?.[0]?.text || 'No response';
    res.json({ answer });
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ answer: 'AI error.' });
  }
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});