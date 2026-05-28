FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache dos2unix
RUN npm install

COPY . .
