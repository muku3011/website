package in.hutta.eim.repository;

import in.hutta.eim.model.IotDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IotDeviceRepository extends JpaRepository<IotDevice, String> {}
