FROM node:11-alpine
MAINTAINER Ryan Petschek <petschekr@gmail.com>

# Deis wants bash
RUN apk update && apk add bash
RUN apk add git

# Bundle app source
WORKDIR /usr/src/groundtruth
COPY package.json /usr/src/groundtruth
COPY package-lock.json /usr/src/groundtruth
RUN npm install

# Then move files over.
COPY . /usr/src/groundtruth

# Set Timezone to EST
RUN apk add tzdata
ENV TZ="/usr/share/zoneinfo/America/Denver"
ENV NODE_ENV="production"

RUN npm run build

FROM node:11-alpine
WORKDIR /usr/src/groundtruth
COPY --from=0 /usr/src/groundtruth .
EXPOSE 3000
CMD ["npm", "start"]
