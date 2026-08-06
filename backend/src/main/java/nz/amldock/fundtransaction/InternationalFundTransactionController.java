package nz.amldock.fundtransaction;

import jakarta.validation.Valid;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.fundtransaction.dto.CreateFundTransactionRequest;
import nz.amldock.fundtransaction.dto.FundTransactionDto;
import nz.amldock.fundtransaction.dto.FundTransactionUploadUrlRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/international-fund-transactions")
public class InternationalFundTransactionController {

    private final InternationalFundTransactionService transactions;

    public InternationalFundTransactionController(InternationalFundTransactionService transactions) {
        this.transactions = transactions;
    }

    @GetMapping
    public List<FundTransactionDto> list(@RequestParam(required = false) Long firmId,
                                        @RequestParam(required = false) Long branchId) {
        return transactions.list(firmId, branchId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER','FINANCE')")
    public FundTransactionDto create(@Valid @RequestBody CreateFundTransactionRequest req) {
        return transactions.create(req);
    }

    @PostMapping("/{id}/upload-url")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER','FINANCE')")
    public UploadUrlResponse presignUpload(@PathVariable Long id,
                                          @Valid @RequestBody FundTransactionUploadUrlRequest req) {
        return transactions.presignUpload(id, req);
    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER','FINANCE')")
    public FundTransactionDto confirmUpload(@PathVariable Long id) {
        return transactions.confirmUpload(id);
    }

    @GetMapping("/{id}/download-url")
    public DownloadUrlResponse downloadUrl(@PathVariable Long id) {
        return transactions.presignDownload(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        transactions.delete(id);
        return ResponseEntity.noContent().build();
    }
}
