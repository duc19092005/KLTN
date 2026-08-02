**🌐 Language:** [🇻🇳 Tiếng Việt](README.md) · [🇬🇧 English](README.en.md) · [🇷🇺 Русский](README.ru.md)

# KLTN Hospital Management System - Frontend

Frontend-приложение системы управления больницей, построенное на React, TypeScript и Vite.

## Возможности
- **Доступ по ролям:** отдельные сценарии для Admin, Doctor, Receptionist и Lab Manager.
- **Биометрическая аутентификация:** распознавание лица для безопасного входа и критичных операций (Face Step-Up).
- **Современный UI:** стилизация Tailwind CSS с собственной дизайн-системой «Hospital OS».

## Установка

```bash
# 1. Установить зависимости
npm install

# 2. Настроить переменные окружения
# Убедитесь, что .env указывает на корректный URL API.
cp .env.example .env # при необходимости

# 3. Запустить dev-сервер
npm run dev

# 4. Production-сборка
npm run build
```

## Документация
- [UI Guidelines](../../architecture/frontend-ui-guidelines.md)
- [AI Development Rules](../../architecture/frontend-ai-rules.md)
