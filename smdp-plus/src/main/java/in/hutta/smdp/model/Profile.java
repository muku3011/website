package in.hutta.smdp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Profile {
    @Id
    private String iccid;
    private String eid;
    private String state; // AVAILABLE, ORDERED, RELEASED, DOWNLOADED
    
    @Column(columnDefinition = "TEXT")
    private String profilePayload; // Base64 mock BPP or profile bytes
}
