**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Standalone Tools

Два статичных HTML-инструмента на случай **аварии, когда серверу или БД нельзя доверять**. Оба работают полностью в браузере, без backend.

## Краткое сравнение

| Критерий | [break-glass-viewer](./break-glass-viewer/README.ru.md) | [recovery-signer](./recovery-signer/README.ru.md) |
|---|---|---|
| **Назначение** | Чтение + проверка журнала бэкапов | Подписание challenge для восстановления БД |
| **Поведение** | Только чтение | Запись (создаёт Web3-подпись) |
| **Вход** | Файл `backup-ledger.jsonl` | Строка `EMERGENCY_..._CHALLENGE:...` |
| **Выход** | Отчёт ЦЕЛОСТНО/АНОМАЛИЯ | Hex-подпись `0x...` |
| **Требует** | Только браузер | Браузер + MetaMask + кошелёк Admin |
| **Интернет** | Не нужен | Не нужен |
| **Для кого** | Любой аудитор | Только Admin с кошельком Superadmin |
| **Где хранится** | Тот же offsite-том, что и журнал | USB Admin / приватный GitHub Pages |

## Какой когда использовать

```text
Нужно проверить, что журнал бэкапов не изменён?
    └─→ break-glass-viewer

Нужно восстановить всю БД после удаления/шифрования?
    └─→ recovery-signer + npm run db:emergency-restore

Затронуто всего несколько записей, UI Admin ещё работает?
    └─→ Surgical Restore на /admin/backup (НЕ использовать эти инструменты)
```

## Связанная документация

- [Обзор Backup & Recovery](../docs/backup-recovery/overview.md)
- [Пошаговый Emergency Restore](../docs/backup-recovery/emergency-restore.md)
