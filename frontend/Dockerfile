FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src

RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview"]
