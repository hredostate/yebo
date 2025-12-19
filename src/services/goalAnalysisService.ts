import { supabase } from './supabaseClient';
import type { StudentAcademicGoal } from '../types';

interface GoalAnalysisResult {
    report: string;
    achievementRating: 'exceeded' | 'met' | 'partially_met' | 'not_met';
}

/**
 * Generates a rule-based analysis of a student's academic goal achievement
 * @param studentId - The student's ID
 * @param termId - The term ID
 * @returns Analysis report and achievement rating
 */
export async function generateGoalAnalysis(
    studentId: number,
    termId: number
): Promise<GoalAnalysisResult | null> {
    try {
        // 1. Fetch the student's academic goal for the term
        const { data: goal, error: goalError } = await supabase
            .from('student_academic_goals')
            .select('*')
            .eq('student_id', studentId)
            .eq('term_id', termId)
            .maybeSingle();

        if (goalError) {
            console.error('Error fetching goal:', goalError);
            return null;
        }

        if (!goal) {
            // No goal set for this student/term
            return null;
        }

        // 2. Fetch the student's actual performance
        const { data: report, error: reportError } = await supabase
            .from('student_term_reports')
            .select('*, students(name)')
            .eq('student_id', studentId)
            .eq('term_id', termId)
            .maybeSingle();

        if (reportError) {
            console.error('Error fetching report:', reportError);
            return null;
        }

        if (!report) {
            // No report available yet
            return null;
        }

        // 3. Fetch subject scores if target subjects were set
        let subjectScores: Record<string, number> = {};
        if (goal.target_subjects && Object.keys(goal.target_subjects).length > 0) {
            const { data: scores, error: scoresError } = await supabase
                .from('score_entries')
                .select('subject_name, total_score')
                .eq('student_id', studentId)
                .eq('term_id', termId);

            if (!scoresError && scores) {
                scores.forEach((s) => {
                    subjectScores[s.subject_name] = s.total_score;
                });
            }
        }

        // 4. Compare goal targets with actual results
        const studentName = (report.students as any)?.name || 'Student';
        const actualAverage = report.average_score;
        const actualPosition = report.position_in_class;

        // Analyze achievement
        const analysis = analyzeGoalAchievement(
            goal,
            actualAverage,
            actualPosition,
            subjectScores,
            studentName
        );

        // 5. Save the analysis to student_term_reports
        const { error: updateError } = await supabase
            .from('student_term_reports')
            .update({
                academic_goal_id: goal.id,
                goal_analysis_report: analysis.report,
                goal_achievement_rating: analysis.achievementRating,
                goal_analysis_generated_at: new Date().toISOString(),
            })
            .eq('student_id', studentId)
            .eq('term_id', termId);

        if (updateError) {
            console.error('Error saving goal analysis:', updateError);
        }

        return analysis;
    } catch (error) {
        console.error('Error in generateGoalAnalysis:', error);
        return null;
    }
}

/**
 * Analyzes goal achievement based on targets and actual performance
 */
function analyzeGoalAchievement(
    goal: StudentAcademicGoal,
    actualAverage: number,
    actualPosition: number,
    subjectScores: Record<string, number>,
    studentName: string
): GoalAnalysisResult {
    const achievements: string[] = [];
    const shortfalls: string[] = [];
    let totalTargets = 0;
    let targetsExceeded = 0;
    let targetsMet = 0;
    let targetsPartiallyMet = 0;

    // Analyze average target
    if (goal.target_average !== null && goal.target_average !== undefined) {
        totalTargets++;
        const diff = actualAverage - goal.target_average;
        
        if (diff >= 5) {
            targetsExceeded++;
            achievements.push(
                `achieved an impressive ${actualAverage.toFixed(1)}% average, exceeding the target of ${goal.target_average}%`
            );
        } else if (diff >= 0) {
            targetsMet++;
            achievements.push(
                `achieved ${actualAverage.toFixed(1)}% average, meeting the target of ${goal.target_average}%`
            );
        } else if (diff >= -5) {
            targetsPartiallyMet++;
            achievements.push(
                `achieved ${actualAverage.toFixed(1)}% average, coming close to the target of ${goal.target_average}%`
            );
        } else {
            shortfalls.push(
                `fell short of the ${goal.target_average}% average target with ${actualAverage.toFixed(1)}%`
            );
        }
    }

    // Analyze position target
    if (goal.target_position !== null && goal.target_position !== undefined) {
        totalTargets++;
        
        if (actualPosition <= goal.target_position) {
            if (actualPosition < goal.target_position) {
                targetsExceeded++;
                achievements.push(
                    `ranked ${actualPosition}${getOrdinalSuffix(actualPosition)} in class, surpassing the target position of ${goal.target_position}${getOrdinalSuffix(goal.target_position)}`
                );
            } else {
                targetsMet++;
                achievements.push(
                    `achieved the target position of ${actualPosition}${getOrdinalSuffix(actualPosition)} in class`
                );
            }
        } else {
            const diff = actualPosition - goal.target_position;
            if (diff <= 3) {
                targetsPartiallyMet++;
                achievements.push(
                    `ranked ${actualPosition}${getOrdinalSuffix(actualPosition)}, narrowly missing the target of ${goal.target_position}${getOrdinalSuffix(goal.target_position)}`
                );
            } else {
                shortfalls.push(
                    `ranked ${actualPosition}${getOrdinalSuffix(actualPosition)}, missing the target position of ${goal.target_position}${getOrdinalSuffix(goal.target_position)}`
                );
            }
        }
    }

    // Analyze subject targets
    if (goal.target_subjects && typeof goal.target_subjects === 'object') {
        const targetSubjects = goal.target_subjects as Record<string, number>;
        const subjectAchievements: string[] = [];
        const subjectShortfalls: string[] = [];

        for (const [subject, targetScore] of Object.entries(targetSubjects)) {
            totalTargets++;
            const actualScore = subjectScores[subject];

            if (actualScore !== undefined) {
                const diff = actualScore - targetScore;
                
                if (diff >= 5) {
                    targetsExceeded++;
                    subjectAchievements.push(
                        `${subject}: ${actualScore}% (exceeded ${targetScore}%)`
                    );
                } else if (diff >= 0) {
                    targetsMet++;
                    subjectAchievements.push(
                        `${subject}: ${actualScore}% (met ${targetScore}%)`
                    );
                } else if (diff >= -5) {
                    targetsPartiallyMet++;
                    subjectAchievements.push(
                        `${subject}: ${actualScore}% (close to ${targetScore}%)`
                    );
                } else {
                    subjectShortfalls.push(
                        `${subject}: ${actualScore}% (target was ${targetScore}%)`
                    );
                }
            }
        }

        if (subjectAchievements.length > 0) {
            achievements.push(
                `demonstrated strong performance in ${subjectAchievements.join(', ')}`
            );
        }
        if (subjectShortfalls.length > 0) {
            shortfalls.push(
                `needs improvement in ${subjectShortfalls.join(', ')}`
            );
        }
    }

    // Determine overall achievement rating
    let achievementRating: 'exceeded' | 'met' | 'partially_met' | 'not_met';
    
    if (totalTargets === 0) {
        achievementRating = 'met';
    } else {
        const exceededRatio = targetsExceeded / totalTargets;
        const metRatio = (targetsExceeded + targetsMet) / totalTargets;
        const partiallyMetRatio = (targetsExceeded + targetsMet + targetsPartiallyMet) / totalTargets;

        if (exceededRatio >= 0.7) {
            achievementRating = 'exceeded';
        } else if (metRatio >= 0.7) {
            achievementRating = 'met';
        } else if (partiallyMetRatio >= 0.5) {
            achievementRating = 'partially_met';
        } else {
            achievementRating = 'not_met';
        }
    }

    // Generate narrative report
    let report = `${studentName} set a goal to ${goal.goal_text}. `;

    if (achievements.length > 0) {
        report += `${capitalize(studentName)} ${achievements.join(' and ')}. `;
    }

    if (shortfalls.length > 0) {
        report += `However, ${shortfalls.join(' and ')}. `;
    }

    // Add concluding statement based on rating
    switch (achievementRating) {
        case 'exceeded':
            report += `Overall, ${studentName} exceeded the academic goals set for this term with outstanding performance.`;
            break;
        case 'met':
            report += `Overall, ${studentName} successfully met the academic goals for this term.`;
            break;
        case 'partially_met':
            report += `While some progress was made, ${studentName} partially achieved the goals and should continue working towards improvement.`;
            break;
        case 'not_met':
            report += `${capitalize(studentName)} did not meet the set goals this term and should work with teachers to develop strategies for improvement.`;
            break;
    }

    return {
        report,
        achievementRating,
    };
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Bulk generate goal analyses for multiple students
 * Useful for batch processing during report card generation
 */
export async function generateBulkGoalAnalyses(
    studentIds: number[],
    termId: number,
    onProgress?: (current: number, total: number) => void
): Promise<{ successes: number; failures: number }> {
    let successes = 0;
    let failures = 0;

    for (let i = 0; i < studentIds.length; i++) {
        const studentId = studentIds[i];
        
        try {
            const result = await generateGoalAnalysis(studentId, termId);
            if (result) {
                successes++;
            } else {
                // null result could mean no goal set, which is not a failure
                successes++;
            }
        } catch (error) {
            console.error(`Failed to generate goal analysis for student ${studentId}:`, error);
            failures++;
        }

        if (onProgress) {
            onProgress(i + 1, studentIds.length);
        }
    }

    return { successes, failures };
}
