FROM node:20-alpine as builder
WORKDIR /opt
COPY . .
RUN npm install
RUN npm run build

FROM nginx:1.19-alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /opt/dist/ .
COPY --from=builder /opt/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
