FROM node:20-alpine

# postgresql16-client provides pg_dump/pg_restore matching the Postgres 16 server (the backup
# feature shells out to pg_dump; its version must be >= the server's, so pin to 16).
RUN apk add --no-cache openssl libc6-compat netcat-openbsd postgresql16-client

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "until nc -z db 5432; do echo 'Waiting for PostgreSQL...'; sleep 2; done; until nc -z blockchain 8545; do echo 'Waiting for blockchain...'; sleep 2; done; sleep 6; npx prisma db push; npm run start:prod"]
