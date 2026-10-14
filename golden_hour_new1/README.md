# Golden Hour - Western Railway Hospital & Emergency Bed Grid

A full-stack emergency hospital bed availability radar, nurse triage station, 108 ambulance dispatch telemetry, and administrative operations portal for Mumbai Western Railway line commuters.

**Tagline:** Find the right hospital bed, fast.

## 0. Architecture & Tech Stack

- **Backend Runtime:** Node.js (>= 22.13) with Express 4.
- **Database:** Persistent SQLite 3 using native `node:sqlite` (`DatabaseSync` with Write-Ahead Logging `WAL` mode and atomic transactions).
- **Authentication:** Server-side Scrypt password hashing (`node:crypto`), cryptographically signed HMAC-SHA256 session tokens with `httpOnly` cookies (`golden_hour_session`) and Bearer headers.
- **Security:** `helmet` headers, strict CORS allow-list, `express-rate-limit` keyed on IP (for patient intake) and IP + username (for staff), strict Zod payload validation, and role-based ownership checks.
- **AI Document OCR:** Google Gemini Flash (`@google/genai`) for multimodal Aadhaar identity verification with zero-hallucination policy and privacy-masked numbers (`XXXX XXXX 1234`).
- **Frontend:** React 19, TypeScript (strict mode enabled), Tailwind CSS 4, Vite 8.
- **Internationalization (i18n):** Trilingual support across English, Hindi (हिन्दी), and Marathi (मराठी).
- **Geographic Coverage:** Full Mumbai Western Line corridor across all 29 stations (Churchgate to Virar) spanning 10 geographic zones with 44 real government and private hospitals.

## 1. Getting Started

### Prerequisites
- Node.js version 22.13 or higher (`node -v`) — required for unflagged `node:sqlite` support.

### Installation & Environment

```bash
npm install
```

Configure `.env` (refer to `.env.example`):
```env
GEMINI_API_KEY="your-gemini-api-key"
SESSION_SECRET="your-secure-random-secret"
APP_URL="http://localhost:3000"
ALLOW_DB_RESET="false"
PORT=3000
```

### Running Locally

```bash
# Start backend Express server and Vite frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm run start
```

### Type Checking, Lint & Smoke Tests

```bash
npm run lint
npm run smoke
```

## 2. Role-Based Authentication & Demo Logins

| Role | Username / Identifier | Passcode | Assigned Context / Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `ADM-OPS-01` | `admin123` | Full access: Central Operations, Admissions registry, user audit logs, hospital creation, and read-only SQL Studio. |
| **Hospital Nurse** | `NS-7H-104` | `123456` | Seven Hills Hospital (`hosp-sevenhills`): Rapid bed updates, doctor paging, patient triage. |
| **Hospital Nurse** | `NS-BH-101` | `123456` | Bombay Hospital (`hosp-bombay`): South Mumbai facility triage. |
| **Hospital Nurse** | `NS-LIL-101` | `123456` | Lilavati Hospital (`hosp-lilavati`): Bandra facility triage. |
| **Hospital Nurse** | `NS-NAN-101` | `123456` | Nanavati Max Hospital (`hosp-nanavati`): Vile Parle facility triage. |
| **Hospital Nurse** | `NS-SHAT-101` | `123456` | Shatabdi Municipal Hospital (`hosp-shatabdi-kandivali`): Kandivali facility triage. |
| **Hospital Nurse** | `NS-CG-101` | `123456` | Cardinal Gracias Hospital (`hosp-cardinal-gracias`): Vasai facility triage. |
| **Ambulance Pilot** | `AMB-108-9192` | `9192` | Vehicle `MH-02-ER-9192`: Highway navigation, live street telemetry, and 5-stage emergency dispatch. |
| **Patient / Commuter** | *Dynamic Intake* | *N/A* | Emergency bed search radar, Aadhaar OCR scan, 2-minute SLA bed hold, live 108 GPS tracking. |

## 3. Key Safety & Emergency Features

1. **Atomic Bed Reservation Transactions:**
   - Bed holds via `/api/emergency/hold` execute in an immediate SQL transaction (`BEGIN IMMEDIATE` ... `COMMIT`).
   - Verifies bed availability, restores any previously held bed on the same case before decrementing the new facility's bed counter atomically.
   - If no beds are available, returns `HTTP 409 Conflict`.
   - Automatically sets a 2-minute expiration timestamp (`hold_expires_at`), and locks the hold as `'confirmed'` once the ambulance advances dispatch stage (`>= 2`) or streams live GPS telemetry.

2. **Server-Side Hold Expiration & Patient Cancellation:**
   - Server automatically releases expired unconfirmed holds (`hold_status = 'active'`) back to the hospital's available pool inside a transaction.
   - Patient can click **"Cancel Bed Reservation"** to immediately free the bed for others.

3. **Two-Tier Fast GPS & Boundary Check:**
   - Tries fast low-accuracy fix first, then refines with high accuracy.
   - Distance is measured dynamically from actual GPS coordinates when active, or chosen station when off.
   - Sanity check alerts users if they are > 8 km from the Western Line corridor.

4. **Honest Emergency Intake:**
   - Full validation on patient name, attendant, 10-digit Indian phone, and age (0–120).
   - Quick Emergency path allows explicit "I don't know their name" marking as `Unknown patient` with `isUnidentified: true`.
   - Blood group default is "Don't know" (never silently fabricated).
