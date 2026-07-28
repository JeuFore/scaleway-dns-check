FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY . .

COPY package*.json ./

RUN yarn install

RUN yarn build:production

FROM alpine:latest AS apprise

ARG TARGETARCH

RUN apk add --no-cache curl unzip

RUN curl -L \
    -o /usr/local/bin/apprise-go \
    "https://github.com/unraid/apprise-go/releases/latest/download/apprise-go-linux-${TARGETARCH}" \
 && chmod +x /usr/local/bin/apprise-go

FROM builder

WORKDIR /app

COPY --from=builder /usr/src/app/dist /app

COPY --from=apprise /usr/local/bin/apprise-go /usr/local/bin/apprise

CMD [ "node", "index.js" ]