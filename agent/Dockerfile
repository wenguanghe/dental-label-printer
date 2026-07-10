FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV SERVER_URL=http://host.docker.internal:3000
ENV IS_MOCK=false
CMD ["node", "index.js"]
