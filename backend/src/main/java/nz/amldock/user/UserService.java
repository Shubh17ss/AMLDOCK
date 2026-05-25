package nz.amldock.user;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.dto.CreateUserRequest;
import nz.amldock.user.dto.UpdateUserRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository users;
    private final RealEstateFirmRepository firms;
    private final PasswordEncoder encoder;

    public UserService(UserRepository users, RealEstateFirmRepository firms, PasswordEncoder encoder) {
        this.users = users;
        this.firms = firms;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public List<User> findAll() {
        return users.findAll();
    }

    @Transactional(readOnly = true)
    public User findById(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    @Transactional
    public User create(CreateUserRequest req) {
        if (users.existsByEmailIgnoreCase(req.email())) {
            throw new BadRequestException("Email already in use");
        }
        validateFirmLinkage(req.role(), req.realEstateFirmId());

        User u = new User();
        u.setEmail(req.email().toLowerCase());
        u.setFullName(req.fullName());
        u.setRole(req.role());
        u.setRealEstateFirmId(req.realEstateFirmId());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setActive(true);
        return users.save(u);
    }

    @Transactional
    public User update(Long id, UpdateUserRequest req) {
        User u = findById(id);
        if (req.fullName() != null && !req.fullName().isBlank()) {
            u.setFullName(req.fullName());
        }
        if (req.role() != null) {
            u.setRole(req.role());
            u.setRealEstateFirmId(req.realEstateFirmId());
        }
        if (req.active() != null) {
            u.setActive(req.active());
        }
        validateFirmLinkage(u.getRole(), u.getRealEstateFirmId());
        return u;
    }

    @Transactional
    public void resetPassword(Long id, String newPassword) {
        User u = findById(id);
        u.setPasswordHash(encoder.encode(newPassword));
    }

    @Transactional
    public void changeOwnPassword(Long id, String currentPassword, String newPassword) {
        User u = findById(id);
        if (!encoder.matches(currentPassword, u.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(newPassword));
    }

    private void validateFirmLinkage(Role role, Long firmId) {
        boolean isFirmUser = role == Role.FIRM_USER;
        if (isFirmUser && firmId == null) {
            throw new BadRequestException("FIRM_USER requires realEstateFirmId");
        }
        if (!isFirmUser && firmId != null) {
            throw new BadRequestException("Only FIRM_USER may have realEstateFirmId");
        }
        if (isFirmUser) {
            RealEstateFirm firm = firms.findById(firmId)
                    .orElseThrow(() -> new BadRequestException("Real-estate firm " + firmId + " not found"));
            if (!firm.isActive()) {
                throw new BadRequestException("Real-estate firm " + firmId + " is inactive");
            }
        }
    }
}
