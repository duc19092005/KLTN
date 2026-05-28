FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat netcat-openbsd

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "until nc -z db 5432; do echo 'Waiting for PostgreSQL...'; sleep 2; done; until nc -z blockchain 8545; do echo 'Waiting for blockchain...'; sleep 2; done; sleep 6; npx prisma db push; npm run start:prod"]
