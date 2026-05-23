FROM node:18-alpine
# Cài đặt openssl và thư viện tương thích để Prisma Engine chạy thành công trên Alpine Linux
RUN apk add --no-cache openssl libc6-compat postgresql-client
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start:dev"]
