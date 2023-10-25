FROM public.ecr.aws/docker/library/node:18 AS builder
WORKDIR /usr/src/app
COPY package*.json app.js ./
RUN npm ci --quiet

FROM public.ecr.aws/docker/library/node:18-alpine AS final
WORKDIR /home/node/
COPY --from=builder /usr/src/app ./
EXPOSE 3000
CMD ["node", "app.js"]
