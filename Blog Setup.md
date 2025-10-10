# Blog System Setup Guide

This guide will help you set up the complete blog system with SQLite database and Java Spring Boot backend.

## 🏗️ Architecture Overview

The blog system consists of:
- **Frontend**: HTML/CSS/JavaScript (existing portfolio website)
- **Backend**: Java Spring Boot REST API
- **Database**: SQLite (file-based database)
- **Integration**: AJAX calls from frontend to backend API

## 📋 Prerequisites

### Required Software
- **Java 17 or higher** - [Download here](https://adoptium.net/)
- **Maven 3.6 or higher** - [Download here](https://maven.apache.org/download.cgi)
- **Git** (optional) - [Download here](https://git-scm.com/)

### Verify Installation
```bash
# Check Java version
java -version

# Check Maven version
mvn -version
```

## 🚀 Quick Start

### Option 1: Using Startup Scripts (Recommended)

**For Windows:**
```bash
cd backend
start.bat
```

**For Linux/Mac:**
```bash
cd backend
./start.sh
```

### Option 2: Manual Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Build the project**
   ```bash
   mvn clean install
   ```

3. **Run the application**
   ```bash
   mvn spring-boot:run
   ```

## 🌐 Accessing the System

Once the backend is running, you can access:

- **API Base URL**: `http://localhost:8080/api`
- **Blog API**: `http://localhost:8080/api/blogs`
- **Health Check**: `http://localhost:8080/api/actuator/health`
- **Frontend**: Open `index.html` in your browser

## 📊 Database

### SQLite Database
- **File**: `portfolio.db` (created automatically)
- **Location**: Backend project root directory
- **Sample Data**: Automatically populated on first startup

### Sample Blog Posts
The system comes with 5 pre-loaded blog posts:
1. Enterprise Architecture Best Practices
2. Advanced Java Development Patterns
3. Building Resilient Microservices
4. Cloud-Native Architecture
5. Technical Leadership

## 🔧 Configuration

### Backend Configuration
Edit `backend/src/main/resources/application.yml`:

```yaml
server:
  port: 8080  # Change port if needed
  servlet:
    context-path: /api

spring:
  datasource:
    url: jdbc:sqlite:portfolio.db  # Database file path
```

### Frontend Configuration
Edit `scripts/blog.js` and `scripts/blog-detail.js`:

```javascript
const API_BASE_URL = 'http://localhost:8080/api';  // Backend URL
```

## 📱 Frontend Integration

### Blog Page (`blog.html`)
- Fetches blog posts from API
- Displays featured and regular posts
- Includes search functionality
- Shows recent posts in sidebar

### Blog Detail Page (`blog-detail.html`)
- Displays individual blog posts
- Shows related posts
- Includes social sharing
- Responsive design

### JavaScript Files
- `scripts/blog.js` - Blog listing functionality
- `scripts/blog-detail.js` - Individual blog post functionality

## 🛠️ Development

### Project Structure
```
portfolio/
├── backend/                 # Spring Boot backend
│   ├── src/main/java/      # Java source code
│   ├── src/main/resources/ # Configuration files
│   ├── pom.xml            # Maven dependencies
│   ├── start.sh           # Linux/Mac startup script
│   └── start.bat          # Windows startup script
├── scripts/               # Frontend JavaScript
│   ├── blog.js           # Blog listing functionality
│   └── blog-detail.js    # Blog detail functionality
├── blog.html             # Blog listing page
├── blog-detail.html      # Individual blog post page
└── BLOG_SETUP.md         # This file
```

### Adding New Blog Posts

#### Via API (Programmatic)
```bash
curl -X POST "http://localhost:8080/api/blogs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Your Blog Title",
    "content": "Full blog content...",
    "excerpt": "Short description",
    "author": "Mukesh Joshi",
    "status": "PUBLISHED",
    "isFeatured": false
  }'
```

#### Via Database (Direct)
1. Open `portfolio.db` with SQLite browser
2. Insert into `blogs` table
3. Restart backend application

### Customizing Blog Content

1. **Edit Sample Data**: Modify `backend/src/main/java/com/mukeshjoshi/portfolio/config/DataInitializer.java`
2. **Add New Fields**: Update `Blog.java` entity
3. **Update API**: Modify `BlogController.java` and `BlogService.java`
4. **Update Frontend**: Modify JavaScript files

## 🔍 API Endpoints

### Blog Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blogs` | Get all published blogs |
| GET | `/api/blogs/page?page=0&size=10` | Get blogs with pagination |
| GET | `/api/blogs/featured` | Get featured blogs |
| GET | `/api/blogs/recent?limit=5` | Get recent blogs |
| GET | `/api/blogs/search?q=java` | Search blogs |
| GET | `/api/blogs/slug/{slug}` | Get blog by slug |
| POST | `/api/blogs` | Create new blog |
| PUT | `/api/blogs/{id}` | Update blog |
| DELETE | `/api/blogs/{id}` | Delete blog |

### Example API Calls
```bash
# Get all blogs
curl http://localhost:8080/api/blogs

# Search for Java-related posts
curl "http://localhost:8080/api/blogs/search?q=java"

# Get featured posts
curl http://localhost:8080/api/blogs/featured

# Get specific blog post
curl http://localhost:8080/api/blogs/slug/enterprise-architecture-best-practices
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use
**Error**: `Port 8080 was already in use`
**Solution**: 
- Change port in `application.yml`
- Or kill process using port 8080:
  ```bash
  # Windows
  netstat -ano | findstr :8080
  taskkill /PID <PID> /F
  
  # Linux/Mac
  lsof -ti:8080 | xargs kill -9
  ```

#### 2. Java Version Issues
**Error**: `Unsupported major.minor version`
**Solution**: Install Java 17 or higher

#### 3. Maven Build Fails
**Error**: `BUILD FAILURE`
**Solution**:
- Check internet connection (Maven downloads dependencies)
- Clear Maven cache: `mvn dependency:purge-local-repository`
- Update Maven version

#### 4. Database Issues
**Error**: `SQLite database locked`
**Solution**:
- Stop the application
- Delete `portfolio.db` file
- Restart application (database will be recreated)

#### 5. CORS Issues
**Error**: `Access to fetch at 'http://localhost:8080' from origin 'file://' has been blocked by CORS policy`
**Solution**:
- Serve frontend from a web server (not file://)
- Use a simple HTTP server:
  ```bash
  # Python 3
  python -m http.server 8000
  
  # Node.js
  npx serve .
  
  # PHP
  php -S localhost:8000
  ```

### Debug Mode
Enable debug logging by adding to `application.yml`:
```yaml
logging:
  level:
    com.mukeshjoshi: DEBUG
    org.springframework.web: DEBUG
    org.hibernate.SQL: DEBUG
```

## 🚀 Deployment

### Local Development
1. Run backend: `mvn spring-boot:run`
2. Serve frontend: Use any HTTP server
3. Access: `http://localhost:8000` (frontend) + `http://localhost:8080/api` (backend)

### Production Deployment
1. **Build JAR**: `mvn clean package`
2. **Run JAR**: `java -jar target/portfolio-backend-0.0.1-SNAPSHOT.jar`
3. **Configure**: Update API_BASE_URL in frontend JavaScript
4. **Deploy**: Upload to web server

### Docker Deployment
```dockerfile
FROM openjdk:17-jdk-slim
COPY target/portfolio-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

## 📚 Additional Resources

- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Maven Documentation](https://maven.apache.org/guides/)
- [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## 🤝 Support

If you encounter any issues:
1. Check this troubleshooting guide
2. Review the backend logs
3. Verify all prerequisites are installed
4. Check network connectivity

## 📝 License

This project is part of the portfolio website and follows the same license terms.
