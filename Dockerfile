FROM node:22.14.0-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN node --input-type=module -e "import('node:sqlite').then(({ DatabaseSync }) => { const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE smoke (ok INTEGER)'); db.close(); })"
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DOCFORGE_DATA_DIR=/app/data
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "src/server.js"]
