FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY . .

COPY package*.json ./

RUN yarn install

RUN yarn build:production


FROM node:24-alpine

WORKDIR /app

COPY --from=builder /usr/src/app/dist /app

CMD [ "node", "index.js" ]