package nz.amldock.dealnote;

import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.dealnote.dto.DealNoteDto;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentRepository;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.DocumentType;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The deal's notes timeline: the broker's opening note, reviewers' comments, and one entry per
 * state change, in the order they happened.
 *
 * <p>Authorisation is the caller's job. {@code DealController} resolves the deal and runs
 * {@code DealLifecycleService.assertCanRead} before anything here is invoked — a note is exactly
 * as readable as the deal it belongs to.
 */
@Service
public class DealNoteService {

    private final DealNoteRepository notes;
    private final DocumentRepository documents;
    private final UserRepository users;

    public DealNoteService(DealNoteRepository notes, DocumentRepository documents, UserRepository users) {
        this.notes = notes;
        this.documents = documents;
        this.users = users;
    }

    /** Records a state change. Called by DealService inside the transition's transaction. */
    @Transactional
    public DealNote appendTransition(Deal deal, UserPrincipal actor, String body,
                                     DealStatus from, DealStatus to) {
        // Not every verb carries a note (handover, start review, close). Those are visible in the
        // audit log; the timeline is for what people actually wrote.
        if (body == null || body.isBlank()) return null;
        return save(deal.getId(), actor.id(), body, from, to);
    }

    /** Records a free comment — no state change. */
    @Transactional
    public DealNote appendComment(Deal deal, UserPrincipal actor, String body) {
        return save(deal.getId(), actor.id(), body, null, null);
    }

    private DealNote save(Long dealId, Long authorId, String body, DealStatus from, DealStatus to) {
        DealNote n = new DealNote();
        n.setDealId(dealId);
        n.setAuthorUserId(authorId);
        n.setBody(body.trim());
        n.setStatusFrom(from);
        n.setStatusTo(to);
        return notes.save(n);
    }

    /**
     * The whole timeline, oldest first.
     *
     * <p>The opening entry is synthesised from the deal rather than read from {@code deal_note}.
     * That keeps the broker's note editable while the deal is NEW without the timeline either
     * double-posting on a re-handover or needing clearing logic that can drift from the field.
     */
    @Transactional(readOnly = true)
    public List<DealNoteDto> timeline(Deal deal) {
        List<DealNote> rows = notes.findAllByDealIdOrderByCreatedAtAsc(deal.getId());

        List<Long> authorIds = new ArrayList<>(rows.stream().map(DealNote::getAuthorUserId).distinct().toList());
        if (!authorIds.contains(deal.getCreatedByUserId())) authorIds.add(deal.getCreatedByUserId());
        Map<Long, User> byId = users.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<DealNoteDto> out = new ArrayList<>();

        // The broker's note opens the thread, attributed to whoever created the deal and
        // timestamped when they did. Shown even when empty-bodied but carrying a recording, so a
        // voice-only note is not silently dropped.
        Long voiceId = latestVoiceNoteId(deal.getId());
        boolean hasOpening = (deal.getNotes() != null && !deal.getNotes().isBlank()) || voiceId != null;
        if (hasOpening) {
            User author = byId.get(deal.getCreatedByUserId());
            out.add(new DealNoteDto(
                    null, DealNoteDto.CREATION,
                    deal.getCreatedByUserId(),
                    author == null ? null : author.getFullName(),
                    author == null ? null : author.getEmail(),
                    deal.getNotes(),
                    null, null,
                    voiceId,
                    deal.getCreatedAt()));
        }

        rows.forEach(n -> {
            User a = byId.get(n.getAuthorUserId());
            out.add(new DealNoteDto(
                    n.getId(),
                    n.getStatusTo() == null ? DealNoteDto.COMMENT : DealNoteDto.TRANSITION,
                    n.getAuthorUserId(),
                    a == null ? null : a.getFullName(),
                    a == null ? null : a.getEmail(),
                    n.getBody(),
                    n.getStatusFrom(), n.getStatusTo(),
                    null,
                    n.getCreatedAt()));
        });

        // The opening entry carries the deal's creation timestamp, and a note written seconds
        // later can round to the same instant, so sort explicitly rather than trusting insertion
        // order to hold.
        out.sort(Comparator.comparing(DealNoteDto::createdAt));
        return out;
    }

    /**
     * The deal's most recent broker voice note.
     *
     * <p>VOICE_NOTE only — VOICE_NOTE_PURPOSE answers the section 2 transaction-purpose question
     * and belongs with that field, not in the conversation.
     */
    private Long latestVoiceNoteId(Long dealId) {
        return documents.findAllByDealIdAndStatusOrderByCreatedAtDesc(dealId, DocumentStatus.ACTIVE)
                .stream()
                .filter(d -> d.getDocumentType() == DocumentType.VOICE_NOTE)
                .map(Document::getId)
                .findFirst()
                .orElse(null);
    }
}
