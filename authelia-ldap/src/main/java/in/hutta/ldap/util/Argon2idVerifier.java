package in.hutta.ldap.util;

import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;

public class Argon2idVerifier {

    private static final Argon2PasswordEncoder encoder = new Argon2PasswordEncoder(16, 32, 4, 65536, 3);

    public static String hash(String password) {
        return encoder.encode(password);
    }

    public static boolean verify(String rawPassword, String hashedPassword) {
        // Authelia sometimes outputs the hash with or without the prefix in the LDAP server.
        // Spring Security encoder matches standard $argon2id$ hashes.
        return encoder.matches(rawPassword, hashedPassword);
    }
}
