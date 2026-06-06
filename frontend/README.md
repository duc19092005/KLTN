**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System - Frontend

The frontend application for the Hospital Management System, built with React, TypeScript, and Vite.

## Features
- **Role-based Access**: Separate workflows for Admins, Doctors, and Receptionists.
- **Biometric Authentication**: Integration with face recognition for secure login and sensitive operations (Face Step-Up).
- **Modern UI**: Styled with Tailwind CSS, following a custom "Hospital OS" design system.

## Setup Instructions

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Ensure your .env points to the correct backend API URL.
cp .env.example .env # if applicable

# 3. Start development server
npm run dev

# 4. Build for production
npm run build
```

## Documentation
- [UI Guidelines](./UI_GUIDELINES.md)
- [AI Development Rules](./AI_DEVELOPMENT_RULES.md)
