FROM node:16 as builder
WORKDIR /usr/src/app
COPY package*.json app.js ./
RUN npm ci --quiet

FROM node:16.17.1-alpine as final
WORKDIR /home/node/
COPY --from=builder /usr/src/app ./
EXPOSE 3000
CMD ["node", "app.js"]