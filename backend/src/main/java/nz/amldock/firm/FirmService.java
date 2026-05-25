package nz.amldock.firm;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.dto.CreateFirmRequest;
import nz.amldock.firm.dto.UpdateFirmRequest;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FirmService {

    private final RealEstateFirmRepository firms;

    public FirmService(RealEstateFirmRepository firms) {
        this.firms = firms;
    }

    @Transactional(readOnly = true)
    public List<RealEstateFirm> listVisible() {
        UserPrincipal principal = currentPrincipal();
        if (principal != null && principal.role() == Role.FIRM_USER) {
            return firms.findById(principal.realEstateFirmId())
                    .map(List::of)
                    .orElseGet(List::of);
        }
        return firms.findAllByOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public RealEstateFirm findById(Long id) {
        RealEstateFirm f = firms.findById(id)
                .orElseThrow(() -> new NotFoundException("Firm " + id + " not found"));
        assertVisible(f.getId());
        return f;
    }

    @Transactional
    public RealEstateFirm create(CreateFirmRequest req) {
        if (firms.existsByNameIgnoreCase(req.name())) {
            throw new BadRequestException("Firm name already in use");
        }
        RealEstateFirm f = new RealEstateFirm();
        f.setName(req.name());
        f.setTradingName(req.tradingName());
        f.setNzbn(req.nzbn());
        f.setHeadOfficeAddress(req.headOfficeAddress());
        f.setContactEmail(req.contactEmail());
        f.setContactPhone(req.contactPhone());
        f.setActive(true);
        return firms.save(f);
    }

    @Transactional
    public RealEstateFirm update(Long id, UpdateFirmRequest req) {
        RealEstateFirm f = firms.findById(id)
                .orElseThrow(() -> new NotFoundException("Firm " + id + " not found"));
        if (req.name() != null && !req.name().isBlank() && !req.name().equalsIgnoreCase(f.getName())) {
            if (firms.existsByNameIgnoreCase(req.name())) {
                throw new BadRequestException("Firm name already in use");
            }
            f.setName(req.name());
        }
        if (req.tradingName() != null) f.setTradingName(req.tradingName());
        if (req.nzbn() != null) f.setNzbn(req.nzbn());
        if (req.headOfficeAddress() != null) f.setHeadOfficeAddress(req.headOfficeAddress());
        if (req.contactEmail() != null) f.setContactEmail(req.contactEmail());
        if (req.contactPhone() != null) f.setContactPhone(req.contactPhone());
        if (req.active() != null) f.setActive(req.active());
        return f;
    }

    /** Throws if the current user is a FIRM_USER for a different firm. */
    public void assertVisible(Long firmId) {
        UserPrincipal principal = currentPrincipal();
        if (principal != null
                && principal.role() == Role.FIRM_USER
                && !firmId.equals(principal.realEstateFirmId())) {
            throw new ForbiddenException("Access to firm " + firmId + " denied");
        }
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) {
            return up;
        }
        return null;
    }
}
