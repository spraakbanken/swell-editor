FROM node:8 as builder
WORKDIR /usr/src/app
COPY . /usr/src/app/
RUN yarn install && yarn run build

FROM nginx:alpine as runner
COPY --from=builder /usr/src/app/dist/ /usr/share/nginx/html/
