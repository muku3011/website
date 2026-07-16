package in.hutta.blog.repository;

import in.hutta.blog.model.ContactMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ContactMessageRepository extends JpaRepository<ContactMessage, Long> {
  List<ContactMessage> findAllByOrderByCreatedAtDesc();
}
