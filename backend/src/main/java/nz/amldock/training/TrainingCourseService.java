package nz.amldock.training;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.training.dto.CourseAttemptResultDto;
import nz.amldock.training.dto.CreateTrainingCourseRequest;
import nz.amldock.training.dto.SubmitCourseAttemptRequest;
import nz.amldock.training.dto.TrainingAttendeeDto;
import nz.amldock.training.dto.TrainingCourseDto;
import nz.amldock.training.dto.TrainingCourseFileDto;
import nz.amldock.training.dto.TrainingCourseFileUploadUrlRequest;
import nz.amldock.training.dto.TrainingCourseOptionDto;
import nz.amldock.training.dto.TrainingCourseQuestionDto;
import nz.amldock.training.dto.UpdateTrainingCourseRequest;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Training courses: material plus a questionnaire, assigned to branch staff.
 *
 * The list endpoint is role-aware exactly like {@link TrainingSessionService} — managers see
 * every course in the selected scope, staff see only their own assignments, only their own
 * roster row, and never the answer key.
 */
@Service
public class TrainingCourseService {

    private static final String ENTITY_TYPE = "TrainingCourse";

    private final TrainingCourseRepository courses;
    private final TrainingCourseFileRepository files;
    private final TrainingCourseQuestionRepository questions;
    private final TrainingCourseQuestionOptionRepository options;
    private final TrainingCourseAssigneeRepository assignees;
    private final UserRepository users;
    private final FirmBranchRepository branches;
    private final FileStorageService storage;
    private final AuditService audit;
    private final TrainingNotifier notifier;
    private final long maxBytes;
    private final Duration uploadTtl;
    private final Duration downloadTtl;

    public TrainingCourseService(TrainingCourseRepository courses,
                                 TrainingCourseFileRepository files,
                                 TrainingCourseQuestionRepository questions,
                                 TrainingCourseQuestionOptionRepository options,
                                 TrainingCourseAssigneeRepository assignees,
                                 UserRepository users,
                                 FirmBranchRepository branches,
                                 FileStorageService storage,
                                 AuditService audit,
                                 TrainingNotifier notifier,
                                 @Value("${S3_MAX_BYTES:26214400}") long maxBytes,
                                 @Value("${S3_UPLOAD_TTL_MINUTES:5}") long uploadTtlMinutes,
                                 @Value("${S3_DOWNLOAD_TTL_MINUTES:5}") long downloadTtlMinutes) {
        this.courses = courses;
        this.files = files;
        this.questions = questions;
        this.options = options;
        this.assignees = assignees;
        this.users = users;
        this.branches = branches;
        this.storage = storage;
        this.audit = audit;
        this.notifier = notifier;
        this.maxBytes = maxBytes;
        this.uploadTtl = Duration.ofMinutes(uploadTtlMinutes);
        this.downloadTtl = Duration.ofMinutes(downloadTtlMinutes);
    }

    /** Training managers get the scope's whole catalogue; everyone else gets their assignments. */
    @Transactional(readOnly = true)
    public List<TrainingCourseDto> list(Long requestedFirmId, Long branchId) {
        UserPrincipal actor = TrainingScope.currentPrincipal();

        List<TrainingCourse> rows;
        if (TrainingSessionService.isTrainingManager(actor.role())) {
            Long firmId = TrainingScope.resolveTargetFirm(actor, requestedFirmId);
            Long resolvedBranch = resolveBranch(branchId, firmId);
            rows = courses.findAllScoped(firmId, resolvedBranch);
        } else {
            Set<Long> mine = assignees.findAllByUserId(actor.id()).stream()
                    .map(TrainingCourseAssignee::getTrainingCourseId)
                    .collect(Collectors.toSet());
            rows = mine.isEmpty() ? List.of() : courses.findAllByIdInOrdered(mine);
        }
        return toDtos(rows, actor);
    }

    @Transactional
    public TrainingCourseDto create(CreateTrainingCourseRequest req) {
        UserPrincipal actor = TrainingScope.currentPrincipal();
        Long firmId = TrainingScope.resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);
        validateQuestions(req.questions());

        TrainingCourse c = new TrainingCourse();
        c.setName(req.name().trim());
        c.setDescription(trimToNull(req.description()));
        c.setDueDate(req.dueDate());
        c.setPassMarkPercent(req.passMarkPercent());
        c.setRealEstateFirmId(firmId);
        c.setFirmBranchId(branchId);
        c.setCreatedByUserId(actor.id());
        TrainingCourse saved = courses.save(c);

        replaceQuestions(saved, req.questions());
        // A brand-new course has no existing roster, so everyone added is newly assigned.
        List<Long> newlyAssigned = replaceRoster(saved, req.assigneeUserIds());
        notifyNewlyAssigned(saved, newlyAssigned);

        audit.record(AuditAction.TRAINING_COURSE_CREATED, ENTITY_TYPE, saved.getId(),
                "Created course " + saved.getName() + " for " + newlyAssigned.size() + " staff");
        return toDtos(List.of(saved), actor).get(0);
    }

    @Transactional
    public TrainingCourseDto update(Long id, UpdateTrainingCourseRequest req) {
        TrainingCourse c = mustLoad(id);
        UserPrincipal actor = TrainingScope.currentPrincipal();
        TrainingScope.assertSameFirm(actor, c.getRealEstateFirmId(), "course");

        if (req.name() != null && !req.name().isBlank()) c.setName(req.name().trim());
        if (req.description() != null) c.setDescription(trimToNull(req.description()));
        if (req.passMarkPercent() != null) c.setPassMarkPercent(req.passMarkPercent());
        // dueDate is replace-semantics, not "null means leave alone": the due date is optional
        // and clearing it is a real edit, which the usual null check would silently swallow.
        c.setDueDate(req.dueDate());

        // A supplied questionnaire or roster replaces the old one; omitting it changes nothing.
        if (req.questions() != null) {
            validateQuestions(req.questions());
            replaceQuestions(c, req.questions());
        }
        // Only the people this adds get an email — anyone already on the course is left alone.
        if (req.assigneeUserIds() != null) {
            notifyNewlyAssigned(c, replaceRoster(c, req.assigneeUserIds()));
        }

        audit.record(AuditAction.TRAINING_COURSE_UPDATED, ENTITY_TYPE, c.getId(),
                "Updated course " + c.getName());
        return toDtos(List.of(c), actor).get(0);
    }

    /** Deletes are restricted to ROOT and SENIOR_MANAGER (also gated by @PreAuthorize). */
    @Transactional
    public void delete(Long id) {
        TrainingCourse c = mustLoad(id);
        UserPrincipal actor = TrainingScope.currentPrincipal();
        if (actor.role() != Role.ROOT && actor.role() != Role.SENIOR_MANAGER) {
            throw new ForbiddenException("Only ROOT or a senior manager may delete a course");
        }
        if (actor.role() != Role.ROOT) {
            TrainingScope.assertSameFirm(actor, c.getRealEstateFirmId(), "course");
        }

        // Take the S3 objects out first — the rows are about to stop pointing at them.
        for (TrainingCourseFile f : files.findAllByTrainingCourseIdOrderByIdAsc(c.getId())) {
            if (f.getS3Key() != null) storage.delete(f.getS3Key());
        }
        // Children cascade in the DB; clear them here so the JPA context agrees.
        clearQuestions(c.getId());
        files.deleteAllByTrainingCourseId(c.getId());
        assignees.deleteAllByTrainingCourseId(c.getId());
        courses.delete(c);

        audit.record(AuditAction.TRAINING_COURSE_DELETED, ENTITY_TYPE, id,
                "Deleted course " + c.getName());
    }

    /* ---------- sitting the assessment ---------- */

    /**
     * Score one attempt. The client only ever sends which options it picked — it never receives
     * the answer key (see {@link #toDtos}) — so the marking happens here and nowhere else.
     *
     * Retakes are unlimited; the row holds the latest attempt. A pass is never un-set, so
     * someone who passed and later retook out of interest stays done.
     */
    @Transactional
    public CourseAttemptResultDto submitAttempt(Long courseId, SubmitCourseAttemptRequest req) {
        TrainingCourse c = mustLoad(courseId);
        UserPrincipal actor = TrainingScope.currentPrincipal();
        TrainingScope.assertSameFirm(actor, c.getRealEstateFirmId(), "course");

        TrainingCourseAssignee row = assignees
                .findByTrainingCourseIdAndUserId(c.getId(), actor.id())
                .orElseThrow(() -> new ForbiddenException("You are not assigned to this course"));

        List<TrainingCourseQuestion> qs = questions.findAllByTrainingCourseIdOrderByPositionAsc(c.getId());
        int total = qs.size();
        int correct;

        if (total == 0) {
            // Material-only course: there is nothing to mark, so reading it is the completion.
            correct = 0;
        } else {
            Map<Long, Set<Long>> submitted = new HashMap<>();
            for (SubmitCourseAttemptRequest.AnswerInput a : (req.answers() == null ? List.<SubmitCourseAttemptRequest.AnswerInput>of() : req.answers())) {
                if (a == null || a.questionId() == null) continue;
                submitted.put(a.questionId(), a.selectedOptionIds() == null
                        ? Set.of()
                        : a.selectedOptionIds().stream().filter(Objects::nonNull).collect(Collectors.toSet()));
            }

            Map<Long, List<TrainingCourseQuestionOption>> optionsByQuestion = options
                    .findAllByQuestionIdInOrderByPositionAsc(qs.stream().map(TrainingCourseQuestion::getId).toList())
                    .stream().collect(Collectors.groupingBy(TrainingCourseQuestionOption::getQuestionId));

            int scored = 0;
            for (TrainingCourseQuestion q : qs) {
                List<TrainingCourseQuestionOption> opts = optionsByQuestion.getOrDefault(q.getId(), List.of());
                Set<Long> valid = opts.stream()
                        .map(TrainingCourseQuestionOption::getId).collect(Collectors.toSet());
                Set<Long> expected = opts.stream().filter(TrainingCourseQuestionOption::isCorrect)
                        .map(TrainingCourseQuestionOption::getId).collect(Collectors.toSet());

                // Narrow to ids that actually belong to this question, so a stray or foreign
                // option id can't manufacture a mark.
                Set<Long> picked = new HashSet<>(submitted.getOrDefault(q.getId(), Set.of()));
                picked.retainAll(valid);

                // Set equality: a multi-choice answer has to be exactly right. No partial credit,
                // which is what keeps the pass mark meaningful over a handful of questions.
                if (picked.equals(expected)) scored++;
            }
            correct = scored;
        }

        int scorePercent = total == 0 ? 100 : (int) Math.round(correct * 100.0 / total);
        boolean passed = scorePercent >= c.getPassMarkPercent();

        row.setScorePercent(scorePercent);
        row.setPassed(passed);
        row.setAttemptCount(row.getAttemptCount() + 1);
        row.setLastAttemptAt(Instant.now());
        if (passed && row.getCompletedAt() == null) {
            row.setCompletedAt(Instant.now());
            audit.record(AuditAction.TRAINING_COURSE_COMPLETED, ENTITY_TYPE, c.getId(),
                    actor.email() + " passed " + c.getName() + " with " + scorePercent + "%");
        }
        audit.record(AuditAction.TRAINING_COURSE_ATTEMPTED, ENTITY_TYPE, c.getId(),
                actor.email() + " scored " + scorePercent + "% on " + c.getName()
                        + " (attempt " + row.getAttemptCount() + ")");

        return new CourseAttemptResultDto(scorePercent, passed, c.getPassMarkPercent(),
                correct, total, row.getAttemptCount(), row.getCompletedAt());
    }

    /* ---------- content files ---------- */

    /**
     * Presign a piece of course material.
     *
     * Deliberately no content-type guard: slides, spreadsheets, images and video are all
     * legitimate training material. Only the size cap applies, matching
     * {@link nz.amldock.document.DocumentService}.
     */
    @Transactional
    public UploadUrlResponse presignUpload(Long courseId, TrainingCourseFileUploadUrlRequest req) {
        if (req.sizeBytes() > maxBytes) {
            throw new BadRequestException("File exceeds " + (maxBytes / 1024 / 1024) + " MB limit");
        }
        TrainingCourse c = mustLoad(courseId);
        UserPrincipal actor = TrainingScope.currentPrincipal();
        TrainingScope.assertSameFirm(actor, c.getRealEstateFirmId(), "course");

        TrainingCourseFile f = new TrainingCourseFile();
        f.setTrainingCourseId(c.getId());
        f.setOriginalFilename(req.filename());
        f.setContentType(req.contentType());
        f.setSizeBytes(req.sizeBytes());
        f.setDocumentStatus(DocumentStatus.PENDING);
        f.setUploadedByUserId(actor.id());
        f.setS3Key(buildKey(c.getRealEstateFirmId(), c.getId(), req.filename()));
        TrainingCourseFile saved = files.save(f);

        String url = storage.presignUpload(saved.getS3Key(), req.contentType(), uploadTtl);
        return new UploadUrlResponse(saved.getId(), saved.getS3Key(), url,
                req.contentType(), (int) uploadTtl.toSeconds());
    }

    @Transactional
    public TrainingCourseFileDto confirmUpload(Long courseId, Long fileId) {
        TrainingCourse c = mustLoad(courseId);
        UserPrincipal actor = TrainingScope.currentPrincipal();
        TrainingScope.assertSameFirm(actor, c.getRealEstateFirmId(), "course");
        TrainingCourseFile f = mustLoadFile(courseId, fileId);

        if (f.getDocumentStatus() == DocumentStatus.ACTIVE) {
            return toFileDto(f); // idempotent
        }
        if (!storage.exists(f.getS3Key())) {
            throw new BadRequestException("Object not found in S3 yet — was the upload successful?");
        }
        long actualSize = storage.size(f.getS3Key());
        if (f.getSizeBytes() == null || actualSize != f.getSizeBytes()) {
            f.setSizeBytes(actualSize);
        }
        f.setDocumentStatus(DocumentStatus.ACTIVE);

        audit.record(AuditAction.DOCUMENT_UPLOADED, ENTITY_TYPE, c.getId(),
                "Attached " + f.getOriginalFilename() + " to course " + c.getName());
        return toFileDto(f);
    }

    // Not readOnly — writes a DOCUMENT_DOWNLOADED audit row.
    @Transactional
    public DownloadUrlResponse presignDownload(Long courseId, Long fileId) {
        TrainingCourse c = mustLoad(courseId);
        UserPrincipal actor = TrainingScope.currentPrincipal();
        TrainingScope.assertSameFirm(actor, c.getRealEstateFirmId(), "course");
        TrainingCourseFile f = mustLoadFile(courseId, fileId);

        if (f.getDocumentStatus() != DocumentStatus.ACTIVE || f.getS3Key() == null) {
            throw new NotFoundException("That file has not finished uploading");
        }
        String url = storage.presignDownload(f.getS3Key(), f.getOriginalFilename(), downloadTtl);
        audit.record(AuditAction.DOCUMENT_DOWNLOADED, ENTITY_TYPE, c.getId(),
                "Download URL issued for " + f.getOriginalFilename());
        return new DownloadUrlResponse(url, (int) downloadTtl.toSeconds());
    }

    /** Removing material you attached is authoring, so the compliance officer may do it too. */
    @Transactional
    public void deleteFile(Long courseId, Long fileId) {
        TrainingCourse c = mustLoad(courseId);
        UserPrincipal actor = TrainingScope.currentPrincipal();
        TrainingScope.assertSameFirm(actor, c.getRealEstateFirmId(), "course");
        TrainingCourseFile f = mustLoadFile(courseId, fileId);

        if (f.getS3Key() != null) storage.delete(f.getS3Key());
        files.delete(f);
        audit.record(AuditAction.DOCUMENT_DELETED, ENTITY_TYPE, c.getId(),
                "Removed " + f.getOriginalFilename() + " from course " + c.getName());
    }

    /* ---------- helpers ---------- */

    private TrainingCourse mustLoad(Long id) {
        return courses.findById(id)
                .orElseThrow(() -> new NotFoundException("Course " + id + " not found"));
    }

    private TrainingCourseFile mustLoadFile(Long courseId, Long fileId) {
        TrainingCourseFile f = files.findById(fileId)
                .orElseThrow(() -> new NotFoundException("File " + fileId + " not found"));
        if (!f.getTrainingCourseId().equals(courseId)) {
            throw new NotFoundException("File " + fileId + " does not belong to course " + courseId);
        }
        return f;
    }

    /**
     * The questionnaire rules. Both kinds of question are auto-scorable, which only holds if
     * every question actually has an answer key.
     */
    private static void validateQuestions(List<CreateTrainingCourseRequest.QuestionInput> input) {
        if (input == null || input.isEmpty()) return;
        int n = 0;
        for (CreateTrainingCourseRequest.QuestionInput q : input) {
            n++;
            if (q == null || q.prompt() == null || q.prompt().isBlank()) {
                throw new BadRequestException("Question " + n + " needs a prompt");
            }
            List<CreateTrainingCourseRequest.OptionInput> opts = q.options() == null ? List.of() : q.options();
            if (opts.size() < 2) {
                throw new BadRequestException("Question " + n + " needs at least two options");
            }
            if (opts.stream().anyMatch((o) -> o.label() == null || o.label().isBlank())) {
                throw new BadRequestException("Question " + n + " has an empty option");
            }
            long correct = opts.stream().filter(CreateTrainingCourseRequest.OptionInput::correct).count();
            if (q.questionType() == QuestionType.SINGLE_CHOICE && correct != 1) {
                throw new BadRequestException(
                        "Question " + n + " is single-choice and needs exactly one correct option");
            }
            if (q.questionType() == QuestionType.MULTI_CHOICE && correct < 1) {
                throw new BadRequestException(
                        "Question " + n + " needs at least one correct option");
            }
        }
    }

    /** Replace the whole questionnaire. Positions come from list order, so gaps are impossible. */
    private void replaceQuestions(TrainingCourse course,
                                  List<CreateTrainingCourseRequest.QuestionInput> input) {
        clearQuestions(course.getId());
        if (input == null || input.isEmpty()) return;

        int position = 0;
        for (CreateTrainingCourseRequest.QuestionInput qi : input) {
            TrainingCourseQuestion q = new TrainingCourseQuestion();
            q.setTrainingCourseId(course.getId());
            q.setPosition(position++);
            q.setQuestionType(qi.questionType());
            q.setPrompt(qi.prompt().trim());
            TrainingCourseQuestion savedQuestion = questions.save(q);

            int optionPosition = 0;
            List<TrainingCourseQuestionOption> batch = new ArrayList<>();
            for (CreateTrainingCourseRequest.OptionInput oi : qi.options()) {
                TrainingCourseQuestionOption o = new TrainingCourseQuestionOption();
                o.setQuestionId(savedQuestion.getId());
                o.setPosition(optionPosition++);
                o.setLabel(oi.label().trim());
                o.setCorrect(oi.correct());
                batch.add(o);
            }
            options.saveAll(batch);
        }
    }

    private void clearQuestions(Long courseId) {
        List<Long> questionIds = questions.findAllByTrainingCourseIdOrderByPositionAsc(courseId)
                .stream().map(TrainingCourseQuestion::getId).toList();
        if (!questionIds.isEmpty()) options.deleteAllByQuestionIdIn(questionIds);
        questions.deleteAllByTrainingCourseId(courseId);
    }

    /**
     * Replace the roster, preserving completion for anyone who stays assigned. The eligibility
     * rule lives in {@link TrainingScope#assertAssignable} so courses and sessions can't drift.
     */
    private List<Long> replaceRoster(TrainingCourse course, List<Long> requestedUserIds) {
        Set<Long> wanted = requestedUserIds == null
                ? Set.of()
                : new LinkedHashSet<>(requestedUserIds.stream().filter(Objects::nonNull).toList());

        TrainingScope.assertAssignable(users, course.getRealEstateFirmId(),
                course.getFirmBranchId(), wanted);

        List<TrainingCourseAssignee> existing = assignees.findAllByTrainingCourseId(course.getId());
        Set<Long> existingIds = existing.stream()
                .map(TrainingCourseAssignee::getUserId).collect(Collectors.toSet());

        List<TrainingCourseAssignee> removed = existing.stream()
                .filter((a) -> !wanted.contains(a.getUserId())).toList();
        if (!removed.isEmpty()) assignees.deleteAll(removed);

        List<TrainingCourseAssignee> added = new ArrayList<>();
        for (Long userId : wanted) {
            if (existingIds.contains(userId)) continue;
            TrainingCourseAssignee a = new TrainingCourseAssignee();
            a.setTrainingCourseId(course.getId());
            a.setUserId(userId);
            added.add(a);
        }
        if (!added.isEmpty()) assignees.saveAll(added);

        // The newly-inserted user ids, which is exactly who should be emailed: on create that's
        // everyone, and on edit it's only the people who weren't already on the roster.
        return added.stream().map(TrainingCourseAssignee::getUserId).toList();
    }

    /**
     * Email the people just added to this course — after the transaction commits.
     *
     * The send is @Async, so dispatching inline would let mail escape a rollback and tell staff
     * about a course that no longer exists. Recipients and the question count are resolved here,
     * while the persistence context is still open.
     */
    private void notifyNewlyAssigned(TrainingCourse course, List<Long> newUserIds) {
        if (newUserIds.isEmpty()) return;
        List<User> recipients = users.findAllById(newUserIds);
        if (recipients.isEmpty()) return;
        int questionCount = questions.findAllByTrainingCourseIdOrderByPositionAsc(course.getId()).size();

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            notifier.notifyCourseAssigned(course, questionCount, recipients);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                notifier.notifyCourseAssigned(course, questionCount, recipients);
            }
        });
    }

    /** A branch tag must belong to the target firm; null means firm-wide. */
    private Long resolveBranch(Long branchId, Long firmId) {
        if (branchId == null) return null;
        if (firmId == null) throw new BadRequestException("A branch requires a firm");
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new BadRequestException("Branch " + branchId + " not found"));
        if (!firmId.equals(branch.getRealEstateFirmId())) {
            throw new BadRequestException("Branch does not belong to this firm");
        }
        return branch.getId();
    }

    private TrainingCourseFileDto toFileDto(TrainingCourseFile f) {
        String email = users.findById(f.getUploadedByUserId()).map(User::getEmail).orElse(null);
        return TrainingCourseFileDto.from(f, email);
    }

    /**
     * Assemble DTOs for a page of courses with a fixed number of queries — one each for files,
     * questions, options, rosters, users and branches.
     */
    private List<TrainingCourseDto> toDtos(List<TrainingCourse> rows, UserPrincipal actor) {
        if (rows.isEmpty()) return List.of();
        boolean manager = TrainingSessionService.isTrainingManager(actor.role());

        List<Long> courseIds = rows.stream().map(TrainingCourse::getId).toList();

        Map<Long, List<TrainingCourseFile>> filesByCourse = files
                .findAllByTrainingCourseIdInAndDocumentStatus(courseIds, DocumentStatus.ACTIVE).stream()
                .collect(Collectors.groupingBy(TrainingCourseFile::getTrainingCourseId));

        List<TrainingCourseQuestion> allQuestions =
                questions.findAllByTrainingCourseIdInOrderByPositionAsc(courseIds);
        Map<Long, List<TrainingCourseQuestion>> questionsByCourse = allQuestions.stream()
                .collect(Collectors.groupingBy(TrainingCourseQuestion::getTrainingCourseId));
        List<Long> questionIds = allQuestions.stream().map(TrainingCourseQuestion::getId).toList();
        Map<Long, List<TrainingCourseQuestionOption>> optionsByQuestion = questionIds.isEmpty()
                ? Map.of()
                : options.findAllByQuestionIdInOrderByPositionAsc(questionIds).stream()
                        .collect(Collectors.groupingBy(TrainingCourseQuestionOption::getQuestionId));

        Map<Long, List<TrainingCourseAssignee>> rosters = assignees
                .findAllByTrainingCourseIdIn(courseIds).stream()
                .collect(Collectors.groupingBy(TrainingCourseAssignee::getTrainingCourseId));

        Set<Long> userIds = new HashSet<>();
        rosters.values().forEach((list) -> list.forEach((a) -> userIds.add(a.getUserId())));
        filesByCourse.values().forEach((list) -> list.forEach((f) -> userIds.add(f.getUploadedByUserId())));
        rows.forEach((c) -> userIds.add(c.getCreatedByUserId()));
        Map<Long, User> userById = userIds.isEmpty() ? Map.of()
                : users.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));

        Set<Long> branchIds = rows.stream()
                .map(TrainingCourse::getFirmBranchId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, FirmBranch> branchById = branchIds.isEmpty() ? Map.of()
                : branches.findAllById(branchIds).stream()
                        .collect(Collectors.toMap(FirmBranch::getId, Function.identity()));

        List<TrainingCourseDto> out = new ArrayList<>(rows.size());
        for (TrainingCourse c : rows) {
            List<TrainingCourseAssignee> roster = rosters.getOrDefault(c.getId(), List.of());
            int assigned = roster.size();
            int completed = (int) roster.stream().filter((a) -> a.getCompletedAt() != null).count();

            Optional<TrainingCourseAssignee> mine = roster.stream()
                    .filter((a) -> a.getUserId().equals(actor.id())).findFirst();

            // Staff see only their own row — the roster is a manager's view.
            List<TrainingCourseAssignee> visible = manager ? roster : mine.map(List::of).orElse(List.of());
            List<TrainingAttendeeDto> assigneeDtos = visible.stream()
                    .map((a) -> {
                        User u = userById.get(a.getUserId());
                        return new TrainingAttendeeDto(a.getUserId(),
                                u == null ? null : u.getFullName(),
                                u == null ? null : u.getEmail(),
                                u == null ? null : u.getRole(),
                                a.getCompletedAt(), a.getScorePercent(), a.getPassed());
                    })
                    .sorted(Comparator.comparing(
                            (TrainingAttendeeDto d) -> d.fullName() == null ? "" : d.fullName(),
                            String.CASE_INSENSITIVE_ORDER))
                    .toList();

            List<TrainingCourseFileDto> fileDtos = filesByCourse.getOrDefault(c.getId(), List.of())
                    .stream()
                    .map((f) -> {
                        User u = userById.get(f.getUploadedByUserId());
                        return TrainingCourseFileDto.from(f, u == null ? null : u.getEmail());
                    })
                    .toList();

            List<TrainingCourseQuestionDto> questionDtos =
                    questionsByCourse.getOrDefault(c.getId(), List.of()).stream()
                            .map((q) -> new TrainingCourseQuestionDto(
                                    q.getId(), q.getPosition(), q.getQuestionType(), q.getPrompt(),
                                    optionsByQuestion.getOrDefault(q.getId(), List.of()).stream()
                                            .map((o) -> new TrainingCourseOptionDto(
                                                    o.getId(), o.getPosition(), o.getLabel(),
                                                    // The answer key never leaves the building
                                                    // for anyone who might be sitting the course.
                                                    manager ? o.isCorrect() : null))
                                            .toList()))
                            .toList();

            FirmBranch b = c.getFirmBranchId() == null ? null : branchById.get(c.getFirmBranchId());
            User creator = userById.get(c.getCreatedByUserId());

            out.add(TrainingCourseDto.from(c,
                    b == null ? null : b.getName(),
                    creator == null ? null : creator.getEmail(),
                    fileDtos, questionDtos, assigneeDtos, assigned, completed,
                    mine.isPresent(),
                    mine.map(TrainingCourseAssignee::getCompletedAt).orElse(null),
                    mine.map(TrainingCourseAssignee::getScorePercent).orElse(null),
                    mine.map(TrainingCourseAssignee::getPassed).orElse(null),
                    mine.map(TrainingCourseAssignee::getAttemptCount).orElse(0)));
        }
        return out;
    }

    private String buildKey(Long firmId, Long courseId, String filename) {
        String sanitised = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        String scope = firmId == null ? "platform" : "firms/" + firmId;
        return "training-courses/" + scope + "/" + courseId + "/" + UUID.randomUUID() + "-" + sanitised;
    }

    private static String trimToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
