FROM node:21.7.3-alpine3.19 as builder

WORKDIR /app
COPY . .

RUN npm ci
RUN npm run build

FROM node:21.7.3-alpine3.19

WORKDIR /app
COPY package*.json ./
RUN npm ci && npm prune --omit=dev
RUN npm install -g pm2
RUN apk add --no-cache docker-cli

COPY --from=builder /app/dist /app

CMD ["pm2-runtime", "/app/app.js"]
