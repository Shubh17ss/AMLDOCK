package nz.amldock.report.dto;

import java.time.Instant;
import java.util.List;

/**
 * Staff training for the report's firm or branch.
 *
 * <p>Courses are obligations, so they are reported as they stand today: assigned, passed and
 * overdue. Sessions are events, so only those dated inside the window count.
 */
public record TrainingReportDto(Summary summary, List<Person> people) {

    /**
     * @param people                everyone with a course, or a session in the window
     * @param coursesAssigned       course assignments
     * @param coursesPassed         of those, passed
     * @param coursesOverdue        of those, past their due date and not passed
     * @param coursesPassedInWindow course passes recorded inside the window
     * @param sessionsHeld          sessions dated inside the window
     * @param sessionPlaces         attendee places on those sessions
     * @param sessionsAttended      of those places, marked attended
     * @param minutesAttended       training minutes attended inside the window
     */
    public record Summary(
            int people,
            long coursesAssigned,
            long coursesPassed,
            long coursesOverdue,
            long coursesPassedInWindow,
            long sessionsHeld,
            long sessionPlaces,
            long sessionsAttended,
            long minutesAttended) {
    }

    /**
     * @param branchName      the branch they work in for this firm, or null for firm-level staff
     * @param lastCompletedAt their latest course pass or session attended, any time
     */
    public record Person(
            Long userId,
            String fullName,
            String role,
            String branchName,
            long coursesAssigned,
            long coursesPassed,
            long coursesOverdue,
            long sessionsAssigned,
            long sessionsAttended,
            long minutesAttended,
            Instant lastCompletedAt) {
    }
}
