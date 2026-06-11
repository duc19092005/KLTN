**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System - Blockchain

Смарт-контракты для журнала аудита с защитой от подделки. Для разработки, тестирования и деплоя используется Hardhat.

## Обзор
Блокчейн-слой используется **исключительно для аудита и проверки целостности**. Медицинские данные, PII, PDF и рентгены никогда не попадают в цепь. На цепи остаются только хеши, временные метки и метаданные через контракт `AuditAnchor` и registry-контракты.

## Установка

```bash
# 1. Установить зависимости
npm install

# 2. Скомпилировать контракты
npx hardhat compile

# 3. Прогнать тесты
npx hardhat test

# 4. Запустить локальный узел Hardhat
npx hardhat node

# 5. Локальный деплой контрактов
npx hardhat run scripts/deploy.js --network localhost
```
