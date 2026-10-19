FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DOCFORGE_DATA_DIR=/app/data
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "src/server.js"]
