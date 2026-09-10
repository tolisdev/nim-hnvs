# nim-hnvs (Malakasiotis Video-PDF Sync Platform)

Πλατφόρμα συγχρονισμού διαλέξεων φυσικής Γ΄ Λυκείου με ψηφιακές σημειώσεις PDF, χρονοετικέτες και αυτόματο OCR indexing.

**Domain / Branding:** [nimalakasiotis.gr](https://nimalakasiotis.gr) • COURSES113 (Φυσική Γ΄ Λυκείου)

---

## 🌟 Χαρακτηριστικά (Features)

- **Συγχρονισμός Video & Σημειώσεων:** Προβολή YouTube διαλέξεων παράλληλα με τις σημειώσεις PDF του μαθήματος.
- **54 Μαθήματα & Κατάλογος:** Πλήρης αρχική σελίδα με όλα τα 54 μαθήματα, φίλτρα (Όλα / Με σημειώσεις), tags και αναζήτηση θεματολογίας.
- **Ευέλικτος Έλεγχος Σελίδας:** Επιλογή κλειδώματος (Lock Toggle) για αυτόματη αλλαγή σελίδας ανάλογα με το τρέχον σημείο του video ή ανεξάρτητο scroll/διάβασμα.
- **Πλαϊνό Μενού (Drawer) 54 Μαθημάτων:** Άμεση μετάβαση σε οποιοδήποτε μάθημα κατά την αναπαραγωγή.
- **Open eClass API Integration:** Αυτόματη ανάκτηση χρονοετικετών και περιγραφών κατευθείαν από το API του eclass.
- **Διπλό Σύστημα OCR:**
  - **Gemini Vision OCR:** Ανάλυση χειρόγραφων/τυπωμένων σημειώσεων και εξαγωγή θεμάτων ανά σελίδα.
  - **Local OCR (EasyOCR / Fallback):** Υποστήριξη τοπικής εξαγωγής κειμένου χωρίς εξωτερικές κλήσεις API.
- **Ασφαλές Σύστημα Διαχειριστή (Admin):**
  - Προστασία με Session Token (`secrets.token_hex(32)`) και `hmac.compare_digest`.
  - Πλήρως κρυφό κουμπί Admin για μη συνδεδεμένους χρήστες.
  - Ρυθμίσεις διαχειριστή μέσω του `backend/.env`.

---

## 🏗️ Αρχιτεκτονική (Architecture)

```
malakasiotis-video-sync/
├── frontend/             # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/   # Player, PdfViewer, Timeline, Header, Drawer, LoginModal, AdminModal
│   │   ├── api.ts        # API Client & Types
│   │   └── App.tsx       # State management & Routing
│   └── package.json
├── backend/              # Python Flask REST API
│   ├── app.py            # Endpoints, Auth, Video/Lesson Sync, OCR Pipelines
│   ├── services/         # eClass integration, OCR services
│   ├── storage/          # Lesson definitions (lessons.json), rendered pages, PDFs
│   ├── requirements.txt  # Python dependencies
│   └── .env.example      # Template περιβάλλοντος
└── api/                  # Open eClass integration / Bridge service
```

---

## 🚀 Εγκατάσταση & Εκτέλεση (Quick Start)

### 1. Backend (Flask)
```bash
cd backend
python -m venv venv
# Linux/macOS: source venv/bin/activate
# Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Αντιγραφή και ρύθμιση του .env
cp .env.example .env
# Συμπληρώστε τα credentials και το GEMINI_API_KEY στο .env

# Εκκίνηση API server (port 5055)
python app.py
```

### 2. Frontend (React / Vite)
```bash
cd frontend
npm install
npm run dev
# Το frontend τρέχει στο http://127.0.0.1:5173
```

---

## 🔒 Ασφάλεια & Διαπιστευτήρια

- Όλα τα ευαίσθητα στοιχεία (`GEMINI_API_KEY`, `ADMIN_PASSWORD`) βρίσκονται στο `backend/.env` και αγνοούνται από το Git (`.gitignore`).
- Το frontend **δεν περιέχει κανένα hardcoded μυστικό** ή κωδικό.

---

## 📄 License
MIT License.
