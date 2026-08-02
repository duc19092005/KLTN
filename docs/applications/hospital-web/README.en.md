**🌐 Language:** [🇻🇳 Tiếng Việt](README.md) · [🇬🇧 English](README.en.md) · [🇷🇺 Русский](README.ru.md)

# KLTN Hospital Management System - Frontend

The frontend application for the Hospital Management System, built with React, TypeScript, and Vite.

## Features
- **Role-based access:** separate workflows for Admins, Doctors, Receptionists, and Lab Managers.
- **Biometric authentication:** face recognition for secure login and sensitive operations (Face Step-Up).
- **Modern UI:** styled with Tailwind CSS following the custom "Hospital OS" design system.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Make sure your .env points to the correct backend API URL.
cp .env.example .env # if applicable

# 3. Start the dev server
npm run dev

# 4. Production build
npm run build
```

## Documentation
- [UI Guidelines](../../architecture/frontend-ui-guidelines.md)
- [AI Development Rules](../../architecture/frontend-ai-rules.md)
