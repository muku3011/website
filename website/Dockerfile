# ==============================================================================
# Production Hardened Nginx Dockerfile for Static Web Portal Gateway
# ==============================================================================
FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

# Clean default assets
RUN rm -rf ./*

# Copy web application assets
COPY . .

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set permissions for non-root execution
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html /etc/nginx/conf.d

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
