FROM node:lts-slim as node-tls
# RUN apt update 
# RUN apt install -y openssl

FROM node-tls as builder
WORKDIR /app/
ADD tsconfig.json /app/
ADD package.json /app/
ADD yarn.lock /app/

RUN yarn

ADD src /app/src

RUN yarn build

RUN rm -rf node_modules
RUN yarn install --prod

FROM node-tls as runner
USER 1000
WORKDIR /app/

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/

CMD ["node", "index.js"]
