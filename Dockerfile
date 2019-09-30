FROM node:12

# Create app directory
WORKDIR /usr/src/app

# Copy App dependencies
COPY package*.json ./

RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8080
EXPOSE 8081

CMD [ "node", "bin/freeathome-api" ]
