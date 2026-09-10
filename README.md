# AgriShield — AI Crop Disease Diagnostic & Field Treatment Advisor

AgriShield is an AI-powered crop health advisor tailored for farmers and agricultural field extension officers. It analyzes plant foliage photos or live camera captures to identify diseases, assess severity, and provide actionable treatment recommendations in English and 12 major Indian languages.

---

## 🚀 Key Features

- **Upload & Live Camera Capture**:
  - Drag-and-drop or browse image files.
  - In-browser live camera viewfinder with mobile rear-camera default (`facingMode: 'environment'`).
  - Camera flip toggle (rear / selfie) and fallback to phone's native camera.
- **Multilingual Diagnosis**:
  - English + 12 Indian languages (Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu).
- **Comprehensive Agronomic Reports**:
  - Crop identification, disease diagnosis, severity badge, and urgency level.
  - Visual symptoms, immediate field steps, chemical solutions (with dilutions), pest control measures, and prevention checklists.
  - Printable PDF report export.
- **Diagnostic History**:
  - Past field inspections saved in browser storage (`localStorage`) with thumbnail previews.
- **Secure Backend Proxy Architecture**:
  - Built for **Vercel Serverless Functions** (`/api/analyze`).
  - The Gemini API key is stored securely in **Vercel Environment Variables** and is **never exposed** in client-side code or network inspection.

---

## 🛠️ Project Structure

```text
agrishield/
├── api/
│   └── analyze.js       # Vercel serverless function backend proxy
├── index.html           # Single-page frontend application
├── vercel.json          # Vercel function timeout configuration (30s)
├── .env.example         # Template for environment variables
├── .gitignore           # Git ignore rules for secrets & caches
└── README.md            # Documentation & setup guide
```

---

## 📦 How to Deploy to Vercel (Recommended)

### Step 1: Push Your Code to GitHub
1. In your project folder, initialize a git repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for AgriShield"
   git branch -M main
   ```
2. Create a new repository on [GitHub](https://github.com/new) named `agrishield`.
3. Link and push to GitHub:
   ```bash
   git remote add origin https://github.com/<your-github-username>/agrishield.git
   git push -u origin main
   ```

### Step 2: Deploy on Vercel
1. Log in to [Vercel](https://vercel.com/) (Sign in with GitHub).
2. Click **"Add New..."** > **"Project"**.
3. Import your `agrishield` repository.
4. Under **"Environment Variables"**, add:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
5. Click **"Deploy"**.

Your live URL will be generated (e.g., `https://agrishield.vercel.app`).
All image diagnosis requests will automatically route through the secure `/api/analyze` serverless proxy!

---

## 💻 Local Testing

You can test the application locally in two ways:

### Option A: Using Vercel CLI (Simulates Serverless Backend)
```bash
npm install -g vercel
vercel dev
```
Create a `.env.local` file containing:
```text
GEMINI_API_KEY=your_gemini_api_key_here
```

### Option B: Direct Browser / Static Test
Simply double-click `index.html` to open it in your browser. When running directly from the local file system (`file:///`), click the **"Connect API Key"** button in the header to enter your API key for local browser testing.
