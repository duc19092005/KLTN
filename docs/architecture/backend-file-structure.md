src/
├── main.ts
├── app.module.ts
│
├── common/                 # dùng chung toàn hệ thống
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   ├── utils/
│   ├── constants/
│   └── types/
│
├── config/
│   ├── env/
│   ├── database/
│   ├── jwt/
│   └── swagger/
│
├── infrastructure/         # kỹ thuật hệ thống
│   ├── prisma/
│   ├── redis/
│   ├── blockchain/
│   ├── ai/
│   ├── mail/
│   └── storage/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── doctors/
│   ├── appointments/
│   ├── medical-records/
│   ├── biometric/
│   ├── blockchain/
│   └── audit-log/
│
└── jobs/
    ├── queues/
    └── cron/

Bên trong mỗi module:

modules/
└── auth/
    ├── auth.module.ts
    │
    ├── controllers/
    │   └── auth.controller.ts
    │
    ├── services/
    │   ├── auth.service.ts
    │   ├── jwt.service.ts
    │   └── biometric-auth.service.ts
    │
    ├── dto/
    │   ├── login.dto.ts
    │   ├── register.dto.ts
    │   └── verify-biometric.dto.ts
    │
    ├── entities/
    │   └── auth-session.entity.ts
    │
    ├── repositories/
    │   └── auth.repository.ts
    │
    ├── guards/
    ├── strategies/
    ├── interfaces/
    ├── constants/
    └── types/