import { getAIClient, getCurrentModel } from './aiClient.js';
import { textFromAI } from '../utils/ai.js';
import type { 
  GeneratedReport, 
  ReportGenerationRequest, 
  SubjectComment 
} from '../types.js';

/**
 * Report Generator Service
 * Generates automated teacher comments using AI
 */

interface StudentReportData {
  studentName: string;
  subjectScores: { 
    subjectId: number; 
    subjectName: string; 
    score: number; 
    grade: string;
    previousScore?: number;
  }[];
  attendanceRate?: number;
  behaviorNotes?: string[];
  participationLevel?: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Performance band definitions
 */
type PerformanceBand = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Subject category definitions
 */
type SubjectCategory = 
  | 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology'
  | 'English' | 'Literature'
  | 'Economics' | 'Commerce' | 'Accounting'
  | 'Government' | 'History' | 'Geography'
  | 'ICT' | 'Technical Drawing'
  | 'General';

/**
 * Trend indicator
 */
type TrendIndicator = 'up' | 'down' | 'flat' | null;

/**
 * Comment pair structure
 */
interface CommentPair {
  band: PerformanceBand;
  category: SubjectCategory;
  trend: TrendIndicator;
  strengthTags: string[];
  weaknessTags: string[];
  subjectRemark: string; // 4-6 words
  teacherComment: string; // Exactly 2 sentences
}

/**
 * Batch processing interfaces
 */
interface BatchSubjectInput {
  subject: string;
  score: number;
  grade: string;
  class_average: number;
  trend: TrendIndicator;
  strength_tags: string[];
  weakness_tags: string[];
}

interface BatchStudentInput {
  student_id: string;
  subjects: BatchSubjectInput[];
}

interface BatchInput {
  term: string;
  class_name: string;
  students: BatchStudentInput[];
}

interface BatchSubjectOutput {
  subject: string;
  subject_remark: string;
  teacher_comment: string;
}

interface BatchStudentOutput {
  student_id: string;
  items: BatchSubjectOutput[];
}

interface BatchOutput {
  results: BatchStudentOutput[];
}

/**
 * Comprehensive Comment Bank
 * 1200+ unique comment pairs organized by performance band, subject category, and trends
 * Following Nigerian secondary school (University Preparatory Secondary School) style
 * Using British English throughout
 * 
 * Type assertion used to avoid TypeScript complexity issues with large literal arrays
 */
const COMMENT_BANK: CommentPair[] = [
{"band":"A","category":"Mathematics","trend":"up","strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Exceptional algebra skills improving steadily","teacherComment":"Demonstrates outstanding mastery of algebra with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Mathematics","trend":"up","strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Outstanding geometry mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of geometry across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Mathematics","trend":"up","strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Remarkable calculus progress shown consistently","teacherComment":"Displays remarkable proficiency in calculus with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Mathematics","trend":"up","strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Excellent trigonometry techniques advancing well","teacherComment":"Exhibits excellent command of trigonometry throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Mathematics","trend":"down","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Good algebra despite slight decline","teacherComment":"Demonstrates outstanding mastery of algebra with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Mathematics","trend":"down","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Strong geometry foundation remains solid","teacherComment":"Shows exceptional understanding of geometry across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Mathematics","trend":"down","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Capable calculus skills need reinforcement","teacherComment":"Displays remarkable proficiency in calculus with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Mathematics","trend":"down","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Previously strong trigonometry needs attention","teacherComment":"Exhibits excellent command of trigonometry throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Mathematics","trend":"flat","strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Consistently excellent algebra performance shown","teacherComment":"Demonstrates outstanding mastery of algebra with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Mathematics","trend":"flat","strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Sustained high geometry standards maintained","teacherComment":"Shows exceptional understanding of geometry across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Mathematics","trend":"flat","strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Reliable calculus excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in calculus with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Mathematics","trend":"flat","strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Maintained outstanding trigonometry proficiency level","teacherComment":"Exhibits excellent command of trigonometry throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Mathematics","trend":null,"strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Outstanding algebra competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of algebra with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Mathematics","trend":null,"strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Exceptional geometry understanding demonstrated well","teacherComment":"Shows exceptional understanding of geometry across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Mathematics","trend":null,"strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Excellent calculus application shown consistently","teacherComment":"Displays remarkable proficiency in calculus with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Mathematics","trend":null,"strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Remarkable trigonometry proficiency observed throughout","teacherComment":"Exhibits excellent command of trigonometry throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Mathematics","trend":"up","strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Good algebra skills developing steadily","teacherComment":"Shows strong understanding of algebra with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Mathematics","trend":"up","strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Strong geometry progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in geometry skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Mathematics","trend":"up","strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Commendable calculus improvement shown consistently","teacherComment":"Displays good grasp of calculus concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Mathematics","trend":"up","strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Very good trigonometry advancement observed","teacherComment":"Shows very good performance in trigonometry applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Mathematics","trend":"down","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Fair algebra despite recent decline","teacherComment":"Shows strong understanding of algebra with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Mathematics","trend":"down","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Adequate geometry needs more practice","teacherComment":"Demonstrates commendable progress in geometry skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Mathematics","trend":"down","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Basic calculus requires strengthening now","teacherComment":"Displays good grasp of calculus concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Mathematics","trend":"down","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Trigonometry skills slipping slightly","teacherComment":"Shows very good performance in trigonometry applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Mathematics","trend":"flat","strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Consistent good algebra performance maintained","teacherComment":"Shows strong understanding of algebra with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Mathematics","trend":"flat","strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Reliable geometry competence shown throughout","teacherComment":"Demonstrates commendable progress in geometry skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Mathematics","trend":"flat","strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Steady calculus understanding demonstrated well","teacherComment":"Displays good grasp of calculus concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Mathematics","trend":"flat","strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Maintained good trigonometry standard overall","teacherComment":"Shows very good performance in trigonometry applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Mathematics","trend":null,"strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Good algebra competence displayed clearly","teacherComment":"Shows strong understanding of algebra with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Mathematics","trend":null,"strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Strong geometry understanding shown well","teacherComment":"Demonstrates commendable progress in geometry skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Mathematics","trend":null,"strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Commendable calculus application demonstrated consistently","teacherComment":"Displays good grasp of calculus concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Mathematics","trend":null,"strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Very good trigonometry proficiency observed","teacherComment":"Shows very good performance in trigonometry applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Mathematics","trend":"up","strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Improving algebra skills shown clearly","teacherComment":"Understanding of algebra is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Mathematics","trend":"up","strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Developing geometry competence observed positively","teacherComment":"Shows fair grasp of geometry concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Mathematics","trend":"up","strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Growing calculus understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in calculus skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Mathematics","trend":"up","strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Advancing trigonometry proficiency evident now","teacherComment":"Displays average competence in trigonometry applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Mathematics","trend":"down","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Declining algebra requires urgent attention","teacherComment":"Understanding of algebra is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Mathematics","trend":"down","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Weakening geometry skills need support","teacherComment":"Shows fair grasp of geometry concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Mathematics","trend":"down","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Calculus foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in calculus skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Mathematics","trend":"down","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Struggling trigonometry needs immediate improvement","teacherComment":"Displays average competence in trigonometry applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Mathematics","trend":"flat","strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Satisfactory algebra performance maintained steadily","teacherComment":"Understanding of algebra is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Mathematics","trend":"flat","strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Average geometry competence shown consistently","teacherComment":"Shows fair grasp of geometry concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Mathematics","trend":"flat","strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Fair calculus understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in calculus skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Mathematics","trend":"flat","strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Adequate trigonometry level sustained overall","teacherComment":"Displays average competence in trigonometry applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Mathematics","trend":null,"strengthTags":["algebra"],"weaknessTags":[],"subjectRemark":"Satisfactory algebra competence shown adequately","teacherComment":"Understanding of algebra is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Mathematics","trend":null,"strengthTags":["geometry"],"weaknessTags":[],"subjectRemark":"Average geometry understanding demonstrated fairly","teacherComment":"Shows fair grasp of geometry concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Mathematics","trend":null,"strengthTags":["calculus"],"weaknessTags":[],"subjectRemark":"Fair calculus application observed throughout","teacherComment":"Demonstrates satisfactory progress in calculus skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Mathematics","trend":null,"strengthTags":["trigonometry"],"weaknessTags":[],"subjectRemark":"Adequate trigonometry proficiency displayed overall","teacherComment":"Displays average competence in trigonometry applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Mathematics","trend":"up","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Gradual algebra improvement beginning slowly","teacherComment":"Needs significant improvement in algebra understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Mathematics","trend":"up","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Emerging geometry skills need encouragement","teacherComment":"Shows limited grasp of geometry requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Mathematics","trend":"up","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Slight calculus progress shown tentatively","teacherComment":"Demonstrates weak calculus skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Mathematics","trend":"up","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Developing trigonometry requires consistent effort","teacherComment":"Displays below average trigonometry competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Mathematics","trend":"down","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Poor algebra declining needs intervention","teacherComment":"Needs significant improvement in algebra understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Mathematics","trend":"down","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Weak geometry requires immediate support","teacherComment":"Shows limited grasp of geometry requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Mathematics","trend":"down","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Struggling calculus needs urgent help","teacherComment":"Demonstrates weak calculus skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Mathematics","trend":"down","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Very weak trigonometry demands attention","teacherComment":"Displays below average trigonometry competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Mathematics","trend":"flat","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Basic algebra understanding needs strengthening","teacherComment":"Needs significant improvement in algebra understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Mathematics","trend":"flat","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Limited geometry competence requires support","teacherComment":"Shows limited grasp of geometry requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Mathematics","trend":"flat","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Weak calculus skills need development","teacherComment":"Demonstrates weak calculus skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Mathematics","trend":"flat","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Below average trigonometry needs attention","teacherComment":"Displays below average trigonometry competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Mathematics","trend":null,"strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Basic algebra competence needs development","teacherComment":"Needs significant improvement in algebra understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Mathematics","trend":null,"strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Limited geometry understanding requires support","teacherComment":"Shows limited grasp of geometry requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Mathematics","trend":null,"strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Weak calculus skills need improvement","teacherComment":"Demonstrates weak calculus skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Mathematics","trend":null,"strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Below average trigonometry demands attention","teacherComment":"Displays below average trigonometry competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Mathematics","trend":"up","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Slight algebra improvement noted recently","teacherComment":"Requires urgent intervention for algebra development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Mathematics","trend":"up","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Small geometry gains need building","teacherComment":"Shows very poor understanding of geometry needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Mathematics","trend":"up","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Initial calculus progress requires support","teacherComment":"Demonstrates critical weakness in calculus requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Mathematics","trend":"up","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Emerging trigonometry needs consistent work","teacherComment":"Displays minimal trigonometry competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Mathematics","trend":"down","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Critical algebra weakness requires intervention","teacherComment":"Requires urgent intervention for algebra development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Mathematics","trend":"down","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Severely poor geometry needs immediate help","teacherComment":"Shows very poor understanding of geometry needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Mathematics","trend":"down","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Very poor calculus demands urgent attention","teacherComment":"Demonstrates critical weakness in calculus requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Mathematics","trend":"down","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Failing trigonometry requires extensive support","teacherComment":"Displays minimal trigonometry competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Mathematics","trend":"flat","strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Very weak algebra requires urgent intervention","teacherComment":"Requires urgent intervention for algebra development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Mathematics","trend":"flat","strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Poor geometry understanding needs extensive support","teacherComment":"Shows very poor understanding of geometry needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Mathematics","trend":"flat","strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Severely limited calculus demands attention","teacherComment":"Demonstrates critical weakness in calculus requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Mathematics","trend":"flat","strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Minimal trigonometry competence needs development","teacherComment":"Displays minimal trigonometry competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Mathematics","trend":null,"strengthTags":["algebra"],"weaknessTags":["word problems"],"subjectRemark":"Very weak algebra needs extensive work","teacherComment":"Requires urgent intervention for algebra development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Mathematics","trend":null,"strengthTags":["geometry"],"weaknessTags":["speed"],"subjectRemark":"Poor geometry competence requires support","teacherComment":"Shows very poor understanding of geometry needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Mathematics","trend":null,"strengthTags":["calculus"],"weaknessTags":["accuracy"],"subjectRemark":"Severely limited calculus demands attention","teacherComment":"Demonstrates critical weakness in calculus requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Mathematics","trend":null,"strengthTags":["trigonometry"],"weaknessTags":["showing working"],"subjectRemark":"Minimal trigonometry understanding needs development","teacherComment":"Displays minimal trigonometry competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Physics","trend":"up","strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Exceptional mechanics skills improving steadily","teacherComment":"Demonstrates outstanding mastery of mechanics with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Physics","trend":"up","strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Outstanding electricity mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of electricity across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Physics","trend":"up","strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Remarkable optics progress shown consistently","teacherComment":"Displays remarkable proficiency in optics with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Physics","trend":"up","strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Excellent formulas techniques advancing well","teacherComment":"Exhibits excellent command of formulas throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Physics","trend":"down","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Good mechanics despite slight decline","teacherComment":"Demonstrates outstanding mastery of mechanics with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Physics","trend":"down","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Strong electricity foundation remains solid","teacherComment":"Shows exceptional understanding of electricity across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Physics","trend":"down","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Capable optics skills need reinforcement","teacherComment":"Displays remarkable proficiency in optics with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Physics","trend":"down","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Previously strong formulas needs attention","teacherComment":"Exhibits excellent command of formulas throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Physics","trend":"flat","strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Consistently excellent mechanics performance shown","teacherComment":"Demonstrates outstanding mastery of mechanics with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Physics","trend":"flat","strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Sustained high electricity standards maintained","teacherComment":"Shows exceptional understanding of electricity across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Physics","trend":"flat","strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Reliable optics excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in optics with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Physics","trend":"flat","strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Maintained outstanding formulas proficiency level","teacherComment":"Exhibits excellent command of formulas throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Physics","trend":null,"strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Outstanding mechanics competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of mechanics with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Physics","trend":null,"strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Exceptional electricity understanding demonstrated well","teacherComment":"Shows exceptional understanding of electricity across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Physics","trend":null,"strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Excellent optics application shown consistently","teacherComment":"Displays remarkable proficiency in optics with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Physics","trend":null,"strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Remarkable formulas proficiency observed throughout","teacherComment":"Exhibits excellent command of formulas throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Physics","trend":"up","strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Good mechanics skills developing steadily","teacherComment":"Shows strong understanding of mechanics with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Physics","trend":"up","strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Strong electricity progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in electricity skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Physics","trend":"up","strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Commendable optics improvement shown consistently","teacherComment":"Displays good grasp of optics concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Physics","trend":"up","strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Very good formulas advancement observed","teacherComment":"Shows very good performance in formulas applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Physics","trend":"down","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Fair mechanics despite recent decline","teacherComment":"Shows strong understanding of mechanics with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Physics","trend":"down","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Adequate electricity needs more practice","teacherComment":"Demonstrates commendable progress in electricity skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Physics","trend":"down","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Basic optics requires strengthening now","teacherComment":"Displays good grasp of optics concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Physics","trend":"down","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Formulas skills slipping slightly","teacherComment":"Shows very good performance in formulas applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Physics","trend":"flat","strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Consistent good mechanics performance maintained","teacherComment":"Shows strong understanding of mechanics with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Physics","trend":"flat","strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Reliable electricity competence shown throughout","teacherComment":"Demonstrates commendable progress in electricity skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Physics","trend":"flat","strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Steady optics understanding demonstrated well","teacherComment":"Displays good grasp of optics concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Physics","trend":"flat","strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Maintained good formulas standard overall","teacherComment":"Shows very good performance in formulas applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Physics","trend":null,"strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Good mechanics competence displayed clearly","teacherComment":"Shows strong understanding of mechanics with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Physics","trend":null,"strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Strong electricity understanding shown well","teacherComment":"Demonstrates commendable progress in electricity skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Physics","trend":null,"strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Commendable optics application demonstrated consistently","teacherComment":"Displays good grasp of optics concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Physics","trend":null,"strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Very good formulas proficiency observed","teacherComment":"Shows very good performance in formulas applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Physics","trend":"up","strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Improving mechanics skills shown clearly","teacherComment":"Understanding of mechanics is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Physics","trend":"up","strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Developing electricity competence observed positively","teacherComment":"Shows fair grasp of electricity concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Physics","trend":"up","strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Growing optics understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in optics skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Physics","trend":"up","strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Advancing formulas proficiency evident now","teacherComment":"Displays average competence in formulas applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Physics","trend":"down","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Declining mechanics requires urgent attention","teacherComment":"Understanding of mechanics is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Physics","trend":"down","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Weakening electricity skills need support","teacherComment":"Shows fair grasp of electricity concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Physics","trend":"down","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Optics foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in optics skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Physics","trend":"down","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Struggling formulas needs immediate improvement","teacherComment":"Displays average competence in formulas applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Physics","trend":"flat","strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Satisfactory mechanics performance maintained steadily","teacherComment":"Understanding of mechanics is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Physics","trend":"flat","strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Average electricity competence shown consistently","teacherComment":"Shows fair grasp of electricity concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Physics","trend":"flat","strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Fair optics understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in optics skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Physics","trend":"flat","strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Adequate formulas level sustained overall","teacherComment":"Displays average competence in formulas applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Physics","trend":null,"strengthTags":["mechanics"],"weaknessTags":[],"subjectRemark":"Satisfactory mechanics competence shown adequately","teacherComment":"Understanding of mechanics is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Physics","trend":null,"strengthTags":["electricity"],"weaknessTags":[],"subjectRemark":"Average electricity understanding demonstrated fairly","teacherComment":"Shows fair grasp of electricity concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Physics","trend":null,"strengthTags":["optics"],"weaknessTags":[],"subjectRemark":"Fair optics application observed throughout","teacherComment":"Demonstrates satisfactory progress in optics skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Physics","trend":null,"strengthTags":["formulas"],"weaknessTags":[],"subjectRemark":"Adequate formulas proficiency displayed overall","teacherComment":"Displays average competence in formulas applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Physics","trend":"up","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Gradual mechanics improvement beginning slowly","teacherComment":"Needs significant improvement in mechanics understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Physics","trend":"up","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Emerging electricity skills need encouragement","teacherComment":"Shows limited grasp of electricity requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Physics","trend":"up","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Slight optics progress shown tentatively","teacherComment":"Demonstrates weak optics skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Physics","trend":"up","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Developing formulas requires consistent effort","teacherComment":"Displays below average formulas competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Physics","trend":"down","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Poor mechanics declining needs intervention","teacherComment":"Needs significant improvement in mechanics understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Physics","trend":"down","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Weak electricity requires immediate support","teacherComment":"Shows limited grasp of electricity requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Physics","trend":"down","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Struggling optics needs urgent help","teacherComment":"Demonstrates weak optics skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Physics","trend":"down","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Very weak formulas demands attention","teacherComment":"Displays below average formulas competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Physics","trend":"flat","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Basic mechanics understanding needs strengthening","teacherComment":"Needs significant improvement in mechanics understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Physics","trend":"flat","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Limited electricity competence requires support","teacherComment":"Shows limited grasp of electricity requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Physics","trend":"flat","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Weak optics skills need development","teacherComment":"Demonstrates weak optics skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Physics","trend":"flat","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Below average formulas needs attention","teacherComment":"Displays below average formulas competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Physics","trend":null,"strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Basic mechanics competence needs development","teacherComment":"Needs significant improvement in mechanics understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Physics","trend":null,"strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Limited electricity understanding requires support","teacherComment":"Shows limited grasp of electricity requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Physics","trend":null,"strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Weak optics skills need improvement","teacherComment":"Demonstrates weak optics skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Physics","trend":null,"strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Below average formulas demands attention","teacherComment":"Displays below average formulas competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Physics","trend":"up","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Slight mechanics improvement noted recently","teacherComment":"Requires urgent intervention for mechanics development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Physics","trend":"up","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Small electricity gains need building","teacherComment":"Shows very poor understanding of electricity needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Physics","trend":"up","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Initial optics progress requires support","teacherComment":"Demonstrates critical weakness in optics requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Physics","trend":"up","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Emerging formulas needs consistent work","teacherComment":"Displays minimal formulas competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Physics","trend":"down","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Critical mechanics weakness requires intervention","teacherComment":"Requires urgent intervention for mechanics development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Physics","trend":"down","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Severely poor electricity needs immediate help","teacherComment":"Shows very poor understanding of electricity needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Physics","trend":"down","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Very poor optics demands urgent attention","teacherComment":"Demonstrates critical weakness in optics requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Physics","trend":"down","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Failing formulas requires extensive support","teacherComment":"Displays minimal formulas competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Physics","trend":"flat","strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Very weak mechanics requires urgent intervention","teacherComment":"Requires urgent intervention for mechanics development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Physics","trend":"flat","strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Poor electricity understanding needs extensive support","teacherComment":"Shows very poor understanding of electricity needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Physics","trend":"flat","strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Severely limited optics demands attention","teacherComment":"Demonstrates critical weakness in optics requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Physics","trend":"flat","strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Minimal formulas competence needs development","teacherComment":"Displays minimal formulas competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Physics","trend":null,"strengthTags":["mechanics"],"weaknessTags":["formulas"],"subjectRemark":"Very weak mechanics needs extensive work","teacherComment":"Requires urgent intervention for mechanics development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Physics","trend":null,"strengthTags":["electricity"],"weaknessTags":["units"],"subjectRemark":"Poor electricity competence requires support","teacherComment":"Shows very poor understanding of electricity needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Physics","trend":null,"strengthTags":["optics"],"weaknessTags":["calculations"],"subjectRemark":"Severely limited optics demands attention","teacherComment":"Demonstrates critical weakness in optics requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Physics","trend":null,"strengthTags":["formulas"],"weaknessTags":["concepts"],"subjectRemark":"Minimal formulas understanding needs development","teacherComment":"Displays minimal formulas competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Chemistry","trend":"up","strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Exceptional equations skills improving steadily","teacherComment":"Demonstrates outstanding mastery of equations with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Chemistry","trend":"up","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Outstanding practicals mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of practicals across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Chemistry","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Remarkable calculations progress shown consistently","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Chemistry","trend":"up","strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Excellent reactions techniques advancing well","teacherComment":"Exhibits excellent command of reactions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Chemistry","trend":"down","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Good equations despite slight decline","teacherComment":"Demonstrates outstanding mastery of equations with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Chemistry","trend":"down","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Strong practicals foundation remains solid","teacherComment":"Shows exceptional understanding of practicals across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Chemistry","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Capable calculations skills need reinforcement","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Chemistry","trend":"down","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Previously strong reactions needs attention","teacherComment":"Exhibits excellent command of reactions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Chemistry","trend":"flat","strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Consistently excellent equations performance shown","teacherComment":"Demonstrates outstanding mastery of equations with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Chemistry","trend":"flat","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Sustained high practicals standards maintained","teacherComment":"Shows exceptional understanding of practicals across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Chemistry","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Reliable calculations excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Chemistry","trend":"flat","strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Maintained outstanding reactions proficiency level","teacherComment":"Exhibits excellent command of reactions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Chemistry","trend":null,"strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Outstanding equations competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of equations with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Chemistry","trend":null,"strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Exceptional practicals understanding demonstrated well","teacherComment":"Shows exceptional understanding of practicals across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Chemistry","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Excellent calculations application shown consistently","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Chemistry","trend":null,"strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Remarkable reactions proficiency observed throughout","teacherComment":"Exhibits excellent command of reactions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Chemistry","trend":"up","strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Good equations skills developing steadily","teacherComment":"Shows strong understanding of equations with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Chemistry","trend":"up","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Strong practicals progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in practicals skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Chemistry","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Commendable calculations improvement shown consistently","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Chemistry","trend":"up","strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Very good reactions advancement observed","teacherComment":"Shows very good performance in reactions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Chemistry","trend":"down","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Fair equations despite recent decline","teacherComment":"Shows strong understanding of equations with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Chemistry","trend":"down","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Adequate practicals needs more practice","teacherComment":"Demonstrates commendable progress in practicals skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Chemistry","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Basic calculations requires strengthening now","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Chemistry","trend":"down","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Reactions skills slipping slightly","teacherComment":"Shows very good performance in reactions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Chemistry","trend":"flat","strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Consistent good equations performance maintained","teacherComment":"Shows strong understanding of equations with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Chemistry","trend":"flat","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Reliable practicals competence shown throughout","teacherComment":"Demonstrates commendable progress in practicals skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Chemistry","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Steady calculations understanding demonstrated well","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Chemistry","trend":"flat","strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Maintained good reactions standard overall","teacherComment":"Shows very good performance in reactions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Chemistry","trend":null,"strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Good equations competence displayed clearly","teacherComment":"Shows strong understanding of equations with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Chemistry","trend":null,"strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Strong practicals understanding shown well","teacherComment":"Demonstrates commendable progress in practicals skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Chemistry","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Commendable calculations application demonstrated consistently","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Chemistry","trend":null,"strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Very good reactions proficiency observed","teacherComment":"Shows very good performance in reactions applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Chemistry","trend":"up","strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Improving equations skills shown clearly","teacherComment":"Understanding of equations is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Chemistry","trend":"up","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Developing practicals competence observed positively","teacherComment":"Shows fair grasp of practicals concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Chemistry","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Growing calculations understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Chemistry","trend":"up","strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Advancing reactions proficiency evident now","teacherComment":"Displays average competence in reactions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Chemistry","trend":"down","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Declining equations requires urgent attention","teacherComment":"Understanding of equations is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Chemistry","trend":"down","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Weakening practicals skills need support","teacherComment":"Shows fair grasp of practicals concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Chemistry","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Calculations foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Chemistry","trend":"down","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Struggling reactions needs immediate improvement","teacherComment":"Displays average competence in reactions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Chemistry","trend":"flat","strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Satisfactory equations performance maintained steadily","teacherComment":"Understanding of equations is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Chemistry","trend":"flat","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Average practicals competence shown consistently","teacherComment":"Shows fair grasp of practicals concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Chemistry","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Fair calculations understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Chemistry","trend":"flat","strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Adequate reactions level sustained overall","teacherComment":"Displays average competence in reactions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Chemistry","trend":null,"strengthTags":["equations"],"weaknessTags":[],"subjectRemark":"Satisfactory equations competence shown adequately","teacherComment":"Understanding of equations is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Chemistry","trend":null,"strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Average practicals understanding demonstrated fairly","teacherComment":"Shows fair grasp of practicals concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Chemistry","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Fair calculations application observed throughout","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Chemistry","trend":null,"strengthTags":["reactions"],"weaknessTags":[],"subjectRemark":"Adequate reactions proficiency displayed overall","teacherComment":"Displays average competence in reactions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Chemistry","trend":"up","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Gradual equations improvement beginning slowly","teacherComment":"Needs significant improvement in equations understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Chemistry","trend":"up","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Emerging practicals skills need encouragement","teacherComment":"Shows limited grasp of practicals requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Chemistry","trend":"up","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Slight calculations progress shown tentatively","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Chemistry","trend":"up","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Developing reactions requires consistent effort","teacherComment":"Displays below average reactions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Chemistry","trend":"down","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Poor equations declining needs intervention","teacherComment":"Needs significant improvement in equations understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Chemistry","trend":"down","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Weak practicals requires immediate support","teacherComment":"Shows limited grasp of practicals requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Chemistry","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Struggling calculations needs urgent help","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Chemistry","trend":"down","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Very weak reactions demands attention","teacherComment":"Displays below average reactions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Chemistry","trend":"flat","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Basic equations understanding needs strengthening","teacherComment":"Needs significant improvement in equations understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Chemistry","trend":"flat","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Limited practicals competence requires support","teacherComment":"Shows limited grasp of practicals requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Chemistry","trend":"flat","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Weak calculations skills need development","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Chemistry","trend":"flat","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Below average reactions needs attention","teacherComment":"Displays below average reactions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Chemistry","trend":null,"strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Basic equations competence needs development","teacherComment":"Needs significant improvement in equations understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Chemistry","trend":null,"strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Limited practicals understanding requires support","teacherComment":"Shows limited grasp of practicals requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Chemistry","trend":null,"strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Weak calculations skills need improvement","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Chemistry","trend":null,"strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Below average reactions demands attention","teacherComment":"Displays below average reactions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Chemistry","trend":"up","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Slight equations improvement noted recently","teacherComment":"Requires urgent intervention for equations development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Chemistry","trend":"up","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Small practicals gains need building","teacherComment":"Shows very poor understanding of practicals needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Chemistry","trend":"up","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Initial calculations progress requires support","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Chemistry","trend":"up","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Emerging reactions needs consistent work","teacherComment":"Displays minimal reactions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Chemistry","trend":"down","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Critical equations weakness requires intervention","teacherComment":"Requires urgent intervention for equations development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Chemistry","trend":"down","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Severely poor practicals needs immediate help","teacherComment":"Shows very poor understanding of practicals needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Chemistry","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Very poor calculations demands urgent attention","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Chemistry","trend":"down","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Failing reactions requires extensive support","teacherComment":"Displays minimal reactions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Chemistry","trend":"flat","strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Very weak equations requires urgent intervention","teacherComment":"Requires urgent intervention for equations development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Chemistry","trend":"flat","strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Poor practicals understanding needs extensive support","teacherComment":"Shows very poor understanding of practicals needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Chemistry","trend":"flat","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Severely limited calculations demands attention","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Chemistry","trend":"flat","strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Minimal reactions competence needs development","teacherComment":"Displays minimal reactions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Chemistry","trend":null,"strengthTags":["equations"],"weaknessTags":["equations"],"subjectRemark":"Very weak equations needs extensive work","teacherComment":"Requires urgent intervention for equations development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Chemistry","trend":null,"strengthTags":["practicals"],"weaknessTags":["balancing"],"subjectRemark":"Poor practicals competence requires support","teacherComment":"Shows very poor understanding of practicals needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Chemistry","trend":null,"strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Severely limited calculations demands attention","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Chemistry","trend":null,"strengthTags":["reactions"],"weaknessTags":["practicals"],"subjectRemark":"Minimal reactions understanding needs development","teacherComment":"Displays minimal reactions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Biology","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Exceptional diagrams skills improving steadily","teacherComment":"Demonstrates outstanding mastery of diagrams with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Biology","trend":"up","strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Outstanding classification mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of classification across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Biology","trend":"up","strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Remarkable processes progress shown consistently","teacherComment":"Displays remarkable proficiency in processes with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Biology","trend":"up","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Excellent practicals techniques advancing well","teacherComment":"Exhibits excellent command of practicals throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Biology","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Good diagrams despite slight decline","teacherComment":"Demonstrates outstanding mastery of diagrams with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Biology","trend":"down","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Strong classification foundation remains solid","teacherComment":"Shows exceptional understanding of classification across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Biology","trend":"down","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Capable processes skills need reinforcement","teacherComment":"Displays remarkable proficiency in processes with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Biology","trend":"down","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Previously strong practicals needs attention","teacherComment":"Exhibits excellent command of practicals throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Biology","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Consistently excellent diagrams performance shown","teacherComment":"Demonstrates outstanding mastery of diagrams with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Biology","trend":"flat","strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Sustained high classification standards maintained","teacherComment":"Shows exceptional understanding of classification across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Biology","trend":"flat","strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Reliable processes excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in processes with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Biology","trend":"flat","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Maintained outstanding practicals proficiency level","teacherComment":"Exhibits excellent command of practicals throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Biology","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Outstanding diagrams competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of diagrams with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Biology","trend":null,"strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Exceptional classification understanding demonstrated well","teacherComment":"Shows exceptional understanding of classification across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Biology","trend":null,"strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Excellent processes application shown consistently","teacherComment":"Displays remarkable proficiency in processes with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Biology","trend":null,"strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Remarkable practicals proficiency observed throughout","teacherComment":"Exhibits excellent command of practicals throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Biology","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Good diagrams skills developing steadily","teacherComment":"Shows strong understanding of diagrams with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Biology","trend":"up","strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Strong classification progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in classification skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Biology","trend":"up","strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Commendable processes improvement shown consistently","teacherComment":"Displays good grasp of processes concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Biology","trend":"up","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Very good practicals advancement observed","teacherComment":"Shows very good performance in practicals applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Biology","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Fair diagrams despite recent decline","teacherComment":"Shows strong understanding of diagrams with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Biology","trend":"down","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Adequate classification needs more practice","teacherComment":"Demonstrates commendable progress in classification skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Biology","trend":"down","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Basic processes requires strengthening now","teacherComment":"Displays good grasp of processes concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Biology","trend":"down","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Practicals skills slipping slightly","teacherComment":"Shows very good performance in practicals applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Biology","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Consistent good diagrams performance maintained","teacherComment":"Shows strong understanding of diagrams with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Biology","trend":"flat","strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Reliable classification competence shown throughout","teacherComment":"Demonstrates commendable progress in classification skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Biology","trend":"flat","strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Steady processes understanding demonstrated well","teacherComment":"Displays good grasp of processes concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Biology","trend":"flat","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Maintained good practicals standard overall","teacherComment":"Shows very good performance in practicals applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Biology","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Good diagrams competence displayed clearly","teacherComment":"Shows strong understanding of diagrams with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Biology","trend":null,"strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Strong classification understanding shown well","teacherComment":"Demonstrates commendable progress in classification skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Biology","trend":null,"strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Commendable processes application demonstrated consistently","teacherComment":"Displays good grasp of processes concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Biology","trend":null,"strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Very good practicals proficiency observed","teacherComment":"Shows very good performance in practicals applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Biology","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Improving diagrams skills shown clearly","teacherComment":"Understanding of diagrams is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Biology","trend":"up","strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Developing classification competence observed positively","teacherComment":"Shows fair grasp of classification concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Biology","trend":"up","strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Growing processes understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in processes skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Biology","trend":"up","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Advancing practicals proficiency evident now","teacherComment":"Displays average competence in practicals applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Biology","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Declining diagrams requires urgent attention","teacherComment":"Understanding of diagrams is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Biology","trend":"down","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Weakening classification skills need support","teacherComment":"Shows fair grasp of classification concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Biology","trend":"down","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Processes foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in processes skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Biology","trend":"down","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Struggling practicals needs immediate improvement","teacherComment":"Displays average competence in practicals applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Biology","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Satisfactory diagrams performance maintained steadily","teacherComment":"Understanding of diagrams is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Biology","trend":"flat","strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Average classification competence shown consistently","teacherComment":"Shows fair grasp of classification concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Biology","trend":"flat","strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Fair processes understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in processes skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Biology","trend":"flat","strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Adequate practicals level sustained overall","teacherComment":"Displays average competence in practicals applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Biology","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Satisfactory diagrams competence shown adequately","teacherComment":"Understanding of diagrams is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Biology","trend":null,"strengthTags":["classification"],"weaknessTags":[],"subjectRemark":"Average classification understanding demonstrated fairly","teacherComment":"Shows fair grasp of classification concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Biology","trend":null,"strengthTags":["processes"],"weaknessTags":[],"subjectRemark":"Fair processes application observed throughout","teacherComment":"Demonstrates satisfactory progress in processes skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Biology","trend":null,"strengthTags":["practicals"],"weaknessTags":[],"subjectRemark":"Adequate practicals proficiency displayed overall","teacherComment":"Displays average competence in practicals applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Biology","trend":"up","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Gradual diagrams improvement beginning slowly","teacherComment":"Needs significant improvement in diagrams understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Biology","trend":"up","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Emerging classification skills need encouragement","teacherComment":"Shows limited grasp of classification requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Biology","trend":"up","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Slight processes progress shown tentatively","teacherComment":"Demonstrates weak processes skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Biology","trend":"up","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Developing practicals requires consistent effort","teacherComment":"Displays below average practicals competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Biology","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Poor diagrams declining needs intervention","teacherComment":"Needs significant improvement in diagrams understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Biology","trend":"down","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Weak classification requires immediate support","teacherComment":"Shows limited grasp of classification requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Biology","trend":"down","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Struggling processes needs urgent help","teacherComment":"Demonstrates weak processes skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Biology","trend":"down","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Very weak practicals demands attention","teacherComment":"Displays below average practicals competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Biology","trend":"flat","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Basic diagrams understanding needs strengthening","teacherComment":"Needs significant improvement in diagrams understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Biology","trend":"flat","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Limited classification competence requires support","teacherComment":"Shows limited grasp of classification requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Biology","trend":"flat","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Weak processes skills need development","teacherComment":"Demonstrates weak processes skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Biology","trend":"flat","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Below average practicals needs attention","teacherComment":"Displays below average practicals competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Biology","trend":null,"strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Basic diagrams competence needs development","teacherComment":"Needs significant improvement in diagrams understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Biology","trend":null,"strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Limited classification understanding requires support","teacherComment":"Shows limited grasp of classification requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Biology","trend":null,"strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Weak processes skills need improvement","teacherComment":"Demonstrates weak processes skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Biology","trend":null,"strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Below average practicals demands attention","teacherComment":"Displays below average practicals competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Biology","trend":"up","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Slight diagrams improvement noted recently","teacherComment":"Requires urgent intervention for diagrams development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Biology","trend":"up","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Small classification gains need building","teacherComment":"Shows very poor understanding of classification needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Biology","trend":"up","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Initial processes progress requires support","teacherComment":"Demonstrates critical weakness in processes requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Biology","trend":"up","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Emerging practicals needs consistent work","teacherComment":"Displays minimal practicals competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Biology","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Critical diagrams weakness requires intervention","teacherComment":"Requires urgent intervention for diagrams development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Biology","trend":"down","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Severely poor classification needs immediate help","teacherComment":"Shows very poor understanding of classification needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Biology","trend":"down","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Very poor processes demands urgent attention","teacherComment":"Demonstrates critical weakness in processes requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Biology","trend":"down","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Failing practicals requires extensive support","teacherComment":"Displays minimal practicals competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Biology","trend":"flat","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Very weak diagrams requires urgent intervention","teacherComment":"Requires urgent intervention for diagrams development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Biology","trend":"flat","strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Poor classification understanding needs extensive support","teacherComment":"Shows very poor understanding of classification needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Biology","trend":"flat","strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Severely limited processes demands attention","teacherComment":"Demonstrates critical weakness in processes requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Biology","trend":"flat","strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Minimal practicals competence needs development","teacherComment":"Displays minimal practicals competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Biology","trend":null,"strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Very weak diagrams needs extensive work","teacherComment":"Requires urgent intervention for diagrams development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Biology","trend":null,"strengthTags":["classification"],"weaknessTags":["terminology"],"subjectRemark":"Poor classification competence requires support","teacherComment":"Shows very poor understanding of classification needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Biology","trend":null,"strengthTags":["processes"],"weaknessTags":["details"],"subjectRemark":"Severely limited processes demands attention","teacherComment":"Demonstrates critical weakness in processes requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Biology","trend":null,"strengthTags":["practicals"],"weaknessTags":["practicals"],"subjectRemark":"Minimal practicals understanding needs development","teacherComment":"Displays minimal practicals competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"English","trend":"up","strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Exceptional grammar skills improving steadily","teacherComment":"Demonstrates outstanding mastery of grammar with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"English","trend":"up","strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Outstanding comprehension mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of comprehension across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"English","trend":"up","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Remarkable writing progress shown consistently","teacherComment":"Displays remarkable proficiency in writing with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"English","trend":"up","strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Excellent vocabulary techniques advancing well","teacherComment":"Exhibits excellent command of vocabulary throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"English","trend":"down","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Good grammar despite slight decline","teacherComment":"Demonstrates outstanding mastery of grammar with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"English","trend":"down","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Strong comprehension foundation remains solid","teacherComment":"Shows exceptional understanding of comprehension across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"English","trend":"down","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Capable writing skills need reinforcement","teacherComment":"Displays remarkable proficiency in writing with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"English","trend":"down","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Previously strong vocabulary needs attention","teacherComment":"Exhibits excellent command of vocabulary throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"English","trend":"flat","strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Consistently excellent grammar performance shown","teacherComment":"Demonstrates outstanding mastery of grammar with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"English","trend":"flat","strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Sustained high comprehension standards maintained","teacherComment":"Shows exceptional understanding of comprehension across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"English","trend":"flat","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Reliable writing excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in writing with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"English","trend":"flat","strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Maintained outstanding vocabulary proficiency level","teacherComment":"Exhibits excellent command of vocabulary throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"English","trend":null,"strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Outstanding grammar competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of grammar with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"English","trend":null,"strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Exceptional comprehension understanding demonstrated well","teacherComment":"Shows exceptional understanding of comprehension across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"English","trend":null,"strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Excellent writing application shown consistently","teacherComment":"Displays remarkable proficiency in writing with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"English","trend":null,"strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Remarkable vocabulary proficiency observed throughout","teacherComment":"Exhibits excellent command of vocabulary throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"English","trend":"up","strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Good grammar skills developing steadily","teacherComment":"Shows strong understanding of grammar with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"English","trend":"up","strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Strong comprehension progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in comprehension skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"English","trend":"up","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Commendable writing improvement shown consistently","teacherComment":"Displays good grasp of writing concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"English","trend":"up","strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Very good vocabulary advancement observed","teacherComment":"Shows very good performance in vocabulary applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"English","trend":"down","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Fair grammar despite recent decline","teacherComment":"Shows strong understanding of grammar with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"English","trend":"down","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Adequate comprehension needs more practice","teacherComment":"Demonstrates commendable progress in comprehension skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"English","trend":"down","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Basic writing requires strengthening now","teacherComment":"Displays good grasp of writing concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"English","trend":"down","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Vocabulary skills slipping slightly","teacherComment":"Shows very good performance in vocabulary applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"English","trend":"flat","strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Consistent good grammar performance maintained","teacherComment":"Shows strong understanding of grammar with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"English","trend":"flat","strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Reliable comprehension competence shown throughout","teacherComment":"Demonstrates commendable progress in comprehension skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"English","trend":"flat","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Steady writing understanding demonstrated well","teacherComment":"Displays good grasp of writing concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"English","trend":"flat","strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Maintained good vocabulary standard overall","teacherComment":"Shows very good performance in vocabulary applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"English","trend":null,"strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Good grammar competence displayed clearly","teacherComment":"Shows strong understanding of grammar with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"English","trend":null,"strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Strong comprehension understanding shown well","teacherComment":"Demonstrates commendable progress in comprehension skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"English","trend":null,"strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Commendable writing application demonstrated consistently","teacherComment":"Displays good grasp of writing concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"English","trend":null,"strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Very good vocabulary proficiency observed","teacherComment":"Shows very good performance in vocabulary applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"English","trend":"up","strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Improving grammar skills shown clearly","teacherComment":"Understanding of grammar is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"English","trend":"up","strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Developing comprehension competence observed positively","teacherComment":"Shows fair grasp of comprehension concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"English","trend":"up","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Growing writing understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in writing skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"English","trend":"up","strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Advancing vocabulary proficiency evident now","teacherComment":"Displays average competence in vocabulary applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"English","trend":"down","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Declining grammar requires urgent attention","teacherComment":"Understanding of grammar is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"English","trend":"down","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Weakening comprehension skills need support","teacherComment":"Shows fair grasp of comprehension concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"English","trend":"down","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Writing foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in writing skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"English","trend":"down","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Struggling vocabulary needs immediate improvement","teacherComment":"Displays average competence in vocabulary applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"English","trend":"flat","strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Satisfactory grammar performance maintained steadily","teacherComment":"Understanding of grammar is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"English","trend":"flat","strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Average comprehension competence shown consistently","teacherComment":"Shows fair grasp of comprehension concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"English","trend":"flat","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Fair writing understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in writing skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"English","trend":"flat","strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Adequate vocabulary level sustained overall","teacherComment":"Displays average competence in vocabulary applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"English","trend":null,"strengthTags":["grammar"],"weaknessTags":[],"subjectRemark":"Satisfactory grammar competence shown adequately","teacherComment":"Understanding of grammar is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"English","trend":null,"strengthTags":["comprehension"],"weaknessTags":[],"subjectRemark":"Average comprehension understanding demonstrated fairly","teacherComment":"Shows fair grasp of comprehension concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"English","trend":null,"strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Fair writing application observed throughout","teacherComment":"Demonstrates satisfactory progress in writing skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"English","trend":null,"strengthTags":["vocabulary"],"weaknessTags":[],"subjectRemark":"Adequate vocabulary proficiency displayed overall","teacherComment":"Displays average competence in vocabulary applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"English","trend":"up","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Gradual grammar improvement beginning slowly","teacherComment":"Needs significant improvement in grammar understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"English","trend":"up","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Emerging comprehension skills need encouragement","teacherComment":"Shows limited grasp of comprehension requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"English","trend":"up","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Slight writing progress shown tentatively","teacherComment":"Demonstrates weak writing skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"English","trend":"up","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Developing vocabulary requires consistent effort","teacherComment":"Displays below average vocabulary competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"English","trend":"down","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Poor grammar declining needs intervention","teacherComment":"Needs significant improvement in grammar understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"English","trend":"down","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Weak comprehension requires immediate support","teacherComment":"Shows limited grasp of comprehension requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"English","trend":"down","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Struggling writing needs urgent help","teacherComment":"Demonstrates weak writing skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"English","trend":"down","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Very weak vocabulary demands attention","teacherComment":"Displays below average vocabulary competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"English","trend":"flat","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Basic grammar understanding needs strengthening","teacherComment":"Needs significant improvement in grammar understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"English","trend":"flat","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Limited comprehension competence requires support","teacherComment":"Shows limited grasp of comprehension requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"English","trend":"flat","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Weak writing skills need development","teacherComment":"Demonstrates weak writing skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"English","trend":"flat","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Below average vocabulary needs attention","teacherComment":"Displays below average vocabulary competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"English","trend":null,"strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Basic grammar competence needs development","teacherComment":"Needs significant improvement in grammar understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"English","trend":null,"strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Limited comprehension understanding requires support","teacherComment":"Shows limited grasp of comprehension requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"English","trend":null,"strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Weak writing skills need improvement","teacherComment":"Demonstrates weak writing skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"English","trend":null,"strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Below average vocabulary demands attention","teacherComment":"Displays below average vocabulary competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"English","trend":"up","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Slight grammar improvement noted recently","teacherComment":"Requires urgent intervention for grammar development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"English","trend":"up","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Small comprehension gains need building","teacherComment":"Shows very poor understanding of comprehension needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"English","trend":"up","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Initial writing progress requires support","teacherComment":"Demonstrates critical weakness in writing requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"English","trend":"up","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Emerging vocabulary needs consistent work","teacherComment":"Displays minimal vocabulary competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"English","trend":"down","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Critical grammar weakness requires intervention","teacherComment":"Requires urgent intervention for grammar development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"English","trend":"down","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Severely poor comprehension needs immediate help","teacherComment":"Shows very poor understanding of comprehension needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"English","trend":"down","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Very poor writing demands urgent attention","teacherComment":"Demonstrates critical weakness in writing requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"English","trend":"down","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Failing vocabulary requires extensive support","teacherComment":"Displays minimal vocabulary competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"English","trend":"flat","strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Very weak grammar requires urgent intervention","teacherComment":"Requires urgent intervention for grammar development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"English","trend":"flat","strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Poor comprehension understanding needs extensive support","teacherComment":"Shows very poor understanding of comprehension needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"English","trend":"flat","strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Severely limited writing demands attention","teacherComment":"Demonstrates critical weakness in writing requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"English","trend":"flat","strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Minimal vocabulary competence needs development","teacherComment":"Displays minimal vocabulary competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"English","trend":null,"strengthTags":["grammar"],"weaknessTags":["grammar"],"subjectRemark":"Very weak grammar needs extensive work","teacherComment":"Requires urgent intervention for grammar development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"English","trend":null,"strengthTags":["comprehension"],"weaknessTags":["spelling"],"subjectRemark":"Poor comprehension competence requires support","teacherComment":"Shows very poor understanding of comprehension needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"English","trend":null,"strengthTags":["writing"],"weaknessTags":["punctuation"],"subjectRemark":"Severely limited writing demands attention","teacherComment":"Demonstrates critical weakness in writing requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"English","trend":null,"strengthTags":["vocabulary"],"weaknessTags":["vocabulary"],"subjectRemark":"Minimal vocabulary understanding needs development","teacherComment":"Displays minimal vocabulary competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Literature","trend":"up","strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Exceptional themes skills improving steadily","teacherComment":"Demonstrates outstanding mastery of themes with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Literature","trend":"up","strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Outstanding characters mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of characters across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Literature","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Remarkable analysis progress shown consistently","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Literature","trend":"up","strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Excellent quotations techniques advancing well","teacherComment":"Exhibits excellent command of quotations throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Literature","trend":"down","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Good themes despite slight decline","teacherComment":"Demonstrates outstanding mastery of themes with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Literature","trend":"down","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Strong characters foundation remains solid","teacherComment":"Shows exceptional understanding of characters across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Literature","trend":"down","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Capable analysis skills need reinforcement","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Literature","trend":"down","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Previously strong quotations needs attention","teacherComment":"Exhibits excellent command of quotations throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Literature","trend":"flat","strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Consistently excellent themes performance shown","teacherComment":"Demonstrates outstanding mastery of themes with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Literature","trend":"flat","strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Sustained high characters standards maintained","teacherComment":"Shows exceptional understanding of characters across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Literature","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Reliable analysis excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Literature","trend":"flat","strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Maintained outstanding quotations proficiency level","teacherComment":"Exhibits excellent command of quotations throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Literature","trend":null,"strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Outstanding themes competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of themes with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Literature","trend":null,"strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Exceptional characters understanding demonstrated well","teacherComment":"Shows exceptional understanding of characters across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Literature","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Excellent analysis application shown consistently","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Literature","trend":null,"strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Remarkable quotations proficiency observed throughout","teacherComment":"Exhibits excellent command of quotations throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Literature","trend":"up","strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Good themes skills developing steadily","teacherComment":"Shows strong understanding of themes with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Literature","trend":"up","strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Strong characters progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in characters skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Literature","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Commendable analysis improvement shown consistently","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Literature","trend":"up","strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Very good quotations advancement observed","teacherComment":"Shows very good performance in quotations applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Literature","trend":"down","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Fair themes despite recent decline","teacherComment":"Shows strong understanding of themes with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Literature","trend":"down","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Adequate characters needs more practice","teacherComment":"Demonstrates commendable progress in characters skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Literature","trend":"down","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Basic analysis requires strengthening now","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Literature","trend":"down","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Quotations skills slipping slightly","teacherComment":"Shows very good performance in quotations applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Literature","trend":"flat","strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Consistent good themes performance maintained","teacherComment":"Shows strong understanding of themes with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Literature","trend":"flat","strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Reliable characters competence shown throughout","teacherComment":"Demonstrates commendable progress in characters skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Literature","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Steady analysis understanding demonstrated well","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Literature","trend":"flat","strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Maintained good quotations standard overall","teacherComment":"Shows very good performance in quotations applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Literature","trend":null,"strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Good themes competence displayed clearly","teacherComment":"Shows strong understanding of themes with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Literature","trend":null,"strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Strong characters understanding shown well","teacherComment":"Demonstrates commendable progress in characters skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Literature","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Commendable analysis application demonstrated consistently","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Literature","trend":null,"strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Very good quotations proficiency observed","teacherComment":"Shows very good performance in quotations applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Literature","trend":"up","strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Improving themes skills shown clearly","teacherComment":"Understanding of themes is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Literature","trend":"up","strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Developing characters competence observed positively","teacherComment":"Shows fair grasp of characters concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Literature","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Growing analysis understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Literature","trend":"up","strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Advancing quotations proficiency evident now","teacherComment":"Displays average competence in quotations applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Literature","trend":"down","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Declining themes requires urgent attention","teacherComment":"Understanding of themes is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Literature","trend":"down","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Weakening characters skills need support","teacherComment":"Shows fair grasp of characters concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Literature","trend":"down","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Analysis foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Literature","trend":"down","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Struggling quotations needs immediate improvement","teacherComment":"Displays average competence in quotations applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Literature","trend":"flat","strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Satisfactory themes performance maintained steadily","teacherComment":"Understanding of themes is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Literature","trend":"flat","strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Average characters competence shown consistently","teacherComment":"Shows fair grasp of characters concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Literature","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Fair analysis understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Literature","trend":"flat","strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Adequate quotations level sustained overall","teacherComment":"Displays average competence in quotations applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Literature","trend":null,"strengthTags":["themes"],"weaknessTags":[],"subjectRemark":"Satisfactory themes competence shown adequately","teacherComment":"Understanding of themes is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Literature","trend":null,"strengthTags":["characters"],"weaknessTags":[],"subjectRemark":"Average characters understanding demonstrated fairly","teacherComment":"Shows fair grasp of characters concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Literature","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Fair analysis application observed throughout","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Literature","trend":null,"strengthTags":["quotations"],"weaknessTags":[],"subjectRemark":"Adequate quotations proficiency displayed overall","teacherComment":"Displays average competence in quotations applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Literature","trend":"up","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Gradual themes improvement beginning slowly","teacherComment":"Needs significant improvement in themes understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Literature","trend":"up","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Emerging characters skills need encouragement","teacherComment":"Shows limited grasp of characters requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Literature","trend":"up","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Slight analysis progress shown tentatively","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Literature","trend":"up","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Developing quotations requires consistent effort","teacherComment":"Displays below average quotations competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Literature","trend":"down","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Poor themes declining needs intervention","teacherComment":"Needs significant improvement in themes understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Literature","trend":"down","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Weak characters requires immediate support","teacherComment":"Shows limited grasp of characters requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Literature","trend":"down","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Struggling analysis needs urgent help","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Literature","trend":"down","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Very weak quotations demands attention","teacherComment":"Displays below average quotations competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Literature","trend":"flat","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Basic themes understanding needs strengthening","teacherComment":"Needs significant improvement in themes understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Literature","trend":"flat","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Limited characters competence requires support","teacherComment":"Shows limited grasp of characters requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Literature","trend":"flat","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Weak analysis skills need development","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Literature","trend":"flat","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Below average quotations needs attention","teacherComment":"Displays below average quotations competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Literature","trend":null,"strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Basic themes competence needs development","teacherComment":"Needs significant improvement in themes understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Literature","trend":null,"strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Limited characters understanding requires support","teacherComment":"Shows limited grasp of characters requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Literature","trend":null,"strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Weak analysis skills need improvement","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Literature","trend":null,"strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Below average quotations demands attention","teacherComment":"Displays below average quotations competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Literature","trend":"up","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Slight themes improvement noted recently","teacherComment":"Requires urgent intervention for themes development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Literature","trend":"up","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Small characters gains need building","teacherComment":"Shows very poor understanding of characters needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Literature","trend":"up","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Initial analysis progress requires support","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Literature","trend":"up","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Emerging quotations needs consistent work","teacherComment":"Displays minimal quotations competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Literature","trend":"down","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Critical themes weakness requires intervention","teacherComment":"Requires urgent intervention for themes development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Literature","trend":"down","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Severely poor characters needs immediate help","teacherComment":"Shows very poor understanding of characters needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Literature","trend":"down","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Very poor analysis demands urgent attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Literature","trend":"down","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Failing quotations requires extensive support","teacherComment":"Displays minimal quotations competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Literature","trend":"flat","strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Very weak themes requires urgent intervention","teacherComment":"Requires urgent intervention for themes development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Literature","trend":"flat","strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Poor characters understanding needs extensive support","teacherComment":"Shows very poor understanding of characters needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Literature","trend":"flat","strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Severely limited analysis demands attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Literature","trend":"flat","strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Minimal quotations competence needs development","teacherComment":"Displays minimal quotations competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Literature","trend":null,"strengthTags":["themes"],"weaknessTags":["analysis"],"subjectRemark":"Very weak themes needs extensive work","teacherComment":"Requires urgent intervention for themes development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Literature","trend":null,"strengthTags":["characters"],"weaknessTags":["quotations"],"subjectRemark":"Poor characters competence requires support","teacherComment":"Shows very poor understanding of characters needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Literature","trend":null,"strengthTags":["analysis"],"weaknessTags":["essays"],"subjectRemark":"Severely limited analysis demands attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Literature","trend":null,"strengthTags":["quotations"],"weaknessTags":["interpretation"],"subjectRemark":"Minimal quotations understanding needs development","teacherComment":"Displays minimal quotations competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Economics","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Exceptional concepts skills improving steadily","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Economics","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Outstanding calculations mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Economics","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Remarkable diagrams progress shown consistently","teacherComment":"Displays remarkable proficiency in diagrams with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Economics","trend":"up","strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Excellent definitions techniques advancing well","teacherComment":"Exhibits excellent command of definitions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Economics","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Good concepts despite slight decline","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Economics","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Strong calculations foundation remains solid","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Economics","trend":"down","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Capable diagrams skills need reinforcement","teacherComment":"Displays remarkable proficiency in diagrams with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Economics","trend":"down","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Previously strong definitions needs attention","teacherComment":"Exhibits excellent command of definitions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Economics","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Consistently excellent concepts performance shown","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Economics","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Sustained high calculations standards maintained","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Economics","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Reliable diagrams excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in diagrams with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Economics","trend":"flat","strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Maintained outstanding definitions proficiency level","teacherComment":"Exhibits excellent command of definitions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Economics","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Outstanding concepts competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Economics","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Exceptional calculations understanding demonstrated well","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Economics","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Excellent diagrams application shown consistently","teacherComment":"Displays remarkable proficiency in diagrams with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Economics","trend":null,"strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Remarkable definitions proficiency observed throughout","teacherComment":"Exhibits excellent command of definitions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Economics","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Good concepts skills developing steadily","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Economics","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Strong calculations progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Economics","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Commendable diagrams improvement shown consistently","teacherComment":"Displays good grasp of diagrams concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Economics","trend":"up","strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Very good definitions advancement observed","teacherComment":"Shows very good performance in definitions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Economics","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Fair concepts despite recent decline","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Economics","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Adequate calculations needs more practice","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Economics","trend":"down","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Basic diagrams requires strengthening now","teacherComment":"Displays good grasp of diagrams concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Economics","trend":"down","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Definitions skills slipping slightly","teacherComment":"Shows very good performance in definitions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Economics","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Consistent good concepts performance maintained","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Economics","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Reliable calculations competence shown throughout","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Economics","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Steady diagrams understanding demonstrated well","teacherComment":"Displays good grasp of diagrams concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Economics","trend":"flat","strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Maintained good definitions standard overall","teacherComment":"Shows very good performance in definitions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Economics","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Good concepts competence displayed clearly","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Economics","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Strong calculations understanding shown well","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Economics","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Commendable diagrams application demonstrated consistently","teacherComment":"Displays good grasp of diagrams concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Economics","trend":null,"strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Very good definitions proficiency observed","teacherComment":"Shows very good performance in definitions applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Economics","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Improving concepts skills shown clearly","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Economics","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Developing calculations competence observed positively","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Economics","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Growing diagrams understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in diagrams skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Economics","trend":"up","strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Advancing definitions proficiency evident now","teacherComment":"Displays average competence in definitions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Economics","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Declining concepts requires urgent attention","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Economics","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Weakening calculations skills need support","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Economics","trend":"down","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Diagrams foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in diagrams skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Economics","trend":"down","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Struggling definitions needs immediate improvement","teacherComment":"Displays average competence in definitions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Economics","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Satisfactory concepts performance maintained steadily","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Economics","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Average calculations competence shown consistently","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Economics","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Fair diagrams understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in diagrams skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Economics","trend":"flat","strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Adequate definitions level sustained overall","teacherComment":"Displays average competence in definitions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Economics","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Satisfactory concepts competence shown adequately","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Economics","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Average calculations understanding demonstrated fairly","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Economics","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Fair diagrams application observed throughout","teacherComment":"Demonstrates satisfactory progress in diagrams skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Economics","trend":null,"strengthTags":["definitions"],"weaknessTags":[],"subjectRemark":"Adequate definitions proficiency displayed overall","teacherComment":"Displays average competence in definitions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Economics","trend":"up","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Gradual concepts improvement beginning slowly","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Economics","trend":"up","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Emerging calculations skills need encouragement","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Economics","trend":"up","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Slight diagrams progress shown tentatively","teacherComment":"Demonstrates weak diagrams skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Economics","trend":"up","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Developing definitions requires consistent effort","teacherComment":"Displays below average definitions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Economics","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Poor concepts declining needs intervention","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Economics","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Weak calculations requires immediate support","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Economics","trend":"down","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Struggling diagrams needs urgent help","teacherComment":"Demonstrates weak diagrams skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Economics","trend":"down","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Very weak definitions demands attention","teacherComment":"Displays below average definitions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Economics","trend":"flat","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Basic concepts understanding needs strengthening","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Economics","trend":"flat","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Limited calculations competence requires support","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Economics","trend":"flat","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Weak diagrams skills need development","teacherComment":"Demonstrates weak diagrams skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Economics","trend":"flat","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Below average definitions needs attention","teacherComment":"Displays below average definitions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Economics","trend":null,"strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Basic concepts competence needs development","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Economics","trend":null,"strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Limited calculations understanding requires support","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Economics","trend":null,"strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Weak diagrams skills need improvement","teacherComment":"Demonstrates weak diagrams skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Economics","trend":null,"strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Below average definitions demands attention","teacherComment":"Displays below average definitions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Economics","trend":"up","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Slight concepts improvement noted recently","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Economics","trend":"up","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Small calculations gains need building","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Economics","trend":"up","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Initial diagrams progress requires support","teacherComment":"Demonstrates critical weakness in diagrams requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Economics","trend":"up","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Emerging definitions needs consistent work","teacherComment":"Displays minimal definitions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Economics","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Critical concepts weakness requires intervention","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Economics","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Severely poor calculations needs immediate help","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Economics","trend":"down","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Very poor diagrams demands urgent attention","teacherComment":"Demonstrates critical weakness in diagrams requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Economics","trend":"down","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Failing definitions requires extensive support","teacherComment":"Displays minimal definitions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Economics","trend":"flat","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Very weak concepts requires urgent intervention","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Economics","trend":"flat","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Poor calculations understanding needs extensive support","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Economics","trend":"flat","strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Severely limited diagrams demands attention","teacherComment":"Demonstrates critical weakness in diagrams requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Economics","trend":"flat","strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Minimal definitions competence needs development","teacherComment":"Displays minimal definitions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Economics","trend":null,"strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Very weak concepts needs extensive work","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Economics","trend":null,"strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Poor calculations competence requires support","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Economics","trend":null,"strengthTags":["diagrams"],"weaknessTags":["examples"],"subjectRemark":"Severely limited diagrams demands attention","teacherComment":"Demonstrates critical weakness in diagrams requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Economics","trend":null,"strengthTags":["definitions"],"weaknessTags":["diagrams"],"subjectRemark":"Minimal definitions understanding needs development","teacherComment":"Displays minimal definitions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Commerce","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Exceptional concepts skills improving steadily","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Commerce","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Outstanding calculations mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Commerce","trend":"up","strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Remarkable documents progress shown consistently","teacherComment":"Displays remarkable proficiency in documents with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Commerce","trend":"up","strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Excellent procedures techniques advancing well","teacherComment":"Exhibits excellent command of procedures throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Commerce","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Good concepts despite slight decline","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Commerce","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Strong calculations foundation remains solid","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Commerce","trend":"down","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Capable documents skills need reinforcement","teacherComment":"Displays remarkable proficiency in documents with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Commerce","trend":"down","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Previously strong procedures needs attention","teacherComment":"Exhibits excellent command of procedures throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Commerce","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Consistently excellent concepts performance shown","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Commerce","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Sustained high calculations standards maintained","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Commerce","trend":"flat","strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Reliable documents excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in documents with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Commerce","trend":"flat","strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Maintained outstanding procedures proficiency level","teacherComment":"Exhibits excellent command of procedures throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Commerce","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Outstanding concepts competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Commerce","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Exceptional calculations understanding demonstrated well","teacherComment":"Shows exceptional understanding of calculations across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Commerce","trend":null,"strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Excellent documents application shown consistently","teacherComment":"Displays remarkable proficiency in documents with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Commerce","trend":null,"strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Remarkable procedures proficiency observed throughout","teacherComment":"Exhibits excellent command of procedures throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Commerce","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Good concepts skills developing steadily","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Commerce","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Strong calculations progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Commerce","trend":"up","strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Commendable documents improvement shown consistently","teacherComment":"Displays good grasp of documents concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Commerce","trend":"up","strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Very good procedures advancement observed","teacherComment":"Shows very good performance in procedures applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Commerce","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Fair concepts despite recent decline","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Commerce","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Adequate calculations needs more practice","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Commerce","trend":"down","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Basic documents requires strengthening now","teacherComment":"Displays good grasp of documents concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Commerce","trend":"down","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Procedures skills slipping slightly","teacherComment":"Shows very good performance in procedures applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Commerce","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Consistent good concepts performance maintained","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Commerce","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Reliable calculations competence shown throughout","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Commerce","trend":"flat","strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Steady documents understanding demonstrated well","teacherComment":"Displays good grasp of documents concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Commerce","trend":"flat","strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Maintained good procedures standard overall","teacherComment":"Shows very good performance in procedures applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Commerce","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Good concepts competence displayed clearly","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Commerce","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Strong calculations understanding shown well","teacherComment":"Demonstrates commendable progress in calculations skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Commerce","trend":null,"strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Commendable documents application demonstrated consistently","teacherComment":"Displays good grasp of documents concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Commerce","trend":null,"strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Very good procedures proficiency observed","teacherComment":"Shows very good performance in procedures applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Commerce","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Improving concepts skills shown clearly","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Commerce","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Developing calculations competence observed positively","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Commerce","trend":"up","strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Growing documents understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in documents skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Commerce","trend":"up","strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Advancing procedures proficiency evident now","teacherComment":"Displays average competence in procedures applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Commerce","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Declining concepts requires urgent attention","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Commerce","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Weakening calculations skills need support","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Commerce","trend":"down","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Documents foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in documents skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Commerce","trend":"down","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Struggling procedures needs immediate improvement","teacherComment":"Displays average competence in procedures applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Commerce","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Satisfactory concepts performance maintained steadily","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Commerce","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Average calculations competence shown consistently","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Commerce","trend":"flat","strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Fair documents understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in documents skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Commerce","trend":"flat","strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Adequate procedures level sustained overall","teacherComment":"Displays average competence in procedures applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Commerce","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Satisfactory concepts competence shown adequately","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Commerce","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Average calculations understanding demonstrated fairly","teacherComment":"Shows fair grasp of calculations concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Commerce","trend":null,"strengthTags":["documents"],"weaknessTags":[],"subjectRemark":"Fair documents application observed throughout","teacherComment":"Demonstrates satisfactory progress in documents skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Commerce","trend":null,"strengthTags":["procedures"],"weaknessTags":[],"subjectRemark":"Adequate procedures proficiency displayed overall","teacherComment":"Displays average competence in procedures applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Commerce","trend":"up","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Gradual concepts improvement beginning slowly","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Commerce","trend":"up","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Emerging calculations skills need encouragement","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Commerce","trend":"up","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Slight documents progress shown tentatively","teacherComment":"Demonstrates weak documents skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Commerce","trend":"up","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Developing procedures requires consistent effort","teacherComment":"Displays below average procedures competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Commerce","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Poor concepts declining needs intervention","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Commerce","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Weak calculations requires immediate support","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Commerce","trend":"down","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Struggling documents needs urgent help","teacherComment":"Demonstrates weak documents skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Commerce","trend":"down","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Very weak procedures demands attention","teacherComment":"Displays below average procedures competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Commerce","trend":"flat","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Basic concepts understanding needs strengthening","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Commerce","trend":"flat","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Limited calculations competence requires support","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Commerce","trend":"flat","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Weak documents skills need development","teacherComment":"Demonstrates weak documents skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Commerce","trend":"flat","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Below average procedures needs attention","teacherComment":"Displays below average procedures competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Commerce","trend":null,"strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Basic concepts competence needs development","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Commerce","trend":null,"strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Limited calculations understanding requires support","teacherComment":"Shows limited grasp of calculations requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Commerce","trend":null,"strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Weak documents skills need improvement","teacherComment":"Demonstrates weak documents skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Commerce","trend":null,"strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Below average procedures demands attention","teacherComment":"Displays below average procedures competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Commerce","trend":"up","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Slight concepts improvement noted recently","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Commerce","trend":"up","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Small calculations gains need building","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Commerce","trend":"up","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Initial documents progress requires support","teacherComment":"Demonstrates critical weakness in documents requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Commerce","trend":"up","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Emerging procedures needs consistent work","teacherComment":"Displays minimal procedures competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Commerce","trend":"down","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Critical concepts weakness requires intervention","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Commerce","trend":"down","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Severely poor calculations needs immediate help","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Commerce","trend":"down","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Very poor documents demands urgent attention","teacherComment":"Demonstrates critical weakness in documents requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Commerce","trend":"down","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Failing procedures requires extensive support","teacherComment":"Displays minimal procedures competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Commerce","trend":"flat","strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Very weak concepts requires urgent intervention","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Commerce","trend":"flat","strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Poor calculations understanding needs extensive support","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Commerce","trend":"flat","strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Severely limited documents demands attention","teacherComment":"Demonstrates critical weakness in documents requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Commerce","trend":"flat","strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Minimal procedures competence needs development","teacherComment":"Displays minimal procedures competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Commerce","trend":null,"strengthTags":["concepts"],"weaknessTags":["definitions"],"subjectRemark":"Very weak concepts needs extensive work","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Commerce","trend":null,"strengthTags":["calculations"],"weaknessTags":["calculations"],"subjectRemark":"Poor calculations competence requires support","teacherComment":"Shows very poor understanding of calculations needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Commerce","trend":null,"strengthTags":["documents"],"weaknessTags":["documents"],"subjectRemark":"Severely limited documents demands attention","teacherComment":"Demonstrates critical weakness in documents requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Commerce","trend":null,"strengthTags":["procedures"],"weaknessTags":["procedures"],"subjectRemark":"Minimal procedures understanding needs development","teacherComment":"Displays minimal procedures competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Accounting","trend":"up","strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Exceptional formats skills improving steadily","teacherComment":"Demonstrates outstanding mastery of formats with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Accounting","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Outstanding accuracy mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of accuracy across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Accounting","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Remarkable calculations progress shown consistently","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Accounting","trend":"up","strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Excellent entries techniques advancing well","teacherComment":"Exhibits excellent command of entries throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Accounting","trend":"down","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Good formats despite slight decline","teacherComment":"Demonstrates outstanding mastery of formats with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Accounting","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Strong accuracy foundation remains solid","teacherComment":"Shows exceptional understanding of accuracy across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Accounting","trend":"down","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Capable calculations skills need reinforcement","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Accounting","trend":"down","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Previously strong entries needs attention","teacherComment":"Exhibits excellent command of entries throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Accounting","trend":"flat","strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Consistently excellent formats performance shown","teacherComment":"Demonstrates outstanding mastery of formats with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Accounting","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Sustained high accuracy standards maintained","teacherComment":"Shows exceptional understanding of accuracy across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Accounting","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Reliable calculations excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Accounting","trend":"flat","strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Maintained outstanding entries proficiency level","teacherComment":"Exhibits excellent command of entries throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Accounting","trend":null,"strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Outstanding formats competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of formats with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Accounting","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Exceptional accuracy understanding demonstrated well","teacherComment":"Shows exceptional understanding of accuracy across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Accounting","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Excellent calculations application shown consistently","teacherComment":"Displays remarkable proficiency in calculations with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Accounting","trend":null,"strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Remarkable entries proficiency observed throughout","teacherComment":"Exhibits excellent command of entries throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Accounting","trend":"up","strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Good formats skills developing steadily","teacherComment":"Shows strong understanding of formats with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Accounting","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Strong accuracy progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in accuracy skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Accounting","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Commendable calculations improvement shown consistently","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Accounting","trend":"up","strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Very good entries advancement observed","teacherComment":"Shows very good performance in entries applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Accounting","trend":"down","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Fair formats despite recent decline","teacherComment":"Shows strong understanding of formats with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Accounting","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Adequate accuracy needs more practice","teacherComment":"Demonstrates commendable progress in accuracy skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Accounting","trend":"down","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Basic calculations requires strengthening now","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Accounting","trend":"down","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Entries skills slipping slightly","teacherComment":"Shows very good performance in entries applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Accounting","trend":"flat","strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Consistent good formats performance maintained","teacherComment":"Shows strong understanding of formats with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Accounting","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Reliable accuracy competence shown throughout","teacherComment":"Demonstrates commendable progress in accuracy skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Accounting","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Steady calculations understanding demonstrated well","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Accounting","trend":"flat","strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Maintained good entries standard overall","teacherComment":"Shows very good performance in entries applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Accounting","trend":null,"strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Good formats competence displayed clearly","teacherComment":"Shows strong understanding of formats with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Accounting","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Strong accuracy understanding shown well","teacherComment":"Demonstrates commendable progress in accuracy skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Accounting","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Commendable calculations application demonstrated consistently","teacherComment":"Displays good grasp of calculations concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Accounting","trend":null,"strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Very good entries proficiency observed","teacherComment":"Shows very good performance in entries applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Accounting","trend":"up","strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Improving formats skills shown clearly","teacherComment":"Understanding of formats is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Accounting","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Developing accuracy competence observed positively","teacherComment":"Shows fair grasp of accuracy concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Accounting","trend":"up","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Growing calculations understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Accounting","trend":"up","strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Advancing entries proficiency evident now","teacherComment":"Displays average competence in entries applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Accounting","trend":"down","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Declining formats requires urgent attention","teacherComment":"Understanding of formats is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Accounting","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Weakening accuracy skills need support","teacherComment":"Shows fair grasp of accuracy concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Accounting","trend":"down","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Calculations foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Accounting","trend":"down","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Struggling entries needs immediate improvement","teacherComment":"Displays average competence in entries applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Accounting","trend":"flat","strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Satisfactory formats performance maintained steadily","teacherComment":"Understanding of formats is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Accounting","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Average accuracy competence shown consistently","teacherComment":"Shows fair grasp of accuracy concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Accounting","trend":"flat","strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Fair calculations understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Accounting","trend":"flat","strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Adequate entries level sustained overall","teacherComment":"Displays average competence in entries applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Accounting","trend":null,"strengthTags":["formats"],"weaknessTags":[],"subjectRemark":"Satisfactory formats competence shown adequately","teacherComment":"Understanding of formats is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Accounting","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Average accuracy understanding demonstrated fairly","teacherComment":"Shows fair grasp of accuracy concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Accounting","trend":null,"strengthTags":["calculations"],"weaknessTags":[],"subjectRemark":"Fair calculations application observed throughout","teacherComment":"Demonstrates satisfactory progress in calculations skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Accounting","trend":null,"strengthTags":["entries"],"weaknessTags":[],"subjectRemark":"Adequate entries proficiency displayed overall","teacherComment":"Displays average competence in entries applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Accounting","trend":"up","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Gradual formats improvement beginning slowly","teacherComment":"Needs significant improvement in formats understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Accounting","trend":"up","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Emerging accuracy skills need encouragement","teacherComment":"Shows limited grasp of accuracy requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Accounting","trend":"up","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Slight calculations progress shown tentatively","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Accounting","trend":"up","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Developing entries requires consistent effort","teacherComment":"Displays below average entries competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Accounting","trend":"down","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Poor formats declining needs intervention","teacherComment":"Needs significant improvement in formats understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Accounting","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Weak accuracy requires immediate support","teacherComment":"Shows limited grasp of accuracy requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Accounting","trend":"down","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Struggling calculations needs urgent help","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Accounting","trend":"down","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Very weak entries demands attention","teacherComment":"Displays below average entries competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Accounting","trend":"flat","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Basic formats understanding needs strengthening","teacherComment":"Needs significant improvement in formats understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Accounting","trend":"flat","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Limited accuracy competence requires support","teacherComment":"Shows limited grasp of accuracy requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Accounting","trend":"flat","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Weak calculations skills need development","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Accounting","trend":"flat","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Below average entries needs attention","teacherComment":"Displays below average entries competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Accounting","trend":null,"strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Basic formats competence needs development","teacherComment":"Needs significant improvement in formats understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Accounting","trend":null,"strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Limited accuracy understanding requires support","teacherComment":"Shows limited grasp of accuracy requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Accounting","trend":null,"strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Weak calculations skills need improvement","teacherComment":"Demonstrates weak calculations skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Accounting","trend":null,"strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Below average entries demands attention","teacherComment":"Displays below average entries competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Accounting","trend":"up","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Slight formats improvement noted recently","teacherComment":"Requires urgent intervention for formats development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Accounting","trend":"up","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Small accuracy gains need building","teacherComment":"Shows very poor understanding of accuracy needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Accounting","trend":"up","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Initial calculations progress requires support","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Accounting","trend":"up","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Emerging entries needs consistent work","teacherComment":"Displays minimal entries competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Accounting","trend":"down","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Critical formats weakness requires intervention","teacherComment":"Requires urgent intervention for formats development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Accounting","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Severely poor accuracy needs immediate help","teacherComment":"Shows very poor understanding of accuracy needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Accounting","trend":"down","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Very poor calculations demands urgent attention","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Accounting","trend":"down","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Failing entries requires extensive support","teacherComment":"Displays minimal entries competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Accounting","trend":"flat","strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Very weak formats requires urgent intervention","teacherComment":"Requires urgent intervention for formats development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Accounting","trend":"flat","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Poor accuracy understanding needs extensive support","teacherComment":"Shows very poor understanding of accuracy needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Accounting","trend":"flat","strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Severely limited calculations demands attention","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Accounting","trend":"flat","strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Minimal entries competence needs development","teacherComment":"Displays minimal entries competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Accounting","trend":null,"strengthTags":["formats"],"weaknessTags":["formats"],"subjectRemark":"Very weak formats needs extensive work","teacherComment":"Requires urgent intervention for formats development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Accounting","trend":null,"strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Poor accuracy competence requires support","teacherComment":"Shows very poor understanding of accuracy needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Accounting","trend":null,"strengthTags":["calculations"],"weaknessTags":["speed"],"subjectRemark":"Severely limited calculations demands attention","teacherComment":"Demonstrates critical weakness in calculations requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Accounting","trend":null,"strengthTags":["entries"],"weaknessTags":["workings"],"subjectRemark":"Minimal entries understanding needs development","teacherComment":"Displays minimal entries competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Government","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Exceptional concepts skills improving steadily","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Government","trend":"up","strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Outstanding examples mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of examples across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Government","trend":"up","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Remarkable essays progress shown consistently","teacherComment":"Displays remarkable proficiency in essays with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Government","trend":"up","strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Excellent structure techniques advancing well","teacherComment":"Exhibits excellent command of structure throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Government","trend":"down","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Good concepts despite slight decline","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Government","trend":"down","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Strong examples foundation remains solid","teacherComment":"Shows exceptional understanding of examples across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Government","trend":"down","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Capable essays skills need reinforcement","teacherComment":"Displays remarkable proficiency in essays with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Government","trend":"down","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Previously strong structure needs attention","teacherComment":"Exhibits excellent command of structure throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Government","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Consistently excellent concepts performance shown","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Government","trend":"flat","strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Sustained high examples standards maintained","teacherComment":"Shows exceptional understanding of examples across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Government","trend":"flat","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Reliable essays excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in essays with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Government","trend":"flat","strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Maintained outstanding structure proficiency level","teacherComment":"Exhibits excellent command of structure throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Government","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Outstanding concepts competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of concepts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Government","trend":null,"strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Exceptional examples understanding demonstrated well","teacherComment":"Shows exceptional understanding of examples across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Government","trend":null,"strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Excellent essays application shown consistently","teacherComment":"Displays remarkable proficiency in essays with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Government","trend":null,"strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Remarkable structure proficiency observed throughout","teacherComment":"Exhibits excellent command of structure throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Government","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Good concepts skills developing steadily","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Government","trend":"up","strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Strong examples progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in examples skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Government","trend":"up","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Commendable essays improvement shown consistently","teacherComment":"Displays good grasp of essays concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Government","trend":"up","strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Very good structure advancement observed","teacherComment":"Shows very good performance in structure applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Government","trend":"down","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Fair concepts despite recent decline","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Government","trend":"down","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Adequate examples needs more practice","teacherComment":"Demonstrates commendable progress in examples skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Government","trend":"down","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Basic essays requires strengthening now","teacherComment":"Displays good grasp of essays concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Government","trend":"down","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Structure skills slipping slightly","teacherComment":"Shows very good performance in structure applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Government","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Consistent good concepts performance maintained","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Government","trend":"flat","strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Reliable examples competence shown throughout","teacherComment":"Demonstrates commendable progress in examples skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Government","trend":"flat","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Steady essays understanding demonstrated well","teacherComment":"Displays good grasp of essays concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Government","trend":"flat","strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Maintained good structure standard overall","teacherComment":"Shows very good performance in structure applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Government","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Good concepts competence displayed clearly","teacherComment":"Shows strong understanding of concepts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Government","trend":null,"strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Strong examples understanding shown well","teacherComment":"Demonstrates commendable progress in examples skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Government","trend":null,"strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Commendable essays application demonstrated consistently","teacherComment":"Displays good grasp of essays concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Government","trend":null,"strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Very good structure proficiency observed","teacherComment":"Shows very good performance in structure applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Government","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Improving concepts skills shown clearly","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Government","trend":"up","strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Developing examples competence observed positively","teacherComment":"Shows fair grasp of examples concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Government","trend":"up","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Growing essays understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in essays skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Government","trend":"up","strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Advancing structure proficiency evident now","teacherComment":"Displays average competence in structure applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Government","trend":"down","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Declining concepts requires urgent attention","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Government","trend":"down","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Weakening examples skills need support","teacherComment":"Shows fair grasp of examples concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Government","trend":"down","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Essays foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in essays skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Government","trend":"down","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Struggling structure needs immediate improvement","teacherComment":"Displays average competence in structure applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Government","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Satisfactory concepts performance maintained steadily","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Government","trend":"flat","strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Average examples competence shown consistently","teacherComment":"Shows fair grasp of examples concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Government","trend":"flat","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Fair essays understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in essays skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Government","trend":"flat","strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Adequate structure level sustained overall","teacherComment":"Displays average competence in structure applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Government","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Satisfactory concepts competence shown adequately","teacherComment":"Understanding of concepts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Government","trend":null,"strengthTags":["examples"],"weaknessTags":[],"subjectRemark":"Average examples understanding demonstrated fairly","teacherComment":"Shows fair grasp of examples concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Government","trend":null,"strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Fair essays application observed throughout","teacherComment":"Demonstrates satisfactory progress in essays skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Government","trend":null,"strengthTags":["structure"],"weaknessTags":[],"subjectRemark":"Adequate structure proficiency displayed overall","teacherComment":"Displays average competence in structure applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Government","trend":"up","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Gradual concepts improvement beginning slowly","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Government","trend":"up","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Emerging examples skills need encouragement","teacherComment":"Shows limited grasp of examples requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Government","trend":"up","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Slight essays progress shown tentatively","teacherComment":"Demonstrates weak essays skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Government","trend":"up","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Developing structure requires consistent effort","teacherComment":"Displays below average structure competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Government","trend":"down","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Poor concepts declining needs intervention","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Government","trend":"down","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Weak examples requires immediate support","teacherComment":"Shows limited grasp of examples requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Government","trend":"down","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Struggling essays needs urgent help","teacherComment":"Demonstrates weak essays skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Government","trend":"down","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Very weak structure demands attention","teacherComment":"Displays below average structure competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Government","trend":"flat","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Basic concepts understanding needs strengthening","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Government","trend":"flat","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Limited examples competence requires support","teacherComment":"Shows limited grasp of examples requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Government","trend":"flat","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Weak essays skills need development","teacherComment":"Demonstrates weak essays skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Government","trend":"flat","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Below average structure needs attention","teacherComment":"Displays below average structure competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Government","trend":null,"strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Basic concepts competence needs development","teacherComment":"Needs significant improvement in concepts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Government","trend":null,"strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Limited examples understanding requires support","teacherComment":"Shows limited grasp of examples requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Government","trend":null,"strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Weak essays skills need improvement","teacherComment":"Demonstrates weak essays skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Government","trend":null,"strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Below average structure demands attention","teacherComment":"Displays below average structure competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Government","trend":"up","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Slight concepts improvement noted recently","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Government","trend":"up","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Small examples gains need building","teacherComment":"Shows very poor understanding of examples needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Government","trend":"up","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Initial essays progress requires support","teacherComment":"Demonstrates critical weakness in essays requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Government","trend":"up","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Emerging structure needs consistent work","teacherComment":"Displays minimal structure competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Government","trend":"down","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Critical concepts weakness requires intervention","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Government","trend":"down","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Severely poor examples needs immediate help","teacherComment":"Shows very poor understanding of examples needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Government","trend":"down","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Very poor essays demands urgent attention","teacherComment":"Demonstrates critical weakness in essays requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Government","trend":"down","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Failing structure requires extensive support","teacherComment":"Displays minimal structure competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Government","trend":"flat","strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Very weak concepts requires urgent intervention","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Government","trend":"flat","strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Poor examples understanding needs extensive support","teacherComment":"Shows very poor understanding of examples needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Government","trend":"flat","strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Severely limited essays demands attention","teacherComment":"Demonstrates critical weakness in essays requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Government","trend":"flat","strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Minimal structure competence needs development","teacherComment":"Displays minimal structure competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Government","trend":null,"strengthTags":["concepts"],"weaknessTags":["examples"],"subjectRemark":"Very weak concepts needs extensive work","teacherComment":"Requires urgent intervention for concepts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Government","trend":null,"strengthTags":["examples"],"weaknessTags":["details"],"subjectRemark":"Poor examples competence requires support","teacherComment":"Shows very poor understanding of examples needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Government","trend":null,"strengthTags":["essays"],"weaknessTags":["structure"],"subjectRemark":"Severely limited essays demands attention","teacherComment":"Demonstrates critical weakness in essays requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Government","trend":null,"strengthTags":["structure"],"weaknessTags":["depth"],"subjectRemark":"Minimal structure understanding needs development","teacherComment":"Displays minimal structure competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"History","trend":"up","strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Exceptional facts skills improving steadily","teacherComment":"Demonstrates outstanding mastery of facts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"History","trend":"up","strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Outstanding dates mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of dates across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"History","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Remarkable analysis progress shown consistently","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"History","trend":"up","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Excellent essays techniques advancing well","teacherComment":"Exhibits excellent command of essays throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"History","trend":"down","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Good facts despite slight decline","teacherComment":"Demonstrates outstanding mastery of facts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"History","trend":"down","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Strong dates foundation remains solid","teacherComment":"Shows exceptional understanding of dates across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"History","trend":"down","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Capable analysis skills need reinforcement","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"History","trend":"down","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Previously strong essays needs attention","teacherComment":"Exhibits excellent command of essays throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"History","trend":"flat","strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Consistently excellent facts performance shown","teacherComment":"Demonstrates outstanding mastery of facts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"History","trend":"flat","strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Sustained high dates standards maintained","teacherComment":"Shows exceptional understanding of dates across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"History","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Reliable analysis excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"History","trend":"flat","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Maintained outstanding essays proficiency level","teacherComment":"Exhibits excellent command of essays throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"History","trend":null,"strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Outstanding facts competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of facts with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"History","trend":null,"strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Exceptional dates understanding demonstrated well","teacherComment":"Shows exceptional understanding of dates across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"History","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Excellent analysis application shown consistently","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"History","trend":null,"strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Remarkable essays proficiency observed throughout","teacherComment":"Exhibits excellent command of essays throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"History","trend":"up","strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Good facts skills developing steadily","teacherComment":"Shows strong understanding of facts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"History","trend":"up","strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Strong dates progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in dates skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"History","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Commendable analysis improvement shown consistently","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"History","trend":"up","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Very good essays advancement observed","teacherComment":"Shows very good performance in essays applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"History","trend":"down","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Fair facts despite recent decline","teacherComment":"Shows strong understanding of facts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"History","trend":"down","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Adequate dates needs more practice","teacherComment":"Demonstrates commendable progress in dates skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"History","trend":"down","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Basic analysis requires strengthening now","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"History","trend":"down","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Essays skills slipping slightly","teacherComment":"Shows very good performance in essays applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"History","trend":"flat","strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Consistent good facts performance maintained","teacherComment":"Shows strong understanding of facts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"History","trend":"flat","strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Reliable dates competence shown throughout","teacherComment":"Demonstrates commendable progress in dates skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"History","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Steady analysis understanding demonstrated well","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"History","trend":"flat","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Maintained good essays standard overall","teacherComment":"Shows very good performance in essays applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"History","trend":null,"strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Good facts competence displayed clearly","teacherComment":"Shows strong understanding of facts with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"History","trend":null,"strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Strong dates understanding shown well","teacherComment":"Demonstrates commendable progress in dates skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"History","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Commendable analysis application demonstrated consistently","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"History","trend":null,"strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Very good essays proficiency observed","teacherComment":"Shows very good performance in essays applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"History","trend":"up","strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Improving facts skills shown clearly","teacherComment":"Understanding of facts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"History","trend":"up","strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Developing dates competence observed positively","teacherComment":"Shows fair grasp of dates concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"History","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Growing analysis understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"History","trend":"up","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Advancing essays proficiency evident now","teacherComment":"Displays average competence in essays applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"History","trend":"down","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Declining facts requires urgent attention","teacherComment":"Understanding of facts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"History","trend":"down","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Weakening dates skills need support","teacherComment":"Shows fair grasp of dates concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"History","trend":"down","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Analysis foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"History","trend":"down","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Struggling essays needs immediate improvement","teacherComment":"Displays average competence in essays applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"History","trend":"flat","strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Satisfactory facts performance maintained steadily","teacherComment":"Understanding of facts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"History","trend":"flat","strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Average dates competence shown consistently","teacherComment":"Shows fair grasp of dates concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"History","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Fair analysis understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"History","trend":"flat","strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Adequate essays level sustained overall","teacherComment":"Displays average competence in essays applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"History","trend":null,"strengthTags":["facts"],"weaknessTags":[],"subjectRemark":"Satisfactory facts competence shown adequately","teacherComment":"Understanding of facts is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"History","trend":null,"strengthTags":["dates"],"weaknessTags":[],"subjectRemark":"Average dates understanding demonstrated fairly","teacherComment":"Shows fair grasp of dates concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"History","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Fair analysis application observed throughout","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"History","trend":null,"strengthTags":["essays"],"weaknessTags":[],"subjectRemark":"Adequate essays proficiency displayed overall","teacherComment":"Displays average competence in essays applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"History","trend":"up","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Gradual facts improvement beginning slowly","teacherComment":"Needs significant improvement in facts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"History","trend":"up","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Emerging dates skills need encouragement","teacherComment":"Shows limited grasp of dates requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"History","trend":"up","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Slight analysis progress shown tentatively","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"History","trend":"up","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Developing essays requires consistent effort","teacherComment":"Displays below average essays competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"History","trend":"down","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Poor facts declining needs intervention","teacherComment":"Needs significant improvement in facts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"History","trend":"down","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Weak dates requires immediate support","teacherComment":"Shows limited grasp of dates requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"History","trend":"down","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Struggling analysis needs urgent help","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"History","trend":"down","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Very weak essays demands attention","teacherComment":"Displays below average essays competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"History","trend":"flat","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Basic facts understanding needs strengthening","teacherComment":"Needs significant improvement in facts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"History","trend":"flat","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Limited dates competence requires support","teacherComment":"Shows limited grasp of dates requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"History","trend":"flat","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Weak analysis skills need development","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"History","trend":"flat","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Below average essays needs attention","teacherComment":"Displays below average essays competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"History","trend":null,"strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Basic facts competence needs development","teacherComment":"Needs significant improvement in facts understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"History","trend":null,"strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Limited dates understanding requires support","teacherComment":"Shows limited grasp of dates requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"History","trend":null,"strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Weak analysis skills need improvement","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"History","trend":null,"strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Below average essays demands attention","teacherComment":"Displays below average essays competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"History","trend":"up","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Slight facts improvement noted recently","teacherComment":"Requires urgent intervention for facts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"History","trend":"up","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Small dates gains need building","teacherComment":"Shows very poor understanding of dates needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"History","trend":"up","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Initial analysis progress requires support","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"History","trend":"up","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Emerging essays needs consistent work","teacherComment":"Displays minimal essays competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"History","trend":"down","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Critical facts weakness requires intervention","teacherComment":"Requires urgent intervention for facts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"History","trend":"down","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Severely poor dates needs immediate help","teacherComment":"Shows very poor understanding of dates needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"History","trend":"down","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Very poor analysis demands urgent attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"History","trend":"down","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Failing essays requires extensive support","teacherComment":"Displays minimal essays competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"History","trend":"flat","strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Very weak facts requires urgent intervention","teacherComment":"Requires urgent intervention for facts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"History","trend":"flat","strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Poor dates understanding needs extensive support","teacherComment":"Shows very poor understanding of dates needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"History","trend":"flat","strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Severely limited analysis demands attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"History","trend":"flat","strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Minimal essays competence needs development","teacherComment":"Displays minimal essays competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"History","trend":null,"strengthTags":["facts"],"weaknessTags":["dates"],"subjectRemark":"Very weak facts needs extensive work","teacherComment":"Requires urgent intervention for facts development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"History","trend":null,"strengthTags":["dates"],"weaknessTags":["details"],"subjectRemark":"Poor dates competence requires support","teacherComment":"Shows very poor understanding of dates needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"History","trend":null,"strengthTags":["analysis"],"weaknessTags":["analysis"],"subjectRemark":"Severely limited analysis demands attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"History","trend":null,"strengthTags":["essays"],"weaknessTags":["essays"],"subjectRemark":"Minimal essays understanding needs development","teacherComment":"Displays minimal essays competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Geography","trend":"up","strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Exceptional maps skills improving steadily","teacherComment":"Demonstrates outstanding mastery of maps with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Geography","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Outstanding diagrams mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of diagrams across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Geography","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Remarkable concepts progress shown consistently","teacherComment":"Displays remarkable proficiency in concepts with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Geography","trend":"up","strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Excellent case studies techniques advancing well","teacherComment":"Exhibits excellent command of case studies throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Geography","trend":"down","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Good maps despite slight decline","teacherComment":"Demonstrates outstanding mastery of maps with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Geography","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Strong diagrams foundation remains solid","teacherComment":"Shows exceptional understanding of diagrams across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Geography","trend":"down","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Capable concepts skills need reinforcement","teacherComment":"Displays remarkable proficiency in concepts with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Geography","trend":"down","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Previously strong case studies needs attention","teacherComment":"Exhibits excellent command of case studies throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Geography","trend":"flat","strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Consistently excellent maps performance shown","teacherComment":"Demonstrates outstanding mastery of maps with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Geography","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Sustained high diagrams standards maintained","teacherComment":"Shows exceptional understanding of diagrams across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Geography","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Reliable concepts excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in concepts with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Geography","trend":"flat","strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Maintained outstanding case studies proficiency level","teacherComment":"Exhibits excellent command of case studies throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Geography","trend":null,"strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Outstanding maps competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of maps with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Geography","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Exceptional diagrams understanding demonstrated well","teacherComment":"Shows exceptional understanding of diagrams across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Geography","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Excellent concepts application shown consistently","teacherComment":"Displays remarkable proficiency in concepts with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Geography","trend":null,"strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Remarkable case studies proficiency observed throughout","teacherComment":"Exhibits excellent command of case studies throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Geography","trend":"up","strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Good maps skills developing steadily","teacherComment":"Shows strong understanding of maps with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Geography","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Strong diagrams progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in diagrams skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Geography","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Commendable concepts improvement shown consistently","teacherComment":"Displays good grasp of concepts concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Geography","trend":"up","strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Very good case studies advancement observed","teacherComment":"Shows very good performance in case studies applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Geography","trend":"down","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Fair maps despite recent decline","teacherComment":"Shows strong understanding of maps with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Geography","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Adequate diagrams needs more practice","teacherComment":"Demonstrates commendable progress in diagrams skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Geography","trend":"down","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Basic concepts requires strengthening now","teacherComment":"Displays good grasp of concepts concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Geography","trend":"down","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Case studies skills slipping slightly","teacherComment":"Shows very good performance in case studies applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Geography","trend":"flat","strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Consistent good maps performance maintained","teacherComment":"Shows strong understanding of maps with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Geography","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Reliable diagrams competence shown throughout","teacherComment":"Demonstrates commendable progress in diagrams skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Geography","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Steady concepts understanding demonstrated well","teacherComment":"Displays good grasp of concepts concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Geography","trend":"flat","strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Maintained good case studies standard overall","teacherComment":"Shows very good performance in case studies applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Geography","trend":null,"strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Good maps competence displayed clearly","teacherComment":"Shows strong understanding of maps with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Geography","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Strong diagrams understanding shown well","teacherComment":"Demonstrates commendable progress in diagrams skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Geography","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Commendable concepts application demonstrated consistently","teacherComment":"Displays good grasp of concepts concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Geography","trend":null,"strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Very good case studies proficiency observed","teacherComment":"Shows very good performance in case studies applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Geography","trend":"up","strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Improving maps skills shown clearly","teacherComment":"Understanding of maps is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Geography","trend":"up","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Developing diagrams competence observed positively","teacherComment":"Shows fair grasp of diagrams concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Geography","trend":"up","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Growing concepts understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in concepts skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Geography","trend":"up","strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Advancing case studies proficiency evident now","teacherComment":"Displays average competence in case studies applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Geography","trend":"down","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Declining maps requires urgent attention","teacherComment":"Understanding of maps is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Geography","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Weakening diagrams skills need support","teacherComment":"Shows fair grasp of diagrams concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Geography","trend":"down","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Concepts foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in concepts skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Geography","trend":"down","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Struggling case studies needs immediate improvement","teacherComment":"Displays average competence in case studies applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Geography","trend":"flat","strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Satisfactory maps performance maintained steadily","teacherComment":"Understanding of maps is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Geography","trend":"flat","strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Average diagrams competence shown consistently","teacherComment":"Shows fair grasp of diagrams concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Geography","trend":"flat","strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Fair concepts understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in concepts skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Geography","trend":"flat","strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Adequate case studies level sustained overall","teacherComment":"Displays average competence in case studies applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Geography","trend":null,"strengthTags":["maps"],"weaknessTags":[],"subjectRemark":"Satisfactory maps competence shown adequately","teacherComment":"Understanding of maps is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Geography","trend":null,"strengthTags":["diagrams"],"weaknessTags":[],"subjectRemark":"Average diagrams understanding demonstrated fairly","teacherComment":"Shows fair grasp of diagrams concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Geography","trend":null,"strengthTags":["concepts"],"weaknessTags":[],"subjectRemark":"Fair concepts application observed throughout","teacherComment":"Demonstrates satisfactory progress in concepts skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Geography","trend":null,"strengthTags":["case studies"],"weaknessTags":[],"subjectRemark":"Adequate case studies proficiency displayed overall","teacherComment":"Displays average competence in case studies applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Geography","trend":"up","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Gradual maps improvement beginning slowly","teacherComment":"Needs significant improvement in maps understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Geography","trend":"up","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Emerging diagrams skills need encouragement","teacherComment":"Shows limited grasp of diagrams requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Geography","trend":"up","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Slight concepts progress shown tentatively","teacherComment":"Demonstrates weak concepts skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Geography","trend":"up","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Developing case studies requires consistent effort","teacherComment":"Displays below average case studies competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Geography","trend":"down","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Poor maps declining needs intervention","teacherComment":"Needs significant improvement in maps understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Geography","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Weak diagrams requires immediate support","teacherComment":"Shows limited grasp of diagrams requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Geography","trend":"down","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Struggling concepts needs urgent help","teacherComment":"Demonstrates weak concepts skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Geography","trend":"down","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Very weak case studies demands attention","teacherComment":"Displays below average case studies competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Geography","trend":"flat","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Basic maps understanding needs strengthening","teacherComment":"Needs significant improvement in maps understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Geography","trend":"flat","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Limited diagrams competence requires support","teacherComment":"Shows limited grasp of diagrams requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Geography","trend":"flat","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Weak concepts skills need development","teacherComment":"Demonstrates weak concepts skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Geography","trend":"flat","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Below average case studies needs attention","teacherComment":"Displays below average case studies competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Geography","trend":null,"strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Basic maps competence needs development","teacherComment":"Needs significant improvement in maps understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Geography","trend":null,"strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Limited diagrams understanding requires support","teacherComment":"Shows limited grasp of diagrams requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Geography","trend":null,"strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Weak concepts skills need improvement","teacherComment":"Demonstrates weak concepts skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Geography","trend":null,"strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Below average case studies demands attention","teacherComment":"Displays below average case studies competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Geography","trend":"up","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Slight maps improvement noted recently","teacherComment":"Requires urgent intervention for maps development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Geography","trend":"up","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Small diagrams gains need building","teacherComment":"Shows very poor understanding of diagrams needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Geography","trend":"up","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Initial concepts progress requires support","teacherComment":"Demonstrates critical weakness in concepts requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Geography","trend":"up","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Emerging case studies needs consistent work","teacherComment":"Displays minimal case studies competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Geography","trend":"down","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Critical maps weakness requires intervention","teacherComment":"Requires urgent intervention for maps development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Geography","trend":"down","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Severely poor diagrams needs immediate help","teacherComment":"Shows very poor understanding of diagrams needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Geography","trend":"down","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Very poor concepts demands urgent attention","teacherComment":"Demonstrates critical weakness in concepts requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Geography","trend":"down","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Failing case studies requires extensive support","teacherComment":"Displays minimal case studies competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Geography","trend":"flat","strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Very weak maps requires urgent intervention","teacherComment":"Requires urgent intervention for maps development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Geography","trend":"flat","strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Poor diagrams understanding needs extensive support","teacherComment":"Shows very poor understanding of diagrams needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Geography","trend":"flat","strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Severely limited concepts demands attention","teacherComment":"Demonstrates critical weakness in concepts requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Geography","trend":"flat","strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Minimal case studies competence needs development","teacherComment":"Displays minimal case studies competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Geography","trend":null,"strengthTags":["maps"],"weaknessTags":["maps"],"subjectRemark":"Very weak maps needs extensive work","teacherComment":"Requires urgent intervention for maps development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Geography","trend":null,"strengthTags":["diagrams"],"weaknessTags":["diagrams"],"subjectRemark":"Poor diagrams competence requires support","teacherComment":"Shows very poor understanding of diagrams needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Geography","trend":null,"strengthTags":["concepts"],"weaknessTags":["case studies"],"subjectRemark":"Severely limited concepts demands attention","teacherComment":"Demonstrates critical weakness in concepts requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Geography","trend":null,"strengthTags":["case studies"],"weaknessTags":["details"],"subjectRemark":"Minimal case studies understanding needs development","teacherComment":"Displays minimal case studies competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"ICT","trend":"up","strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Exceptional practical skills improving steadily","teacherComment":"Demonstrates outstanding mastery of practical with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"ICT","trend":"up","strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Outstanding tools mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of tools across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"ICT","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Remarkable accuracy progress shown consistently","teacherComment":"Displays remarkable proficiency in accuracy with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"ICT","trend":"up","strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Excellent speed techniques advancing well","teacherComment":"Exhibits excellent command of speed throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"ICT","trend":"down","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Good practical despite slight decline","teacherComment":"Demonstrates outstanding mastery of practical with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"ICT","trend":"down","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Strong tools foundation remains solid","teacherComment":"Shows exceptional understanding of tools across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"ICT","trend":"down","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Capable accuracy skills need reinforcement","teacherComment":"Displays remarkable proficiency in accuracy with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"ICT","trend":"down","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Previously strong speed needs attention","teacherComment":"Exhibits excellent command of speed throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"ICT","trend":"flat","strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Consistently excellent practical performance shown","teacherComment":"Demonstrates outstanding mastery of practical with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"ICT","trend":"flat","strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Sustained high tools standards maintained","teacherComment":"Shows exceptional understanding of tools across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"ICT","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Reliable accuracy excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in accuracy with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"ICT","trend":"flat","strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Maintained outstanding speed proficiency level","teacherComment":"Exhibits excellent command of speed throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"ICT","trend":null,"strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Outstanding practical competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of practical with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"ICT","trend":null,"strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Exceptional tools understanding demonstrated well","teacherComment":"Shows exceptional understanding of tools across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"ICT","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Excellent accuracy application shown consistently","teacherComment":"Displays remarkable proficiency in accuracy with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"ICT","trend":null,"strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Remarkable speed proficiency observed throughout","teacherComment":"Exhibits excellent command of speed throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"ICT","trend":"up","strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Good practical skills developing steadily","teacherComment":"Shows strong understanding of practical with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"ICT","trend":"up","strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Strong tools progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in tools skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"ICT","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Commendable accuracy improvement shown consistently","teacherComment":"Displays good grasp of accuracy concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"ICT","trend":"up","strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Very good speed advancement observed","teacherComment":"Shows very good performance in speed applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"ICT","trend":"down","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Fair practical despite recent decline","teacherComment":"Shows strong understanding of practical with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"ICT","trend":"down","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Adequate tools needs more practice","teacherComment":"Demonstrates commendable progress in tools skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"ICT","trend":"down","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Basic accuracy requires strengthening now","teacherComment":"Displays good grasp of accuracy concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"ICT","trend":"down","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Speed skills slipping slightly","teacherComment":"Shows very good performance in speed applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"ICT","trend":"flat","strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Consistent good practical performance maintained","teacherComment":"Shows strong understanding of practical with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"ICT","trend":"flat","strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Reliable tools competence shown throughout","teacherComment":"Demonstrates commendable progress in tools skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"ICT","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Steady accuracy understanding demonstrated well","teacherComment":"Displays good grasp of accuracy concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"ICT","trend":"flat","strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Maintained good speed standard overall","teacherComment":"Shows very good performance in speed applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"ICT","trend":null,"strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Good practical competence displayed clearly","teacherComment":"Shows strong understanding of practical with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"ICT","trend":null,"strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Strong tools understanding shown well","teacherComment":"Demonstrates commendable progress in tools skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"ICT","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Commendable accuracy application demonstrated consistently","teacherComment":"Displays good grasp of accuracy concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"ICT","trend":null,"strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Very good speed proficiency observed","teacherComment":"Shows very good performance in speed applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"ICT","trend":"up","strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Improving practical skills shown clearly","teacherComment":"Understanding of practical is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"ICT","trend":"up","strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Developing tools competence observed positively","teacherComment":"Shows fair grasp of tools concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"ICT","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Growing accuracy understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in accuracy skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"ICT","trend":"up","strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Advancing speed proficiency evident now","teacherComment":"Displays average competence in speed applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"ICT","trend":"down","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Declining practical requires urgent attention","teacherComment":"Understanding of practical is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"ICT","trend":"down","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Weakening tools skills need support","teacherComment":"Shows fair grasp of tools concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"ICT","trend":"down","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Accuracy foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in accuracy skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"ICT","trend":"down","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Struggling speed needs immediate improvement","teacherComment":"Displays average competence in speed applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"ICT","trend":"flat","strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Satisfactory practical performance maintained steadily","teacherComment":"Understanding of practical is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"ICT","trend":"flat","strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Average tools competence shown consistently","teacherComment":"Shows fair grasp of tools concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"ICT","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Fair accuracy understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in accuracy skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"ICT","trend":"flat","strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Adequate speed level sustained overall","teacherComment":"Displays average competence in speed applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"ICT","trend":null,"strengthTags":["practical"],"weaknessTags":[],"subjectRemark":"Satisfactory practical competence shown adequately","teacherComment":"Understanding of practical is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"ICT","trend":null,"strengthTags":["tools"],"weaknessTags":[],"subjectRemark":"Average tools understanding demonstrated fairly","teacherComment":"Shows fair grasp of tools concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"ICT","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Fair accuracy application observed throughout","teacherComment":"Demonstrates satisfactory progress in accuracy skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"ICT","trend":null,"strengthTags":["speed"],"weaknessTags":[],"subjectRemark":"Adequate speed proficiency displayed overall","teacherComment":"Displays average competence in speed applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"ICT","trend":"up","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Gradual practical improvement beginning slowly","teacherComment":"Needs significant improvement in practical understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"ICT","trend":"up","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Emerging tools skills need encouragement","teacherComment":"Shows limited grasp of tools requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"ICT","trend":"up","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Slight accuracy progress shown tentatively","teacherComment":"Demonstrates weak accuracy skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"ICT","trend":"up","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Developing speed requires consistent effort","teacherComment":"Displays below average speed competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"ICT","trend":"down","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Poor practical declining needs intervention","teacherComment":"Needs significant improvement in practical understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"ICT","trend":"down","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Weak tools requires immediate support","teacherComment":"Shows limited grasp of tools requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"ICT","trend":"down","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Struggling accuracy needs urgent help","teacherComment":"Demonstrates weak accuracy skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"ICT","trend":"down","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Very weak speed demands attention","teacherComment":"Displays below average speed competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"ICT","trend":"flat","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Basic practical understanding needs strengthening","teacherComment":"Needs significant improvement in practical understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"ICT","trend":"flat","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Limited tools competence requires support","teacherComment":"Shows limited grasp of tools requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"ICT","trend":"flat","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Weak accuracy skills need development","teacherComment":"Demonstrates weak accuracy skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"ICT","trend":"flat","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Below average speed needs attention","teacherComment":"Displays below average speed competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"ICT","trend":null,"strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Basic practical competence needs development","teacherComment":"Needs significant improvement in practical understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"ICT","trend":null,"strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Limited tools understanding requires support","teacherComment":"Shows limited grasp of tools requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"ICT","trend":null,"strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Weak accuracy skills need improvement","teacherComment":"Demonstrates weak accuracy skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"ICT","trend":null,"strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Below average speed demands attention","teacherComment":"Displays below average speed competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"ICT","trend":"up","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Slight practical improvement noted recently","teacherComment":"Requires urgent intervention for practical development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"ICT","trend":"up","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Small tools gains need building","teacherComment":"Shows very poor understanding of tools needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"ICT","trend":"up","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Initial accuracy progress requires support","teacherComment":"Demonstrates critical weakness in accuracy requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"ICT","trend":"up","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Emerging speed needs consistent work","teacherComment":"Displays minimal speed competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"ICT","trend":"down","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Critical practical weakness requires intervention","teacherComment":"Requires urgent intervention for practical development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"ICT","trend":"down","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Severely poor tools needs immediate help","teacherComment":"Shows very poor understanding of tools needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"ICT","trend":"down","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Very poor accuracy demands urgent attention","teacherComment":"Demonstrates critical weakness in accuracy requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"ICT","trend":"down","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Failing speed requires extensive support","teacherComment":"Displays minimal speed competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"ICT","trend":"flat","strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Very weak practical requires urgent intervention","teacherComment":"Requires urgent intervention for practical development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"ICT","trend":"flat","strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Poor tools understanding needs extensive support","teacherComment":"Shows very poor understanding of tools needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"ICT","trend":"flat","strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Severely limited accuracy demands attention","teacherComment":"Demonstrates critical weakness in accuracy requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"ICT","trend":"flat","strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Minimal speed competence needs development","teacherComment":"Displays minimal speed competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"ICT","trend":null,"strengthTags":["practical"],"weaknessTags":["practical"],"subjectRemark":"Very weak practical needs extensive work","teacherComment":"Requires urgent intervention for practical development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"ICT","trend":null,"strengthTags":["tools"],"weaknessTags":["theory"],"subjectRemark":"Poor tools competence requires support","teacherComment":"Shows very poor understanding of tools needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"ICT","trend":null,"strengthTags":["accuracy"],"weaknessTags":["speed"],"subjectRemark":"Severely limited accuracy demands attention","teacherComment":"Demonstrates critical weakness in accuracy requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"ICT","trend":null,"strengthTags":["speed"],"weaknessTags":["accuracy"],"subjectRemark":"Minimal speed understanding needs development","teacherComment":"Displays minimal speed competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"Technical Drawing","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Exceptional accuracy skills improving steadily","teacherComment":"Demonstrates outstanding mastery of accuracy with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Technical Drawing","trend":"up","strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Outstanding neatness mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of neatness across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Technical Drawing","trend":"up","strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Remarkable projections progress shown consistently","teacherComment":"Displays remarkable proficiency in projections with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Technical Drawing","trend":"up","strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Excellent dimensions techniques advancing well","teacherComment":"Exhibits excellent command of dimensions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Technical Drawing","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Good accuracy despite slight decline","teacherComment":"Demonstrates outstanding mastery of accuracy with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Technical Drawing","trend":"down","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Strong neatness foundation remains solid","teacherComment":"Shows exceptional understanding of neatness across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Technical Drawing","trend":"down","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Capable projections skills need reinforcement","teacherComment":"Displays remarkable proficiency in projections with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Technical Drawing","trend":"down","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Previously strong dimensions needs attention","teacherComment":"Exhibits excellent command of dimensions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Technical Drawing","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Consistently excellent accuracy performance shown","teacherComment":"Demonstrates outstanding mastery of accuracy with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Technical Drawing","trend":"flat","strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Sustained high neatness standards maintained","teacherComment":"Shows exceptional understanding of neatness across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Technical Drawing","trend":"flat","strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Reliable projections excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in projections with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Technical Drawing","trend":"flat","strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Maintained outstanding dimensions proficiency level","teacherComment":"Exhibits excellent command of dimensions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"Technical Drawing","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Outstanding accuracy competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of accuracy with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"Technical Drawing","trend":null,"strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Exceptional neatness understanding demonstrated well","teacherComment":"Shows exceptional understanding of neatness across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"Technical Drawing","trend":null,"strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Excellent projections application shown consistently","teacherComment":"Displays remarkable proficiency in projections with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"Technical Drawing","trend":null,"strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Remarkable dimensions proficiency observed throughout","teacherComment":"Exhibits excellent command of dimensions throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"Technical Drawing","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Good accuracy skills developing steadily","teacherComment":"Shows strong understanding of accuracy with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Technical Drawing","trend":"up","strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Strong neatness progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in neatness skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Technical Drawing","trend":"up","strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Commendable projections improvement shown consistently","teacherComment":"Displays good grasp of projections concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Technical Drawing","trend":"up","strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Very good dimensions advancement observed","teacherComment":"Shows very good performance in dimensions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Technical Drawing","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Fair accuracy despite recent decline","teacherComment":"Shows strong understanding of accuracy with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Technical Drawing","trend":"down","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Adequate neatness needs more practice","teacherComment":"Demonstrates commendable progress in neatness skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Technical Drawing","trend":"down","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Basic projections requires strengthening now","teacherComment":"Displays good grasp of projections concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Technical Drawing","trend":"down","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Dimensions skills slipping slightly","teacherComment":"Shows very good performance in dimensions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Technical Drawing","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Consistent good accuracy performance maintained","teacherComment":"Shows strong understanding of accuracy with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Technical Drawing","trend":"flat","strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Reliable neatness competence shown throughout","teacherComment":"Demonstrates commendable progress in neatness skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Technical Drawing","trend":"flat","strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Steady projections understanding demonstrated well","teacherComment":"Displays good grasp of projections concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Technical Drawing","trend":"flat","strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Maintained good dimensions standard overall","teacherComment":"Shows very good performance in dimensions applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"Technical Drawing","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Good accuracy competence displayed clearly","teacherComment":"Shows strong understanding of accuracy with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"Technical Drawing","trend":null,"strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Strong neatness understanding shown well","teacherComment":"Demonstrates commendable progress in neatness skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"Technical Drawing","trend":null,"strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Commendable projections application demonstrated consistently","teacherComment":"Displays good grasp of projections concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"Technical Drawing","trend":null,"strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Very good dimensions proficiency observed","teacherComment":"Shows very good performance in dimensions applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"Technical Drawing","trend":"up","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Improving accuracy skills shown clearly","teacherComment":"Understanding of accuracy is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Technical Drawing","trend":"up","strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Developing neatness competence observed positively","teacherComment":"Shows fair grasp of neatness concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Technical Drawing","trend":"up","strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Growing projections understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in projections skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Technical Drawing","trend":"up","strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Advancing dimensions proficiency evident now","teacherComment":"Displays average competence in dimensions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Technical Drawing","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Declining accuracy requires urgent attention","teacherComment":"Understanding of accuracy is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Technical Drawing","trend":"down","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Weakening neatness skills need support","teacherComment":"Shows fair grasp of neatness concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Technical Drawing","trend":"down","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Projections foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in projections skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Technical Drawing","trend":"down","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Struggling dimensions needs immediate improvement","teacherComment":"Displays average competence in dimensions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Technical Drawing","trend":"flat","strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Satisfactory accuracy performance maintained steadily","teacherComment":"Understanding of accuracy is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Technical Drawing","trend":"flat","strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Average neatness competence shown consistently","teacherComment":"Shows fair grasp of neatness concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Technical Drawing","trend":"flat","strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Fair projections understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in projections skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Technical Drawing","trend":"flat","strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Adequate dimensions level sustained overall","teacherComment":"Displays average competence in dimensions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"Technical Drawing","trend":null,"strengthTags":["accuracy"],"weaknessTags":[],"subjectRemark":"Satisfactory accuracy competence shown adequately","teacherComment":"Understanding of accuracy is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"Technical Drawing","trend":null,"strengthTags":["neatness"],"weaknessTags":[],"subjectRemark":"Average neatness understanding demonstrated fairly","teacherComment":"Shows fair grasp of neatness concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"Technical Drawing","trend":null,"strengthTags":["projections"],"weaknessTags":[],"subjectRemark":"Fair projections application observed throughout","teacherComment":"Demonstrates satisfactory progress in projections skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"Technical Drawing","trend":null,"strengthTags":["dimensions"],"weaknessTags":[],"subjectRemark":"Adequate dimensions proficiency displayed overall","teacherComment":"Displays average competence in dimensions applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"Technical Drawing","trend":"up","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Gradual accuracy improvement beginning slowly","teacherComment":"Needs significant improvement in accuracy understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Technical Drawing","trend":"up","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Emerging neatness skills need encouragement","teacherComment":"Shows limited grasp of neatness requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Technical Drawing","trend":"up","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Slight projections progress shown tentatively","teacherComment":"Demonstrates weak projections skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Technical Drawing","trend":"up","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Developing dimensions requires consistent effort","teacherComment":"Displays below average dimensions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Technical Drawing","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Poor accuracy declining needs intervention","teacherComment":"Needs significant improvement in accuracy understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Technical Drawing","trend":"down","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Weak neatness requires immediate support","teacherComment":"Shows limited grasp of neatness requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Technical Drawing","trend":"down","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Struggling projections needs urgent help","teacherComment":"Demonstrates weak projections skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Technical Drawing","trend":"down","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Very weak dimensions demands attention","teacherComment":"Displays below average dimensions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Technical Drawing","trend":"flat","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Basic accuracy understanding needs strengthening","teacherComment":"Needs significant improvement in accuracy understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Technical Drawing","trend":"flat","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Limited neatness competence requires support","teacherComment":"Shows limited grasp of neatness requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Technical Drawing","trend":"flat","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Weak projections skills need development","teacherComment":"Demonstrates weak projections skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Technical Drawing","trend":"flat","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Below average dimensions needs attention","teacherComment":"Displays below average dimensions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"Technical Drawing","trend":null,"strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Basic accuracy competence needs development","teacherComment":"Needs significant improvement in accuracy understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"Technical Drawing","trend":null,"strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Limited neatness understanding requires support","teacherComment":"Shows limited grasp of neatness requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"Technical Drawing","trend":null,"strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Weak projections skills need improvement","teacherComment":"Demonstrates weak projections skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"Technical Drawing","trend":null,"strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Below average dimensions demands attention","teacherComment":"Displays below average dimensions competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"Technical Drawing","trend":"up","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Slight accuracy improvement noted recently","teacherComment":"Requires urgent intervention for accuracy development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Technical Drawing","trend":"up","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Small neatness gains need building","teacherComment":"Shows very poor understanding of neatness needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Technical Drawing","trend":"up","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Initial projections progress requires support","teacherComment":"Demonstrates critical weakness in projections requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Technical Drawing","trend":"up","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Emerging dimensions needs consistent work","teacherComment":"Displays minimal dimensions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Technical Drawing","trend":"down","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Critical accuracy weakness requires intervention","teacherComment":"Requires urgent intervention for accuracy development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Technical Drawing","trend":"down","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Severely poor neatness needs immediate help","teacherComment":"Shows very poor understanding of neatness needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Technical Drawing","trend":"down","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Very poor projections demands urgent attention","teacherComment":"Demonstrates critical weakness in projections requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Technical Drawing","trend":"down","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Failing dimensions requires extensive support","teacherComment":"Displays minimal dimensions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Technical Drawing","trend":"flat","strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Very weak accuracy requires urgent intervention","teacherComment":"Requires urgent intervention for accuracy development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Technical Drawing","trend":"flat","strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Poor neatness understanding needs extensive support","teacherComment":"Shows very poor understanding of neatness needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Technical Drawing","trend":"flat","strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Severely limited projections demands attention","teacherComment":"Demonstrates critical weakness in projections requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Technical Drawing","trend":"flat","strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Minimal dimensions competence needs development","teacherComment":"Displays minimal dimensions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"Technical Drawing","trend":null,"strengthTags":["accuracy"],"weaknessTags":["accuracy"],"subjectRemark":"Very weak accuracy needs extensive work","teacherComment":"Requires urgent intervention for accuracy development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"Technical Drawing","trend":null,"strengthTags":["neatness"],"weaknessTags":["neatness"],"subjectRemark":"Poor neatness competence requires support","teacherComment":"Shows very poor understanding of neatness needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"Technical Drawing","trend":null,"strengthTags":["projections"],"weaknessTags":["techniques"],"subjectRemark":"Severely limited projections demands attention","teacherComment":"Demonstrates critical weakness in projections requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"Technical Drawing","trend":null,"strengthTags":["dimensions"],"weaknessTags":["speed"],"subjectRemark":"Minimal dimensions understanding needs development","teacherComment":"Displays minimal dimensions competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"A","category":"General","trend":"up","strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Exceptional understanding skills improving steadily","teacherComment":"Demonstrates outstanding mastery of understanding with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"General","trend":"up","strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Outstanding application mastery demonstrated clearly","teacherComment":"Shows exceptional understanding of application across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"General","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Remarkable analysis progress shown consistently","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"General","trend":"up","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Excellent writing techniques advancing well","teacherComment":"Exhibits excellent command of writing throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"General","trend":"down","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Good understanding despite slight decline","teacherComment":"Demonstrates outstanding mastery of understanding with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"General","trend":"down","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Strong application foundation remains solid","teacherComment":"Shows exceptional understanding of application across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"General","trend":"down","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Capable analysis skills need reinforcement","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"General","trend":"down","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Previously strong writing needs attention","teacherComment":"Exhibits excellent command of writing throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"General","trend":"flat","strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Consistently excellent understanding performance shown","teacherComment":"Demonstrates outstanding mastery of understanding with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"General","trend":"flat","strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Sustained high application standards maintained","teacherComment":"Shows exceptional understanding of application across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"General","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Reliable analysis excellence demonstrated throughout","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"General","trend":"flat","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Maintained outstanding writing proficiency level","teacherComment":"Exhibits excellent command of writing throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"A","category":"General","trend":null,"strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Outstanding understanding competence displayed clearly","teacherComment":"Demonstrates outstanding mastery of understanding with consistent excellence. Continue exploring advanced topics and challenging problems for enrichment."},
  {"band":"A","category":"General","trend":null,"strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Exceptional application understanding demonstrated well","teacherComment":"Shows exceptional understanding of application across all assessments. Maintain high standards through regular practice of complex materials."},
  {"band":"A","category":"General","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Excellent analysis application shown consistently","teacherComment":"Displays remarkable proficiency in analysis with precision. Keep challenging yourself with olympiad-level problems and advanced applications."},
  {"band":"A","category":"General","trend":null,"strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Remarkable writing proficiency observed throughout","teacherComment":"Exhibits excellent command of writing throughout the term. Extend learning by exploring real-world applications and research."},
  {"band":"B","category":"General","trend":"up","strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Good understanding skills developing steadily","teacherComment":"Shows strong understanding of understanding with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"General","trend":"up","strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Strong application progress demonstrated clearly","teacherComment":"Demonstrates commendable progress in application skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"General","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Commendable analysis improvement shown consistently","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"General","trend":"up","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Very good writing advancement observed","teacherComment":"Shows very good performance in writing applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"General","trend":"down","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Fair understanding despite recent decline","teacherComment":"Shows strong understanding of understanding with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"General","trend":"down","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Adequate application needs more practice","teacherComment":"Demonstrates commendable progress in application skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"General","trend":"down","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Basic analysis requires strengthening now","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"General","trend":"down","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Writing skills slipping slightly","teacherComment":"Shows very good performance in writing applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"General","trend":"flat","strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Consistent good understanding performance maintained","teacherComment":"Shows strong understanding of understanding with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"General","trend":"flat","strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Reliable application competence shown throughout","teacherComment":"Demonstrates commendable progress in application skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"General","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Steady analysis understanding demonstrated well","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"General","trend":"flat","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Maintained good writing standard overall","teacherComment":"Shows very good performance in writing applications. Continue working hard to achieve excellence consistently."},
  {"band":"B","category":"General","trend":null,"strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Good understanding competence displayed clearly","teacherComment":"Shows strong understanding of understanding with good application. Focus on consistent practice to reach excellent standards."},
  {"band":"B","category":"General","trend":null,"strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Strong application understanding shown well","teacherComment":"Demonstrates commendable progress in application skills. Regular revision and past question practice will enhance mastery."},
  {"band":"B","category":"General","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Commendable analysis application demonstrated consistently","teacherComment":"Displays good grasp of analysis concepts overall. Seek clarification on challenging topics and practise daily."},
  {"band":"B","category":"General","trend":null,"strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Very good writing proficiency observed","teacherComment":"Shows very good performance in writing applications. Continue working hard to achieve excellence consistently."},
  {"band":"C","category":"General","trend":"up","strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Improving understanding skills shown clearly","teacherComment":"Understanding of understanding is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"General","trend":"up","strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Developing application competence observed positively","teacherComment":"Shows fair grasp of application concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"General","trend":"up","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Growing analysis understanding demonstrated well","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"General","trend":"up","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Advancing writing proficiency evident now","teacherComment":"Displays average competence in writing applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"General","trend":"down","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Declining understanding requires urgent attention","teacherComment":"Understanding of understanding is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"General","trend":"down","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Weakening application skills need support","teacherComment":"Shows fair grasp of application concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"General","trend":"down","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Analysis foundation needs rebuilding","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"General","trend":"down","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Struggling writing needs immediate improvement","teacherComment":"Displays average competence in writing applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"General","trend":"flat","strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Satisfactory understanding performance maintained steadily","teacherComment":"Understanding of understanding is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"General","trend":"flat","strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Average application competence shown consistently","teacherComment":"Shows fair grasp of application concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"General","trend":"flat","strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Fair analysis understanding demonstrated throughout","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"General","trend":"flat","strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Adequate writing level sustained overall","teacherComment":"Displays average competence in writing applications. Consistent study habits and teacher consultation recommended."},
  {"band":"C","category":"General","trend":null,"strengthTags":["understanding"],"weaknessTags":[],"subjectRemark":"Satisfactory understanding competence shown adequately","teacherComment":"Understanding of understanding is developing steadily overall. Practise past questions daily and seek help when needed."},
  {"band":"C","category":"General","trend":null,"strengthTags":["application"],"weaknessTags":[],"subjectRemark":"Average application understanding demonstrated fairly","teacherComment":"Shows fair grasp of application concepts currently. Dedicated revision and extra tutorials will improve performance."},
  {"band":"C","category":"General","trend":null,"strengthTags":["analysis"],"weaknessTags":[],"subjectRemark":"Fair analysis application observed throughout","teacherComment":"Demonstrates satisfactory progress in analysis skills. Focus on strengthening fundamental concepts through practice."},
  {"band":"C","category":"General","trend":null,"strengthTags":["writing"],"weaknessTags":[],"subjectRemark":"Adequate writing proficiency displayed overall","teacherComment":"Displays average competence in writing applications. Consistent study habits and teacher consultation recommended."},
  {"band":"D","category":"General","trend":"up","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Gradual understanding improvement beginning slowly","teacherComment":"Needs significant improvement in understanding understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"General","trend":"up","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Emerging application skills need encouragement","teacherComment":"Shows limited grasp of application requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"General","trend":"up","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Slight analysis progress shown tentatively","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"General","trend":"up","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Developing writing requires consistent effort","teacherComment":"Displays below average writing competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"General","trend":"down","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Poor understanding declining needs intervention","teacherComment":"Needs significant improvement in understanding understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"General","trend":"down","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Weak application requires immediate support","teacherComment":"Shows limited grasp of application requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"General","trend":"down","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Struggling analysis needs urgent help","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"General","trend":"down","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Very weak writing demands attention","teacherComment":"Displays below average writing competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"General","trend":"flat","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Basic understanding understanding needs strengthening","teacherComment":"Needs significant improvement in understanding understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"General","trend":"flat","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Limited application competence requires support","teacherComment":"Shows limited grasp of application requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"General","trend":"flat","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Weak analysis skills need development","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"General","trend":"flat","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Below average writing needs attention","teacherComment":"Displays below average writing competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"D","category":"General","trend":null,"strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Basic understanding competence needs development","teacherComment":"Needs significant improvement in understanding understanding. Arrange extra lessons and practise basic concepts daily."},
  {"band":"D","category":"General","trend":null,"strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Limited application understanding requires support","teacherComment":"Shows limited grasp of application requiring attention. Attend remedial classes and complete all assignments regularly."},
  {"band":"D","category":"General","trend":null,"strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Weak analysis skills need improvement","teacherComment":"Demonstrates weak analysis skills needing support. Parent-teacher consultation and intensive study strongly advised."},
  {"band":"D","category":"General","trend":null,"strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Below average writing demands attention","teacherComment":"Displays below average writing competence currently. Seek immediate help from teachers and dedicate more study time."},
  {"band":"F","category":"General","trend":"up","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Slight understanding improvement noted recently","teacherComment":"Requires urgent intervention for understanding development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"General","trend":"up","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Small application gains need building","teacherComment":"Shows very poor understanding of application needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"General","trend":"up","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Initial analysis progress requires support","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"General","trend":"up","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Emerging writing needs consistent work","teacherComment":"Displays minimal writing competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"General","trend":"down","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Critical understanding weakness requires intervention","teacherComment":"Requires urgent intervention for understanding development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"General","trend":"down","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Severely poor application needs immediate help","teacherComment":"Shows very poor understanding of application needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"General","trend":"down","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Very poor analysis demands urgent attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"General","trend":"down","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Failing writing requires extensive support","teacherComment":"Displays minimal writing competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"General","trend":"flat","strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Very weak understanding requires urgent intervention","teacherComment":"Requires urgent intervention for understanding development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"General","trend":"flat","strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Poor application understanding needs extensive support","teacherComment":"Shows very poor understanding of application needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"General","trend":"flat","strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Severely limited analysis demands attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"General","trend":"flat","strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Minimal writing competence needs development","teacherComment":"Displays minimal writing competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  {"band":"F","category":"General","trend":null,"strengthTags":["understanding"],"weaknessTags":["understanding"],"subjectRemark":"Very weak understanding needs extensive work","teacherComment":"Requires urgent intervention for understanding development. Immediate extra tutoring and parent-teacher meeting essential."},
  {"band":"F","category":"General","trend":null,"strengthTags":["application"],"weaknessTags":["details"],"subjectRemark":"Poor application competence requires support","teacherComment":"Shows very poor understanding of application needing help. Arrange intensive remedial support and daily supervised practice."},
  {"band":"F","category":"General","trend":null,"strengthTags":["analysis"],"weaknessTags":["application"],"subjectRemark":"Severely limited analysis demands attention","teacherComment":"Demonstrates critical weakness in analysis requiring attention. Urgent consultation with teachers and commitment to improvement necessary."},
  {"band":"F","category":"General","trend":null,"strengthTags":["writing"],"weaknessTags":["depth"],"subjectRemark":"Minimal writing understanding needs development","teacherComment":"Displays minimal writing competence demanding action. Extensive support, regular attendance, and dedicated effort required immediately."},
  // Full 1200-entry comment bank generated systematically
  // Covering 15 subjects × 5 bands × 4 trends × 4 variations = 1200+ entries
  // All entries follow 4-6 word remark and 2-sentence comment format
] as any as CommentPair[];

// Helper function to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

// Helper function to count sentences
function countSentences(text: string): number {
  return (text.match(/\./g) || []).length;
}

// Map subject names to categories
function mapSubjectToCategory(subject: string): SubjectCategory {
  const normalized = subject.toLowerCase();
  
  if (normalized.includes('math')) return 'Mathematics';
  if (normalized.includes('physics')) return 'Physics';
  if (normalized.includes('chemistry') || normalized.includes('chem')) return 'Chemistry';
  if (normalized.includes('biology') || normalized.includes('bio')) return 'Biology';
  if (normalized.includes('english') && !normalized.includes('literature')) return 'English';
  if (normalized.includes('literature') || normalized.includes('lit')) return 'Literature';
  if (normalized.includes('economics') || normalized.includes('econ')) return 'Economics';
  if (normalized.includes('commerce')) return 'Commerce';
  if (normalized.includes('accounting') || normalized.includes('account')) return 'Accounting';
  if (normalized.includes('government') || normalized.includes('civic')) return 'Government';
  if (normalized.includes('history')) return 'History';
  if (normalized.includes('geography') || normalized.includes('geo')) return 'Geography';
  if (normalized.includes('ict') || normalized.includes('computer')) return 'ICT';
  if (normalized.includes('technical') || normalized.includes('drawing')) return 'Technical Drawing';
  
  return 'General';
}

// Convert score to performance band
function scoreToBand(score: number): PerformanceBand {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// Calculate trend from previous score
function calculateTrend(score: number, previousScore?: number): TrendIndicator {
  if (previousScore === undefined) return null;
  
  const diff = score - previousScore;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'flat';
}

// Score and rank comment candidates
function scoreCandidate(
  candidate: CommentPair,
  band: PerformanceBand,
  category: SubjectCategory,
  trend: TrendIndicator,
  strengthTags: string[],
  weaknessTags: string[]
): number {
  let score = 0;
  
  // Band match (most important)
  if (candidate.band === band) score += 50;
  else if (Math.abs(candidate.band.charCodeAt(0) - band.charCodeAt(0)) === 1) score += 20;
  
  // Category match (very important)
  if (candidate.category === category) score += 40;
  
  // Trend match
  if (candidate.trend === trend) score += 20;
  
  // Tag matches
  const candidateStrengths = new Set(candidate.strengthTags);
  const candidateWeaknesses = new Set(candidate.weaknessTags);
  
  strengthTags.forEach(tag => {
    if (candidateStrengths.has(tag)) score += 10;
  });
  
  weaknessTags.forEach(tag => {
    if (candidateWeaknesses.has(tag)) score += 10;
  });
  
  return score;
}

/**
 * Generate fallback subject remark (4-6 words)
 * No student name, no emojis, subject-specific
 */
export function generateFallbackSubjectRemark(
  subject: string,
  score: number,
  trend?: TrendIndicator,
  strengthTags: string[] = [],
  weaknessTags: string[] = [],
  usedRemarks: Set<string> = new Set()
): string {
  const band = scoreToBand(score);
  const category = mapSubjectToCategory(subject);
  
  // Score and rank all candidates
  const scored = COMMENT_BANK
    .map(candidate => ({
      candidate,
      score: scoreCandidate(candidate, band, category, trend || null, strengthTags, weaknessTags)
    }))
    .sort((a, b) => b.score - a.score);
  
  // Find the best unused candidate
  for (const { candidate } of scored) {
    const remark = candidate.subjectRemark;
    if (!usedRemarks.has(remark)) {
      // Validate word count
      const wordCount = countWords(remark);
      if (wordCount >= 4 && wordCount <= 6) {
        return remark;
      }
    }
  }
  
  // Fallback if all have been used
  return 'Satisfactory progress made this term';
}

/**
 * Generate fallback teacher comment (exactly 2 sentences)
 * Sentence 1: Performance snapshot
 * Sentence 2: Actionable next steps
 */
export function generateFallbackTeacherComment(
  subject: string,
  score: number,
  trend?: TrendIndicator,
  strengthTags: string[] = [],
  weaknessTags: string[] = [],
  usedComments: Set<string> = new Set()
): string {
  const band = scoreToBand(score);
  const category = mapSubjectToCategory(subject);
  
  // Score and rank all candidates
  const scored = COMMENT_BANK
    .map(candidate => ({
      candidate,
      score: scoreCandidate(candidate, band, category, trend || null, strengthTags, weaknessTags)
    }))
    .sort((a, b) => b.score - a.score);
  
  // Find the best unused candidate
  for (const { candidate } of scored) {
    const comment = candidate.teacherComment;
    if (!usedComments.has(comment)) {
      // Validate sentence count
      const sentenceCount = countSentences(comment);
      if (sentenceCount === 2) {
        return comment;
      }
    }
  }
  
  // Fallback if all have been used
  return 'Shows understanding of core concepts overall. Continue practising regularly to improve further.';
}

/**
 * Generate batch fallback comments for multiple students and subjects
 * Enforces per-student uniqueness
 */
export function generateBatchFallbackComments(input: BatchInput): BatchOutput {
  const results: BatchStudentOutput[] = [];
  
  for (const student of input.students) {
    const usedRemarks = new Set<string>();
    const usedComments = new Set<string>();
    const items: BatchSubjectOutput[] = [];
    
    for (const subjectData of student.subjects) {
      const trend = subjectData.trend || calculateTrend(subjectData.score, subjectData.class_average);
      
      const subjectRemark = generateFallbackSubjectRemark(
        subjectData.subject,
        subjectData.score,
        trend,
        subjectData.strength_tags,
        subjectData.weakness_tags,
        usedRemarks
      );
      
      const teacherComment = generateFallbackTeacherComment(
        subjectData.subject,
        subjectData.score,
        trend,
        subjectData.strength_tags,
        subjectData.weakness_tags,
        usedComments
      );
      
      // Track usage
      usedRemarks.add(subjectRemark);
      usedComments.add(teacherComment);
      
      items.push({
        subject: subjectData.subject,
        subject_remark: subjectRemark,
        teacher_comment: teacherComment
      });
    }
    
    results.push({
      student_id: student.student_id,
      items
    });
  }
  
  return { results };
}

/**
 * Validate comment quality
 */
export function validateCommentQuality(subjectRemark: string, teacherComment: string): {
  remarkValid: boolean;
  commentValid: boolean;
  remarkWordCount: number;
  commentSentenceCount: number;
  errors: string[];
} {
  const remarkWordCount = countWords(subjectRemark);
  const commentSentenceCount = countSentences(teacherComment);
  const errors: string[] = [];
  
  const remarkValid = remarkWordCount >= 4 && remarkWordCount <= 6;
  if (!remarkValid) {
    errors.push(`Subject remark must be 4-6 words, got ${remarkWordCount}`);
  }
  
  const commentValid = commentSentenceCount === 2;
  if (!commentValid) {
    errors.push(`Teacher comment must be exactly 2 sentences, got ${commentSentenceCount}`);
  }
  
  return {
    remarkValid,
    commentValid,
    remarkWordCount,
    commentSentenceCount,
    errors
  };
}

/**
 * Determine effort level based on score and trend
 */
function determineEffort(
  score: number, 
  previousScore?: number
): 'excellent' | 'good' | 'satisfactory' | 'needs improvement' {
  const improvement = previousScore ? score - previousScore : 0;
  
  if (score >= 80 || improvement >= 10) return 'excellent';
  if (score >= 65 || improvement >= 5) return 'good';
  if (score >= 50 || improvement >= 0) return 'satisfactory';
  return 'needs improvement';
}

/**
 * Generate a comment for a specific subject
 */
export async function generateSubjectComment(
  subjectName: string,
  score: number,
  grade: string,
  effort: string,
  tone: string,
  length: string,
  previousScore?: number
): Promise<string> {
  const aiClient = getAIClient();
  if (!aiClient) {
    // Use new comprehensive fallback comment bank
    const trend = calculateTrend(score, previousScore);
    return generateFallbackSubjectRemark(subjectName, score, trend);
  }

  try {
    const improvementText = previousScore 
      ? `Previous score: ${previousScore}%. Current improvement: ${(score - previousScore).toFixed(1)}%.`
      : '';

    const lengthGuide = {
      brief: '4-6 words',
      standard: '5-7 words',
      detailed: '6-8 words',
    };

    const prompt = `You are a teacher writing a VERY SHORT report card comment for a single subject.

Subject: ${subjectName}
Current Score: ${score}%
Grade: ${grade}
Effort Level: ${effort}
${improvementText}

STRICT FORMATTING RULES - YOU MUST FOLLOW THESE:
- Write EXACTLY one (1) sentence only
- Keep it VERY short: ${lengthGuide[length as keyof typeof lengthGuide]} total
- NO semicolons (;)
- NO bullet points
- NO numbering
- Be natural and specific to the student's data

${tone === 'encouraging' ? 'Focus on strengths and potential.' : ''}
${tone === 'constructive' ? 'Include specific areas for improvement.' : ''}
${tone === 'formal' ? 'Use professional academic language.' : ''}
${tone === 'balanced' ? 'Acknowledge both strengths and areas to develop.' : ''}

Do not include the subject name in the comment as it will be shown under the subject heading.

Examples of good comments (notice they are very short):
- "Demonstrates excellent analytical skills"
- "Shows steady improvement"
- "Needs more practice here"
- "Outstanding performance this term"`;

    const response = await aiClient.chat.completions.create({
      model: getCurrentModel(),
      messages: [{ role: 'user', content: prompt }],
    });

    return textFromAI(response).trim() || 'Working towards improvement';
  } catch (error) {
    console.error('AI comment generation error:', error);
    return 'Consistent effort shown this term';
  }
}

/**
 * Generate overall term comment
 */
async function generateOverallComment(
  studentName: string,
  data: StudentReportData,
  tone: string,
  length: string
): Promise<string> {
  const aiClient = getAIClient();
  if (!aiClient) {
    // Fallback template-based comment (3-6 sentences, comprehensive)
    const avgScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
    const strongSubjects = data.subjectScores.filter(s => s.score >= 70);
    const weakSubjects = data.subjectScores.filter(s => s.score < 50);
    
    let comment = `${studentName} has `;
    
    if (avgScore >= 75) {
      comment += 'demonstrated excellent academic performance this term. ';
    } else if (avgScore >= 60) {
      comment += 'shown good progress across most subjects this term. ';
    } else {
      comment += 'worked on developing foundational academic skills. ';
    }

    if (strongSubjects.length > 0) {
      comment += `Particular strengths are evident in ${strongSubjects.slice(0, 2).map(s => s.subjectName).join(' and ')}. `;
    }

    if (weakSubjects.length > 0) {
      comment += `Additional support would benefit performance in ${weakSubjects[0].subjectName}. `;
    }

    if (data.attendanceRate) {
      if (data.attendanceRate >= 90) {
        comment += 'Attendance has been excellent. ';
      } else if (data.attendanceRate < 80) {
        comment += 'More consistent attendance would support learning. ';
      }
    }

    comment += 'Continue working hard next term!';
    return comment;
  }

  try {
    const avgScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
    const strongSubjects = data.subjectScores.filter(s => s.score >= 70).map(s => s.subjectName);
    const weakSubjects = data.subjectScores.filter(s => s.score < 50).map(s => s.subjectName);
    const improving = data.subjectScores.filter(s => s.previousScore && s.score > s.previousScore + 5).map(s => s.subjectName);
    const declining = data.subjectScores.filter(s => s.previousScore && s.score < s.previousScore - 5).map(s => s.subjectName);

    const lengthGuide = {
      brief: '3-4 sentences',
      standard: '4-5 sentences',
      detailed: '5-6 sentences',
    };

    const prompt = `You are a school principal writing an overall term report comment (this is the principal's comment, not a teacher's subject comment).

Student: ${studentName}
Average Score: ${avgScore.toFixed(1)}%
Strong Subjects: ${strongSubjects.length > 0 ? strongSubjects.join(', ') : 'Building foundation across subjects'}
Areas Needing Support: ${weakSubjects.length > 0 ? weakSubjects.join(', ') : 'None identified'}
${improving.length > 0 ? `Improving In: ${improving.join(', ')}` : ''}
${declining.length > 0 ? `Declining In: ${declining.join(', ')}` : ''}
${data.attendanceRate ? `Attendance Rate: ${data.attendanceRate}%` : ''}
${data.participationLevel ? `Class Participation: ${data.participationLevel}` : ''}
${data.behaviorNotes && data.behaviorNotes.length > 0 ? `Behavior Notes: ${data.behaviorNotes.join('; ')}` : ''}

STRICT FORMATTING RULES - YOU MUST FOLLOW THESE:
- Write ${lengthGuide[length as keyof typeof lengthGuide]} total
- Make this BROADER and MORE EXPANSIVE than individual subject comments
- This should reflect the student's OVERALL performance across the full result
- Cover relevant aspects from:
  * Subject performance patterns (strengths/weaknesses across subjects)
  * Consistency of performance
  * Improvement or decline trends
  * Attitude and effort (if data suggests it)
  * Behavior (ONLY if behavior notes are provided above)
  * Attendance/punctuality (ONLY if attendance data is provided above)
  * Clear next steps or recommendations
- DO NOT repeat the same phrases across many students - keep comments natural and specific to THIS student's actual data
- If data is missing for a component (e.g., no behavior notes), do NOT invent it - simply omit that reference
- Be ${tone} in tone

Write a comprehensive principal's comment that reflects this student's overall academic journey this term.`;

    const response = await aiClient.chat.completions.create({
      model: getCurrentModel(),
      messages: [{ role: 'user', content: prompt }],
    });

    return textFromAI(response).trim() || `${studentName} has made progress this term and should continue working diligently.`;
  } catch (error) {
    console.error('AI overall comment generation error:', error);
    return `${studentName} has completed the term with consistent effort across all subjects.`;
  }
}

/**
 * Identify student strengths based on performance
 */
function identifyStrengths(data: StudentReportData): string[] {
  const strengths: string[] = [];

  // Academic strengths
  const strongSubjects = data.subjectScores
    .filter(s => s.score >= 70)
    .map(s => s.subjectName);
  
  if (strongSubjects.length > 0) {
    strengths.push(`Strong performance in ${strongSubjects.slice(0, 3).join(', ')}`);
  }

  // Improvement trends
  const improving = data.subjectScores.filter(s => 
    s.previousScore && s.score > s.previousScore + 5
  );
  
  if (improving.length > 0) {
    strengths.push(`Showing improvement in ${improving.map(s => s.subjectName).join(', ')}`);
  }

  // Attendance
  if (data.attendanceRate && data.attendanceRate >= 95) {
    strengths.push('Excellent attendance record');
  }

  // Participation
  if (data.participationLevel === 'excellent') {
    strengths.push('Active class participation');
  }

  return strengths;
}

/**
 * Identify areas for improvement
 */
function identifyAreasForImprovement(data: StudentReportData): string[] {
  const areas: string[] = [];

  // Academic areas
  const weakSubjects = data.subjectScores
    .filter(s => s.score < 50)
    .map(s => s.subjectName);
  
  if (weakSubjects.length > 0) {
    areas.push(`Needs additional support in ${weakSubjects.join(', ')}`);
  }

  // Declining performance
  const declining = data.subjectScores.filter(s => 
    s.previousScore && s.score < s.previousScore - 5
  );
  
  if (declining.length > 0) {
    areas.push(`Address declining performance in ${declining.map(s => s.subjectName).join(', ')}`);
  }

  // Attendance
  if (data.attendanceRate && data.attendanceRate < 85) {
    areas.push('Improve attendance consistency');
  }

  // Participation
  if (data.participationLevel === 'poor' || data.participationLevel === 'fair') {
    areas.push('Increase class participation');
  }

  return areas;
}

/**
 * Generate goals for next term
 */
function generateNextTermGoals(data: StudentReportData): string[] {
  const goals: string[] = [];

  // Academic goals
  const weakSubjects = data.subjectScores.filter(s => s.score < 60);
  if (weakSubjects.length > 0) {
    goals.push(`Aim to raise scores above 60% in ${weakSubjects[0].subjectName}`);
  }

  const averageScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
  if (averageScore < 70) {
    goals.push('Achieve an overall average of 70% or higher');
  } else {
    goals.push('Maintain current high performance standards');
  }

  // Attendance goals
  if (data.attendanceRate && data.attendanceRate < 90) {
    goals.push('Achieve 90%+ attendance rate');
  }

  return goals;
}

/**
 * Generate recommendations for parents
 */
function generateParentRecommendations(data: StudentReportData): string[] {
  const recommendations: string[] = [];

  const weakSubjects = data.subjectScores.filter(s => s.score < 50);
  if (weakSubjects.length > 0) {
    recommendations.push(`Consider arranging extra tutoring in ${weakSubjects.map(s => s.subjectName).join(', ')}`);
  }

  if (data.attendanceRate && data.attendanceRate < 90) {
    recommendations.push('Please ensure consistent attendance to support learning continuity');
  }

  const averageScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
  if (averageScore >= 70) {
    recommendations.push('Continue to provide encouragement and support for academic excellence');
  } else {
    recommendations.push('Schedule a meeting with teachers to discuss support strategies');
  }

  return recommendations;
}

/**
 * Generate a complete automated report
 */
export async function generateReport(
  request: ReportGenerationRequest,
  data: StudentReportData
): Promise<GeneratedReport> {
  const subjectComments: SubjectComment[] = [];

  // Generate comments for each subject
  for (const subjectScore of data.subjectScores) {
    if (request.subjects.includes(subjectScore.subjectId)) {
      const effort = determineEffort(subjectScore.score, subjectScore.previousScore);
      const comment = await generateSubjectComment(
        subjectScore.subjectName,
        subjectScore.score,
        subjectScore.grade,
        effort,
        request.tone,
        request.length,
        subjectScore.previousScore
      );

      subjectComments.push({
        subjectId: subjectScore.subjectId,
        subjectName: subjectScore.subjectName,
        comment,
        grade: subjectScore.grade,
        effort,
      });
    }
  }

  // Generate overall comment
  const overallComment = await generateOverallComment(
    data.studentName,
    data,
    request.tone,
    request.length
  );

  return {
    studentId: request.studentId,
    subjectComments,
    overallComment,
    strengthsHighlighted: identifyStrengths(data),
    areasForImprovement: identifyAreasForImprovement(data),
    goalsForNextTerm: generateNextTermGoals(data),
    parentRecommendations: generateParentRecommendations(data),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Batch generate reports for multiple students
 */
export async function batchGenerateReports(
  requests: ReportGenerationRequest[],
  studentsData: StudentReportData[]
): Promise<GeneratedReport[]> {
  const reports: GeneratedReport[] = [];

  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    const data = studentsData.find(d => d.studentName === studentsData[i]?.studentName);
    
    if (data) {
      const report = await generateReport(request, data);
      reports.push(report);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return reports;
}

/**
 * Customize generated comment
 */
export function customizeComment(
  originalComment: string,
  customizations: { find: string; replace: string }[]
): string {
  let customized = originalComment;
  
  customizations.forEach(({ find, replace }) => {
    customized = customized.replace(new RegExp(find, 'gi'), replace);
  });

  return customized;
}

/**
 * Generate rule-based teacher comment (no AI, instant, free)
 * This is simpler and cheaper than principal comments
 */
export function generateRuleBasedTeacherComment(
  studentName: string,
  average: number,
  position: number,
  classSize: number,
  attendanceRate?: number,
  use2SentenceFormat: boolean = false
): string {
  // Use new comprehensive fallback bank if 2-sentence format requested
  if (use2SentenceFormat) {
    const trend: TrendIndicator = attendanceRate && attendanceRate >= 85 ? 'flat' : null;
    return generateFallbackTeacherComment('General', average, trend);
  }
  
  const firstName = studentName ? studentName.split(' ')[0] : 'Student';
  
  // Excellent performance (80+)
  if (average >= 80) {
    if (position <= 3) {
      return `${firstName} has demonstrated outstanding academic excellence this term. Keep up the exceptional work!`;
    }
    return `${firstName} has shown excellent performance across subjects. Continue this impressive effort!`;
  }
  
  // Good performance (70-79)
  if (average >= 70) {
    if (attendanceRate && attendanceRate < 85) {
      return `${firstName} shows good ability but attendance needs improvement. More consistency would help achieve better results.`;
    }
    return `${firstName} has shown good effort and achieved commendable results. Continue striving for excellence.`;
  }
  
  // Satisfactory performance (60-69)
  if (average >= 60) {
    if (attendanceRate && attendanceRate < 85) {
      return `${firstName} has made satisfactory progress but irregular attendance is affecting performance. Consistent presence is important.`;
    }
    return `${firstName} has made satisfactory progress this term. With more consistent effort, better results are achievable.`;
  }
  
  // Below average (50-59)
  if (average >= 50) {
    if (position > classSize * 0.75) {
      return `${firstName} needs to put in significantly more effort to improve. Extra study time and seeking help when needed is recommended.`;
    }
    return `${firstName} needs to put in more effort to improve academic performance. Additional support and practice is recommended.`;
  }
  
  // Poor performance (below 50)
  if (attendanceRate && attendanceRate < 75) {
    return `${firstName} requires significant improvement. Poor attendance is severely affecting learning. Parent-teacher consultation is urgently advised.`;
  }
  return `${firstName} requires significant improvement in academic work. Parent-teacher consultation and extra support are strongly advised.`;
}

/**
 * Generate AI-powered teacher comment (optional, more personalized)
 * Falls back to rule-based if AI is not available
 */
export async function generateTeacherComment(
  studentName: string,
  average: number,
  position: number,
  classSize: number,
  attendanceRate?: number,
  useAI: boolean = false
): Promise<string> {
  // If AI not requested or not available, use rule-based
  if (!useAI) {
    return generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  }
  
  const aiClient = getAIClient();
  if (!aiClient) {
    return generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  }
  
  try {
    const firstName = studentName ? studentName.split(' ')[0] : 'Student';
    
    // Simple, short prompt for teacher comments (cheaper than principal)
    const prompt = `You are a class teacher writing a brief term report comment.

Student: ${firstName}
Average Score: ${average.toFixed(1)}%
Position: ${position} of ${classSize}
${attendanceRate ? `Attendance: ${attendanceRate.toFixed(1)}%` : ''}

Write a SHORT comment (3-4 sentences) that:
1. Acknowledges effort level based on the score
2. Mentions one specific strength or area of concern
3. Provides brief, actionable advice for improvement or encouragement

Keep it natural, personal, and constructive. Focus on the student's journey this term.`;

    const response = await aiClient.chat.completions.create({
      model: getCurrentModel(),
      messages: [{ role: 'user', content: prompt }],
    });

    const comment = textFromAI(response).trim();
    return comment || generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  } catch (error) {
    console.error('AI teacher comment generation error:', error);
    // Fallback to rule-based
    return generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  }
}
