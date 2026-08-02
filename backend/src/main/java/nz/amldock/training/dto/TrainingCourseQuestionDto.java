package nz.amldock.training.dto;

import nz.amldock.training.QuestionType;

import java.util.List;

public record TrainingCourseQuestionDto(
        Long id,
        Integer position,
        QuestionType questionType,
        String prompt,
        List<TrainingCourseOptionDto> options
) {
}
