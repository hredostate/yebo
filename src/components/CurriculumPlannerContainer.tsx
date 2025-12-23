import React from 'react';
import CurriculumPlannerView from './CurriculumPlannerView';
import type { LessonPlan, Team, UserProfile, AcademicTeachingAssignment, LessonPlanAnalysis, Curriculum, CurriculumWeek } from '../types';

type Props = {
  teams: Team[];
  lessonPlans: LessonPlan[];
  userProfile: UserProfile;
  teachingAssignments: AcademicTeachingAssignment[];
  onSaveLessonPlan: (plan: Partial<LessonPlan>, generateWithAi: boolean, file: File | null) => Promise<LessonPlan | null>;
  onAnalyzeLessonPlan: (planId: number) => Promise<LessonPlanAnalysis | null>;
  onCopyLessonPlan: (sourcePlan: LessonPlan, targetEntityIds: number[]) => Promise<boolean>;
  curricula: Curriculum[];
  curriculumWeeks: CurriculumWeek[];
  onApprove: (plan: LessonPlan) => Promise<void>;
  onSubmitForReview?: (plan: LessonPlan) => Promise<void>;
};

const CurriculumPlannerContainer: React.FC<Props> = (props) => {
  return (
    <CurriculumPlannerView
        teams={props.teams}
        lessonPlans={props.lessonPlans}
        userProfile={props.userProfile}
        teachingAssignments={props.teachingAssignments}
        onSaveLessonPlan={props.onSaveLessonPlan}
        onAnalyzeLessonPlan={props.onAnalyzeLessonPlan}
        onCopyLessonPlan={props.onCopyLessonPlan}
        curricula={props.curricula}
        curriculumWeeks={props.curriculumWeeks}
        onApprove={props.onApprove}
        onSubmitForReview={props.onSubmitForReview}
    />
  );
};

export default CurriculumPlannerContainer;