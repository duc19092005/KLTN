**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Recovery Signer

> Подписание challenge через MetaMask для аварийного восстановления БД, когда обычный вход невозможен.

## Назначение

Когда БД удалена/зашифрована или повреждена настолько, что **ни одного User для входа не осталось, а биометрии тоже нельзя доверять**, системе нужен запасной «корневой ключ». Этот инструмент использует **Web3-кошелёк Admin**, заранее зарегистрированный в контракте `IdentityRegistry`, как out-of-band root of trust.

Полный сценарий:

```text
SSH на лежащий сервер              Личная машина Admin (безопасно)
─────────────────                  ───────────────────────────────
$ npm run db:emergency-restore     ┌──→ Открыть recovery-signer/index.html
        │                           │   Подключить MetaMask
        ▼                           │   Вставить challenge → Подписать
EMERGENCY_..._CHALLENGE:abc:t  ─────┘
        │                                │
        ▼                                ▼
  (Admin копирует challenge)        0xabcdef... (подпись)
        │                                │
        └──── Admin вставляет подпись ◄──┘
        │
        ▼
Проверка on-chain: ethers.verifyMessage()
                   → IdentityRegistry.isAuthorized()
        │
        ▼
Drop DB + загрузка дампа через psql
```

## Когда использовать

| Ситуация | Почему |
|---|---|
| БД удалена или зашифрована | Нет таблицы User для входа |
| Биометрии нельзя доверять | Face scan не подходит для аутентификации |
| Сервер скомпрометирован | Ничему на сервере нельзя верить |
| Нужно восстановить БД целиком из `.sql` | Единственный путь, когда доступ потерян |

> [!CAUTION]
> **Не использовать для штатного восстановления.** Если UI Admin работает, применяйте «Surgical Restore» на `/admin/backup` (восстанавливает только повреждённые записи — сильно безопаснее). Recovery Signer — крайняя мера.

## Требования

- **На личной машине Admin (НЕ на сервере):**
  - Браузер с установленным MetaMask
  - Кошелёк Admin зарегистрирован в контракте `IdentityRegistry` (через deploy-скрипт)
- **На сервере:**
  - SSH-доступ
  - Валидный файл бэкапа `.sql` (через SCP/USB)
  - Клонированный backend-репозиторий (чтобы запустить `npm run db:emergency-restore`)

**Не нужно:** интернет в браузере во время подписи (вся логика подписи работает локально внутри MetaMask).

## Где запускать

Три места по убыванию безопасности:

### 1. USB / приватный GitHub Pages под управлением Admin (НАИБОЛЕЕ РЕКОМЕНДУЕТСЯ)

```bash
# На личной машине Admin, скопировать директорию на USB
cp -r tools/recovery-signer/ /Volumes/AdminUSB/

# При необходимости вставить USB в личную машину и открыть
open /Volumes/AdminUSB/recovery-signer/index.html
```

**Почему:** Полная изоляция от подозрительной инфраструктуры. Даже если хакер захватил сервер, файл на USB Admin он не изменит.

### 2. Репозиторий на личной машине

```bash
# На ноутбуке Admin (с клонированным репозиторием)
xdg-open tools/recovery-signer/index.html   # Linux
open tools/recovery-signer/index.html       # macOS
```

**Подходит когда:** Repo есть локально, USB ещё не настроен. Безопасно — личная машина не равна лежащему серверу.

### 3. URL работающего frontend

```text
https://<your-frontend-domain>/recovery-signer.html
```

Файл `frontend/public/recovery-signer.html` — это **синхронизированная копия** `tools/recovery-signer/index.html`, отдаётся Vite как статический файл из `public/`.

> [!CAUTION]
> Использовать этот вариант **только если frontend стабильно работает и вы ему доверяете**. Если frontend сидит на той же инфраструктуре, что и упавшая БД, не используйте — хакер мог отредактировать HTML и украсть подпись.

## Подробный сценарий (от A до Z)

Полный пошаговый гид со скриншотами: [docs/backup-recovery/emergency-restore.md](../../docs/backup-recovery/emergency-restore.md).

Кратко:

1. **SSH** на сервер, `cd backend`, выполнить:
   ```bash
   npm run db:emergency-restore /path/to/dump.sql
   ```
2. Терминал выведет `EMERGENCY_DATABASE_RESTORE_CHALLENGE:<hex>:<timestamp>` — скопировать.
3. **На личной машине:** открыть `recovery-signer/index.html`, нажать «Подключить кошелёк MetaMask».
4. Вставить challenge в поле ввода, нажать «Подписать сообщение спасения», подтвердить в MetaMask.
5. Скопировать hex-подпись (`0x...`).
6. Вернуться в SSH-терминал, вставить подпись, Enter.
7. Backend сам проверит подпись on-chain → если валидна, сделает drop DB и восстановит из дампа.

## Зачем out-of-band?

Когда сервер под подозрением, **всему на сервере веры нет**:

- Приватный ключ нельзя вводить на сервере (атакующий мог логировать клавиши).
- Проверка «кто Admin» не может опираться на БД (под подозрением) или `.env` сервера.
- Источник правды должен жить **отдельно** от падающего сервера.

Решение:
1. **Приватный ключ:** в MetaMask на личной машине, никогда не покидает её.
2. **Проверка прав Admin:** напрямую читается смарт-контракт `IdentityRegistry` on-chain — подделать нельзя.
3. **Случайный challenge + timestamp:** защищает от replay (старая подпись не пригодна повторно).

## Синхронизированные файлы

| Путь | Роль |
|---|---|
| `tools/recovery-signer/index.html` | **Canonical** — редактируется здесь |
| `frontend/public/recovery-signer.html` | Копия для Vite — синхронизируется из canonical |

Для обновления: редактируем canonical, затем:
```bash
cp tools/recovery-signer/index.html frontend/public/recovery-signer.html
```

## Связанная документация

- [Пошаговый Emergency Restore](../../docs/backup-recovery/emergency-restore.md)
- [Обзор Backup & Recovery](../../docs/backup-recovery/overview.md)
- [Break-Glass Viewer (парный инструмент)](../break-glass-viewer/README.ru.md)
