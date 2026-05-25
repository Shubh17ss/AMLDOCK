package nz.amldock.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import nz.amldock.auth.dto.AuthResponse;
import nz.amldock.auth.dto.LoginRequest;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req, HttpServletResponse response) {
        return auth.login(req.email(), req.password(), response);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        String raw = readCookie(request, AuthService.REFRESH_COOKIE);
        return auth.refresh(raw, response);
    }

    @PostMapping("/logout")
    public void logout(@AuthenticationPrincipal UserPrincipal principal,
                       HttpServletRequest request, HttpServletResponse response) {
        String raw = readCookie(request, AuthService.REFRESH_COOKIE);
        Long userId = principal == null ? null : principal.id();
        auth.logout(raw, userId, response);
    }

    @GetMapping("/me")
    public AuthResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return auth.me(principal.id());
    }

    private String readCookie(HttpServletRequest req, String name) {
        if (req.getCookies() == null) return null;
        for (Cookie c : req.getCookies()) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
