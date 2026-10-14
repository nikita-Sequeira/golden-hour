import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db';
import { apiRouter } from './server/routes';
import { AadhaarScanInputSchema, AadhaarExtractedSchema } from './server/validators';
import { WESTERN_LINE_STATIONS } from './src/data/stations';
 
dotenv.config();
 
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
 
// Trust reverse proxy (e.g. Google Cloud Run / nginx)
app.set('trust proxy', 1);
 
// Initialize persistent SQLite Database on start
initDatabase();
 
// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);
 
// Strict CORS configuration with exact origin allow-list
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        process.env.APP_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ].filter((o): o is string => Boolean(o));
      if (allowedOrigins.some((o) => origin === o)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
 
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
 
// General Rate Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api', generalLimiter);
 
// Auth Rate Limiter: Patient keyed on IP only (60 / 5 min), Staff keyed on IP + username (10 / 5 min)
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: (req) => {
    const role = (req.body as any)?.role;
    if (role === 'patient') return 60;
    return 10;
  },
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip || '127.0.0.1');
    const role = (req.body as any)?.role;
    if (role === 'patient') {
      return `patient:${ip}`;
    }
    const identifier = String((req.body as any)?.username || 'anon').trim().toLowerCase();
    return `staff:${ip}:${identifier}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please wait 5 minutes.' },
});
app.use('/api/auth/login', authLimiter);
 
// OCR requests are expensive, but a person often needs a few attempts to get a
// legible photo. Six requests/minute turned ordinary retries into a permanent-
// looking scanner failure (notably on the seventh tap).
const ocrLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many document scan requests. Please wait a few minutes before trying again.' },
});
 
// Mount modular REST APIs
app.use('/api', apiRouter);
 
// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Golden Hour Emergency Grid',
    database: 'SQLite 3 (Node.js native DatabaseSync)',
    serverTime: new Date().toISOString(),
  });
});
 
function extractBase64Data(raw: string): { mimeType: string; base64: string } {
  if (raw.startsWith('data:')) {
    const parts = raw.split(';base64,');
    const mime = parts[0].replace('data:', '') || 'image/jpeg';
    return { mimeType: mime, base64: parts[1] || '' };
  }
  return { mimeType: 'image/jpeg', base64: raw };
}
 
// POST /api/scan-aadhaar: Real multimodal scanning with strict zero-hallucination policy
app.post('/api/scan-aadhaar', ocrLimiter, async (req, res) => {
  try {
    const parseResult = AadhaarScanInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid image payload.' });
    }
 
    const { mimeType, base64 } = extractBase64Data(parseResult.data.image);
    if (!base64 || base64.length < 50) {
      return res.status(400).json({ success: false, error: 'Invalid or empty image payload.' });
    }
    const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!supportedImageTypes.has(mimeType)) {
      return res.status(400).json({ success: false, error: 'Please upload a JPEG, PNG, or WEBP Aadhaar image.' });
    }
    // Reject malformed data before it is sent to the OCR provider.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return res.status(400).json({ success: false, error: 'The uploaded image data is malformed. Please choose the image again.' });
    }
 
    // Reject images > 3 MB after base64 decode
    const decodedByteLength = Buffer.from(base64, 'base64').byteLength;
    if (decodedByteLength > 3 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: 'Image size exceeds the 3 MB limit. Please upload a smaller image.',
      });
    }
 
    // Lazily instantiate GoogleGenAI client; return 503 if API key is missing
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        success: false,
        error: 'Aadhaar OCR service is currently unavailable (GEMINI_API_KEY is not configured). Please enter details manually.',
      });
    }
 
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
 
    const currentYear = new Date().getFullYear();
 
    const systemPrompt = `You are a high-precision, strict OCR extraction system for Indian Government Aadhaar identity cards.
RULES FOR DATA INTEGRITY - CRITICAL:
1. NEVER invent, fabricate, guess, or estimate any data.
2. If a field is not clearly visible or not printed on the document, you MUST return null for that field. Do NOT provide defaults.
3. NEVER guess blood group. If not printed, return null.
4. NEVER invent a family member or relative. If not printed in "C/O:", "S/O:", "D/O:", "W/O:", return null.
5. If Date of Birth (DOB) is printed, extract it as "DD/MM/YYYY" or "YYYY". Calculate age based on current year ${currentYear}. If DOB is absent, age MUST be null.
6. Mask the 12-digit Aadhaar number to ONLY the last 4 digits in format "XXXX XXXX 1234". NEVER reveal or output the full 12 digits.
7. Map address to the nearest Western Railway station from this list ONLY if the locality or pin code matches: ${WESTERN_LINE_STATIONS.map((s) => `"${s.name}"`).join(', ')}. If unable to map accurately, return null.
 
Return ONLY valid JSON matching this schema:
{
  "isAadhaarDetected": boolean,
  "patientName": string | null,
  "dob": string | null,
  "age": number | null,
  "gender": "Female" | "Male" | "Other" | null,
  "aadhaarNumberMasked": string | null,
  "relativeName": string | null,
  "phone": string | null,
  "bloodType": string | null,
  "address": string | null,
  "nearestStation": string | null
}`;
 
    // Prefer an explicitly configured model, then try current multimodal Flash
    // models. A timeout on one model must not consume the whole scan budget and
    // prevent the remaining candidates from being tried.
    const candidateModels = Array.from(
      new Set(
        [
          process.env.GEMINI_OCR_MODEL?.trim(),
          'gemini-3.8-flash',
          'gemini-3.6-flash',
          'gemini-3.5-flash-lite',
          'gemini-2.5-flash',
        ].filter(Boolean) as string[]
      )
    );
 
    const isTransient = (e: any) => {
      const st = Number(e?.status);
      return !st || [408, 429, 500, 502, 503, 504].includes(st); // no status = network/fetch failure
    };
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastErr: any = null;
    const deadline = Date.now() + 60000;
    const PER_CALL_TIMEOUT_MS = 25000;
    outer: for (const modelName of candidateModels) {
      if (Date.now() > deadline) break;
      try {
        const remaining = deadline - Date.now();
        if (remaining < 3000) break outer;
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } },
                { text: systemPrompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0,
            maxOutputTokens: 2048,
            abortSignal: AbortSignal.timeout(Math.min(PER_CALL_TIMEOUT_MS, remaining)),
          },
        });
        console.log(`Aadhaar scan used model: ${modelName}`);
        break outer;
      } catch (e: any) {
        lastErr = e;
        console.error(`Model "${modelName}" failed:`, e?.status, String(e?.message || e).slice(0, 400));
        // Model-unavailable and transient failures should fall through to the
        // next candidate immediately; validation/auth failures should surface.
        if (!isTransient(e) && Number(e?.status) !== 404) throw e;
      }
    }
    if (!response) throw lastErr;
 
    const text = response.text?.trim() || '';
    if (!text) {
      const reason = response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason || 'unknown';
      throw new Error(`No response received from OCR vision model (reason: ${reason})`);
    }
 
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      parsedJson = JSON.parse(cleaned);
    }
    // Some responses wrap the object in an array
    if (Array.isArray(parsedJson)) parsedJson = parsedJson[0];
 
    const validatedData = AadhaarExtractedSchema.parse(parsedJson);
 
    // Ensure Aadhaar number is masked; return null if fewer than 4 digits (never fabricate 'XXXX XXXX 0000')
    if (validatedData.aadhaarNumberMasked) {
      const digits = validatedData.aadhaarNumberMasked.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      validatedData.aadhaarNumberMasked = last4.length === 4 ? `XXXX XXXX ${last4}` : null;
    }
 
    // Zero persistence of image or full numbers - ephemeral return only
    return res.json({ success: true, data: validatedData });
  } catch (err: any) {
    // Log the REAL cause (never the key or image) so failures are diagnosable
    console.error('AADHAAR SCAN ERROR:', {
      name: err?.name,
      status: err?.status,
      message: String(err?.message || err).slice(0, 800),
      zodIssues: err?.issues,
    });
    const status = Number(err?.status);
    if (status === 429) {
      return res.status(429).json({ success: false, error: 'Gemini quota/rate limit reached. Please wait a minute and try again, or enter details manually.' });
    }
    if (status === 503 || status === 504) {
      return res.status(503).json({ success: false, error: 'Gemini is temporarily overloaded. Please tap scan again in a few seconds.' });
    }
    if (err?.name === 'AbortError' || /timed?\s*out/i.test(String(err?.message || ''))) {
      return res.status(504).json({ success: false, error: 'The document reader took too long. Please retry once; if it persists, enter the details manually.' });
    }
    if (status === 401 || status === 403) {
      return res.status(502).json({ success: false, error: 'Gemini rejected the API key or access (check GEMINI_API_KEY and project permissions).' });
    }
    if (status === 404) {
      return res.status(502).json({ success: false, error: 'None of the Gemini models tried are available to this API key. Set GEMINI_OCR_MODEL in .env to a model your key can use (e.g. gemini-3.8-flash) and restart the server.' });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to scan Aadhaar card. Please try again with clear lighting or enter details manually.',
    });
  }
});
 
// Return 404 JSON for any unknown /api/* path before the SPA fallback
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});
 
// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(clientDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
 
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Golden Hour Server running on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}
 
startServer();
