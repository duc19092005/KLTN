# Frontend Web Application - Hospital Management Portal (React + Vite)

The administrative web portal and clinical workspace built with **React**, **Vite**, **Tailwind CSS**, and **Lucide Icons**, featuring Web3 MetaMask authentication, browser camera facial biometrics, and real-time blockchain audit trail visualization.

---

## 🖥️ Core Functional Modules

1. **Doctor Clinical Workspace:**
   - Real-time patient queue by clinical department.
   - Comprehensive consultation history, vital signs, and allergy warnings.
   - Multi-AI diagnostic assistance (Claude, GPT, Gemini).
   - Laboratory order management and definitive ICD-10 conclusion signing.

2. **Laboratory & Radiology Workspace:**
   - Order processing queue for laboratory and diagnostic imaging.
   - Numerical findings and clinical observation recording.
   - Secure medical image upload (DICOM, JPG, PNG, PDF) to private AWS S3 buckets.

3. **Blockchain Audit & Integrity Dashboard:**
   - Real-time monitoring of on-chain Merkle checkpoints.
   - Merkle Tree visualizer and mathematical Inclusion Proof generator.
   - Deep-Scan & Database Self-Healing control center secured by Face Step-Up MFA.

4. **Hospital Administration:**
   - Personnel, doctor credentials, and department leadership management.
   - Clinical AI model registration, accuracy evaluation, and parameter tuning.

---

## ⚙️ Setup & Execution

### 1. Install Dependencies
```bash
cd apps/hospital-web
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
Set the API backend URL:
```env
VITE_API_URL=http://localhost:3001/api
```

### 3. Run Application
```bash
# Development mode
npm run dev

# Production build
npm run build
npm run preview
```
The application runs at: `http://localhost:5173`.