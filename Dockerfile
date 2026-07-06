FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server ./server
COPY --from=build /app/dist ./dist
VOLUME /app/data
EXPOSE 5301
CMD ["node", "server/index.js"]
