package in.hutta.blog.controller;

import in.hutta.blog.model.BlogImage;
import in.hutta.blog.model.BlogPost;
import in.hutta.blog.model.ContactMessage;
import in.hutta.blog.repository.BlogImageRepository;
import in.hutta.blog.repository.BlogPostRepository;
import in.hutta.blog.repository.ContactMessageRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@CrossOrigin
@RestController
@RequestMapping("/api/blog")
public class BlogController {
  private static final Logger log = LoggerFactory.getLogger(BlogController.class);

  @Autowired private BlogPostRepository blogPostRepository;
  @Autowired private BlogImageRepository blogImageRepository;
  @Autowired private ContactMessageRepository contactMessageRepository;

  private final Map<String, Long> ipRateLimits = new ConcurrentHashMap<>();
  private static final long RATE_LIMIT_COOLDOWN_MS = 60000; // 1 minute cooldown

  // --------------------------------------------------------------------------
  // BLOG POST ENDPOINTS (PUBLIC READ)
  // --------------------------------------------------------------------------

  @GetMapping("/posts")
  public ResponseEntity<List<BlogPost>> getAllPosts(HttpServletRequest request) {
    String username = getAuthenticatedUser(request);
    if (username != null) {
      return ResponseEntity.ok(blogPostRepository.findAllByOrderByCreatedAtDesc());
    } else {
      return ResponseEntity.ok(blogPostRepository.findByPublishedTrueOrderByCreatedAtDesc());
    }
  }

  @GetMapping("/posts/{slug}")
  public ResponseEntity<?> getPostBySlug(
      @PathVariable("slug") String slug, HttpServletRequest request) {
    Optional<BlogPost> postOpt = blogPostRepository.findBySlug(slug);
    if (postOpt.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    BlogPost post = postOpt.get();
    if (!post.isPublished() && getAuthenticatedUser(request) == null) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN)
          .body("Error: This article is a draft and requires authentication.");
    }
    return ResponseEntity.ok(post);
  }

  // --------------------------------------------------------------------------
  // BLOG POST CRUD ENDPOINTS (PROTECTED WRITE)
  // --------------------------------------------------------------------------

  @PostMapping("/posts")
  public ResponseEntity<?> createPost(@RequestBody BlogPost post, HttpServletRequest request) {
    String username = getAuthenticatedUser(request);
    if (username == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body("Error: Unauthorized. Please log in.");
    }

    if (post.getTitle() == null || post.getTitle().trim().isEmpty()) {
      return ResponseEntity.badRequest().body("Error: Title is required.");
    }
    if (post.getContent() == null || post.getContent().trim().isEmpty()) {
      return ResponseEntity.badRequest().body("Error: Content is required.");
    }

    post.setAuthor(username);
    String baseSlug = slugify(post.getTitle());
    post.setSlug(makeSlugUnique(baseSlug, null));

    BlogPost saved = blogPostRepository.save(post);
    log.info(
        "Blog post created successfully: ID={}, slug={}, by={}",
        saved.getId(),
        saved.getSlug(),
        username);
    return ResponseEntity.status(HttpStatus.CREATED).body(saved);
  }

  @PutMapping("/posts/{id}")
  public ResponseEntity<?> updatePost(
      @PathVariable("id") Long id, @RequestBody BlogPost postDetails, HttpServletRequest request) {
    String username = getAuthenticatedUser(request);
    if (username == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body("Error: Unauthorized. Please log in.");
    }

    return blogPostRepository
        .findById(id)
        .map(
            existingPost -> {
              if (postDetails.getTitle() == null || postDetails.getTitle().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Error: Title is required.");
              }
              if (postDetails.getContent() == null || postDetails.getContent().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Error: Content is required.");
              }

              existingPost.setTitle(postDetails.getTitle());
              existingPost.setSummary(postDetails.getSummary());
              existingPost.setContent(postDetails.getContent());
              existingPost.setImageUrl(postDetails.getImageUrl());
              existingPost.setTags(postDetails.getTags());
              existingPost.setPublished(postDetails.isPublished());

              // Regenerate slug if title changed
              String baseSlug = slugify(postDetails.getTitle());
              existingPost.setSlug(makeSlugUnique(baseSlug, id));

              BlogPost updated = blogPostRepository.save(existingPost);
              log.info(
                  "Blog post updated successfully: ID={}, slug={}, by={}",
                  updated.getId(),
                  updated.getSlug(),
                  username);
              return ResponseEntity.ok(updated);
            })
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/posts/{id}")
  public ResponseEntity<?> deletePost(@PathVariable("id") Long id, HttpServletRequest request) {
    String username = getAuthenticatedUser(request);
    if (username == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body("Error: Unauthorized. Please log in.");
    }

    return blogPostRepository
        .findById(id)
        .map(
            post -> {
              blogPostRepository.delete(post);
              log.info("Blog post deleted successfully: ID={}, by={}", id, username);
              return ResponseEntity.ok().body("Post deleted successfully.");
            })
        .orElse(ResponseEntity.notFound().build());
  }

  // --------------------------------------------------------------------------
  // IMAGE STORAGE & RETRIEVAL ENDPOINTS
  // --------------------------------------------------------------------------

  @PostMapping("/images")
  public ResponseEntity<?> uploadImage(
      @RequestParam("file") MultipartFile file, HttpServletRequest request) {
    String username = getAuthenticatedUser(request);
    if (username == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body("Error: Unauthorized. Please log in.");
    }

    if (file == null || file.isEmpty()) {
      return ResponseEntity.badRequest().body("Error: File is empty or missing.");
    }

    // Validate Content-Type
    String contentType = file.getContentType();
    if (contentType == null || !contentType.startsWith("image/")) {
      return ResponseEntity.badRequest().body("Error: Only image files are allowed.");
    }

    try {
      BlogImage image = new BlogImage();
      image.setFilename(file.getOriginalFilename());
      image.setContentType(contentType);
      image.setData(file.getBytes());

      BlogImage saved = blogImageRepository.save(image);
      log.info(
          "Image uploaded and stored in DB: ID={}, filename={}",
          saved.getId(),
          saved.getFilename());

      Map<String, String> response = new HashMap<>();
      response.put("imageUrl", "/api/blog/images/" + saved.getId());
      return ResponseEntity.ok(response);
    } catch (IOException e) {
      log.error("Failed to read image bytes", e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body("Error reading uploaded file: " + e.getMessage());
    }
  }

  @GetMapping("/images/{id}")
  public ResponseEntity<byte[]> getImage(@PathVariable("id") Long id) {
    return blogImageRepository
        .findById(id)
        .map(
            image ->
                ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(image.getContentType()))
                    .body(image.getData()))
        .orElse(ResponseEntity.notFound().build());
  }

  // --------------------------------------------------------------------------
  // CONTACT MESSAGE ENDPOINTS
  // --------------------------------------------------------------------------

  @PostMapping("/contact")
  public ResponseEntity<?> submitContactMessage(
      @RequestBody ContactMessage message, HttpServletRequest request) {
    // 1. Honeypot check
    if (message.getHoneypot() != null && !message.getHoneypot().trim().isEmpty()) {
      log.warn("Spam blocked: Honeypot field filled");
      return ResponseEntity.badRequest().body("Error: Spam detected.");
    }

    // 2. IP Rate Limiting
    String ip = getClientIp(request);
    long now = System.currentTimeMillis();
    if (ipRateLimits.containsKey(ip)) {
      long lastSubmit = ipRateLimits.get(ip);
      if (now - lastSubmit < RATE_LIMIT_COOLDOWN_MS) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .body("Error: Too many requests. Please wait a minute before sending another message.");
      }
    }

    // 3. Validation
    if (message.getName() == null
        || message.getName().trim().isEmpty()
        || message.getName().length() > 100) {
      return ResponseEntity.badRequest()
          .body("Error: Name is required and must be under 100 characters.");
    }
    if (message.getEmail() == null
        || message.getEmail().trim().isEmpty()
        || message.getEmail().length() > 100
        || !isValidEmail(message.getEmail())) {
      return ResponseEntity.badRequest()
          .body("Error: A valid email under 100 characters is required.");
    }
    if (message.getSubject() == null
        || message.getSubject().trim().isEmpty()
        || message.getSubject().length() > 200) {
      return ResponseEntity.badRequest()
          .body("Error: Subject is required and must be under 200 characters.");
    }
    if (message.getMessage() == null
        || message.getMessage().trim().isEmpty()
        || message.getMessage().length() > 5000) {
      return ResponseEntity.badRequest()
          .body("Error: Message is required and must be under 5000 characters.");
    }

    // Register IP submit time
    ipRateLimits.put(ip, now);

    ContactMessage saved = contactMessageRepository.save(message);
    log.info(
        "Contact message stored successfully: ID={}, email={}", saved.getId(), saved.getEmail());
    return ResponseEntity.status(HttpStatus.CREATED).body(saved);
  }

  @GetMapping("/messages")
  public ResponseEntity<?> getContactMessages(HttpServletRequest request) {
    String username = getAuthenticatedUser(request);
    if (username == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body("Error: Unauthorized. Please log in.");
    }
    return ResponseEntity.ok(contactMessageRepository.findAllByOrderByCreatedAtDesc());
  }

  @DeleteMapping("/messages/{id}")
  public ResponseEntity<?> deleteContactMessage(
      @PathVariable("id") Long id, HttpServletRequest request) {
    String username = getAuthenticatedUser(request);
    if (username == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body("Error: Unauthorized. Please log in.");
    }

    return contactMessageRepository
        .findById(id)
        .map(
            msg -> {
              contactMessageRepository.delete(msg);
              log.info("Contact message deleted successfully: ID={}, by={}", id, username);
              return ResponseEntity.ok().body("Message deleted successfully.");
            })
        .orElse(ResponseEntity.notFound().build());
  }

  private boolean isValidEmail(String email) {
    return email.matches("^[A-Za-z0-9+_.-]+@(.+)$");
  }

  private String getClientIp(HttpServletRequest request) {
    String xf = request.getHeader("X-Forwarded-For");
    if (xf != null && !xf.trim().isEmpty()) {
      return xf.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }

  // --------------------------------------------------------------------------
  // SECURITY & HELPER UTILITIES
  // --------------------------------------------------------------------------

  private String getAuthenticatedUser(HttpServletRequest request) {
    // Check for custom header or Apache-set OIDC header first
    String username = request.getHeader("OIDC_CLAIM_preferred_username");
    if (username != null && !username.trim().isEmpty()) {
      return username;
    }

    String forwardUser = request.getHeader("X-Forwarded-User");
    if (forwardUser != null && !forwardUser.trim().isEmpty()) {
      return forwardUser;
    }

    // Fallback: search for hutta_user cookie
    if (request.getCookies() != null) {
      for (Cookie cookie : request.getCookies()) {
        if ("hutta_user".equals(cookie.getName())) {
          String val = cookie.getValue();
          if (val != null) {
            if (val.startsWith("\"") && val.endsWith("\"")) {
              val = val.substring(1, val.length() - 1);
            }
            return val;
          }
        }
      }
    }

    // Dev bypass for local development/testing without apache
    String host = request.getHeader("Host");
    if (host != null && (host.contains("localhost") || host.contains("127.0.0.1"))) {
      return "Mukesh Joshi";
    }

    return null;
  }

  private String slugify(String input) {
    if (input == null || input.trim().isEmpty()) {
      return "post";
    }
    return input
        .toLowerCase()
        .replaceAll("[^a-z0-9\\s-]", "")
        .replaceAll("\\s+", "-")
        .replaceAll("-+", "-")
        .trim();
  }

  private String makeSlugUnique(String baseSlug, Long excludeId) {
    String currentSlug = baseSlug;
    int counter = 1;
    while (true) {
      Optional<BlogPost> existing = blogPostRepository.findBySlug(currentSlug);
      if (existing.isEmpty() || (excludeId != null && existing.get().getId().equals(excludeId))) {
        return currentSlug;
      }
      currentSlug = baseSlug + "-" + counter++;
    }
  }
}
