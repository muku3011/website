package in.hutta.blog.repository;

import in.hutta.blog.model.BlogPost;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BlogPostRepository extends JpaRepository<BlogPost, Long> {
  Optional<BlogPost> findBySlug(String slug);

  List<BlogPost> findAllByOrderByCreatedAtDesc();
}
