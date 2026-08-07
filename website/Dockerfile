# High-Performance Nginx Dockerfile for Static Web Portal Gateway
FROM nginx:1.27-alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default static files
RUN rm -rf ./*

# Copy web assets
COPY . .

# Copy optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set permissions
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html /etc/nginx/conf.d

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
