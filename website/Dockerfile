# ==============================================================================
# Production Hardened Nginx Dockerfile for Static Web Portal Gateway
# ==============================================================================
FROM nginx:1.27-alpine

RUN apk add --no-cache curl

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*
COPY . .
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Pre-create all Nginx temporary cache directories with full non-root nginx user permissions
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html /etc/nginx/conf.d

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
