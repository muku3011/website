package in.hutta.smdp.util;

import org.bouncycastle.crypto.generators.Argon2BytesGenerator;
import org.bouncycastle.crypto.params.Argon2Parameters;
import java.security.SecureRandom;
import java.util.Base64;

public class Argon2Hasher {

    public static String hash(String password) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        byte[] passwordBytes = password.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        Argon2Parameters params = new Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
                .withVersion(Argon2Parameters.ARGON2_VERSION_13)
                .withIterations(3)
                .withMemoryAsKB(65536)
                .withParallelism(4)
                .withSalt(salt)
                .build();

        Argon2BytesGenerator gen = new Argon2BytesGenerator();
        gen.init(params);
        byte[] result = new byte[32];
        gen.generateBytes(passwordBytes, result, 0, result.length);

        String saltB64 = Base64.getEncoder().withoutPadding().encodeToString(salt);
        String resultB64 = Base64.getEncoder().withoutPadding().encodeToString(result);

        return String.format("$argon2id$v=19$m=65536,t=3,p=4$%s$%s", saltB64, resultB64);
    }
}
