FROM node:20-alpine

ENV CI=true \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
