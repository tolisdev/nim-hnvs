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
- **🐳 Dockerized & Automated Updates:** Πλήρης υποστήριξη Docker Compose, multi-stage Nginx builds, persistent volumes για PDFs/μαθήματα και αυτόματες ανανεώσεις (CI/CD via GitHub Actions & Watchtower).

---

## 🏗️ Αρχιτεκτονική (Architecture)

```
malakasiotis-video-sync/
├── frontend/             # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── Dockerfile        # Multi-stage (Node 20 build -> Nginx Alpine runtime)
│   ├── nginx.conf        # Nginx reverse proxy (/api/ -> backend) & asset caching
│   ├── src/
│   │   ├── components/   # Player, PdfViewer, Timeline, Header, Drawer, LoginModal, AdminModal
│   │   ├── api.ts        # API Client & Types
│   │   └── App.tsx       # State management & Routing
│   └── package.json
├── backend/              # Python Flask REST API
│   ├── Dockerfile        # Python 3.11-slim + PyMuPDF + Gunicorn WSGI server
│   ├── app.py            # Endpoints, Auth, Video/Lesson Sync, OCR Pipelines
│   ├── services/         # eClass integration, OCR services
│   ├── storage/          # Lesson definitions (lessons.json), rendered pages, PDFs
│   ├── requirements.txt  # Python dependencies
│   └── .env.example      # Template περιβάλλοντος
├── .github/workflows/    # CI/CD: Automated build & publish to GHCR
├── scripts/              # Helper scripts (deploy.sh, update.sh)
├── docker-compose.yml    # Full stack (frontend + backend + watchtower auto-updates)
├── docker-compose.prod.yml # Production compose με pre-built images
└── api/                  # Open eClass integration / Bridge service
```

---

## 🐳 Docker Deployment & Αυτόματες Ενημερώσεις

### 1. Γρήγορη Εκκίνηση με Docker Compose (Recommended)

```bash
# 1. Κλωνοποίηση του αποθετηρίου
git clone https://github.com/tolisdev/nim-hnvs.git
cd nim-hnvs

# 2. Αντιγραφή και διαμόρφωση περιβάλλοντος
cp .env.docker.example .env
nano .env  # Ορίστε ADMIN_PASSWORD και GEMINI_API_KEY

# 3. Εκτέλεση εφαρμογής
docker compose up --build -d
```
Η εφαρμογή είναι άμεσα διαθέσιμη στη θύρα `80` (ή στη θύρα που ορίσατε στο `.env`).

---

### 🔄 Πώς λειτουργούν οι Αυτόματες Ενημερώσεις (Auto-Updates)

Το σύστημα υποστηρίζει **2 μεθόδους αυτόματων ενημερώσεων**:

#### Μέθοδος Α: Zero-Touch CI/CD (GitHub Actions + Watchtower)
1. Κάθε φορά που γίνεται `git push` στο branch `main` του GitHub, το **GitHub Actions workflow** (`.github/workflows/docker-publish.yml`):
   - Χτίζει αυτόματα τα Docker images για Frontend και Backend.
   - Τα δημοσιεύει στο GitHub Container Registry (`ghcr.io/tolisdev/nim-hnvs-frontend`, `ghcr.io/tolisdev/nim-hnvs-backend`).
2. Η υπηρεσία **Watchtower** που τρέχει στο `docker-compose.yml`:
   - Ελέγχει περιοδικά (κάθε 5 λεπτά) για νέα images στο GHCR.
   - Μόλις εντοπίσει νέο image, κατεβάζει την ενημέρωση και επανεκκινεί τα containers ομαλά (graceful restart).
   - Τα δεδομένα σας (`lessons.json`, PDFs, εξαχθείσες σελίδες) **παραμένουν άθικτα** χάρη στο persistent storage volume (`./backend/storage`).

#### Μέθοδος Β: 1-Click / Cron Script (`scripts/update.sh`)
Αν προτιμάτε direct build στον server:
```bash
./scripts/update.sh
```
Μπορείτε επίσης να προσθέσετε το script σε ένα cron job (π.χ. καθημερινά στις 04:00) ή να το καλείτε μέσω webhook.

---

## 💻 Τοπική Εκτέλεση χωρίς Docker (Development)

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

- Όλα τα ευαίσθητα στοιχεία (`GEMINI_API_KEY`, `ADMIN_PASSWORD`) βρίσκονται στο `.env` και αγνοούνται από το Git (`.gitignore`).
- Το frontend **δεν περιέχει κανένα hardcoded μυστικό** ή κωδικό.

---

## 📄 License
MIT License.
