package nz.amldock.common.config;

import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String adminEmail;
    private final String adminPassword;
    private final String adminName;

    public DataSeeder(UserRepository users,
                      PasswordEncoder encoder,
                      @Value("${amldock.seed.admin-email}") String adminEmail,
                      @Value("${amldock.seed.admin-password}") String adminPassword,
                      @Value("${amldock.seed.admin-name}") String adminName) {
        this.users = users;
        this.encoder = encoder;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
    }

    @Override
    public void run(String... args) {
        if (users.existsByEmailIgnoreCase(adminEmail)) {
            return;
        }
        User admin = new User();
        admin.setEmail(adminEmail.toLowerCase());
        admin.setFullName(adminName);
        admin.setPasswordHash(encoder.encode(adminPassword));
        admin.setRole(Role.MANAGER);
        admin.setActive(true);
        users.save(admin);
        log.info("Seeded initial admin user: {}", adminEmail);
    }
}
