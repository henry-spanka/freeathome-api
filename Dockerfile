FROM node:12-alpine AS app-builder

RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/app

WORKDIR /usr/src/app

USER node

COPY --chown=node:node . .

RUN npm run clean
RUN npm ci

FROM node:12-alpine AS app-prod

RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/app

WORKDIR /usr/src/app

USER node

COPY --from=app-builder --chown=node:node /usr/src/app/dist ./dist
COPY --from=app-builder --chown=node:node /usr/src/app/bin ./bin
COPY --chown=node:node package*.json ./

RUN npm ci --only=production --ignore-scripts

EXPOSE 8080
EXPOSE 8081

CMD [ "node", "bin/freeathome-api" ]
