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
                      @Value("${amldock.seed.admin-email:}") String adminEmail,
                      @Value("${amldock.seed.admin-password:}") String adminPassword,
                      @Value("${amldock.seed.admin-name:Shubh Sharma}") String adminName) {
        this.users = users;
        this.encoder = encoder;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
    }

    /**
     * The password this class used to fall back to. It is public in git history, so a ROOT seeded
     * with it is an open door; it is refused like a blank one.
     */
    static final String RETIRED_DEFAULT_PASSWORD = "Admin123!";

    /**
     * Seeds the first ROOT, and only from credentials the deployment chose. There is no source
     * default any more: a fresh database started without SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD
     * gets no ROOT and a warning, rather than an administrator anyone could look up.
     */
    @Override
    public void run(String... args) {
        if (adminEmail == null || adminEmail.isBlank()) {
            log.warn("No ROOT seeded: SEED_ADMIN_EMAIL is not set");
            return;
        }
        if (users.existsByEmailIgnoreCase(adminEmail)) {
            return;
        }
        if (adminPassword == null || adminPassword.isBlank() || RETIRED_DEFAULT_PASSWORD.equals(adminPassword)) {
            log.warn("No ROOT seeded: set SEED_ADMIN_PASSWORD to a new value (blank and the retired default are refused)");
            return;
        }
        User admin = new User();
        admin.setEmail(adminEmail.toLowerCase());
        admin.setFullName(adminName);
        admin.setPasswordHash(encoder.encode(adminPassword));
        admin.setRole(Role.ROOT);
        admin.setActive(true);
        users.save(admin);
        log.info("Seeded initial ROOT user: {}", adminEmail);
    }
}
