import type { 
  TimetableEntry, 
  ScheduleConstraint, 
  ScheduleOptimizationResult 
} from '../types';

/**
 * Schedule Optimizer Service
 * Uses constraint satisfaction algorithms for optimal timetable generation
 */

interface TeacherAvailability {
  teacherId: string;
  teacherName: string;
  unavailablePeriods: { day: string; period: number }[];
  maxConsecutivePeriods: number;
  preferredTimes?: { day: string; periods: number[] }[];
}

interface RoomRequirement {
  roomId: number;
  roomName: string;
  capacity: number;
  equipment?: string[];
  type: 'classroom' | 'lab' | 'gym' | 'auditorium';
}

interface SchedulingRequest {
  classes: { classId: number; className: string }[];
  subjects: { subjectId: number; subjectName: string; periodsPerWeek: number; requiresLab?: boolean }[];
  teachers: TeacherAvailability[];
  rooms: RoomRequirement[];
  constraints: ScheduleConstraint[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS_PER_DAY = 8;
const PERIOD_TIMES = [
  { period: 1, startTime: '08:00', endTime: '08:45' },
  { period: 2, startTime: '08:45', endTime: '09:30' },
  { period: 3, startTime: '09:30', endTime: '10:15' },
  { period: 4, startTime: '10:45', endTime: '11:30' }, // Break after period 3
  { period: 5, startTime: '11:30', endTime: '12:15' },
  { period: 6, startTime: '12:15', endTime: '13:00' },
  { period: 7, startTime: '13:45', endTime: '14:30' }, // Lunch break
  { period: 8, startTime: '14:30', endTime: '15:15' },
];

/**
 * Check if a teacher is available at a specific time
 */
function isTeacherAvailable(
  teacher: TeacherAvailability,
  day: string,
  period: number,
  currentSchedule: TimetableEntry[]
): boolean {
  // Check if teacher has marked this period as unavailable
  const isUnavailable = teacher.unavailablePeriods.some(
    up => up.day === day && up.period === period
  );
  if (isUnavailable) return false;

  // Check if teacher is already scheduled at this time
  const isAlreadyScheduled = currentSchedule.some(
    entry => entry.teacherId === teacher.teacherId && 
             entry.day === day && 
             entry.period === period
  );
  if (isAlreadyScheduled) return false;

  // Check consecutive periods constraint
  const consecutivePeriods = currentSchedule.filter(
    entry => entry.teacherId === teacher.teacherId && entry.day === day
  ).length;
  if (consecutivePeriods >= teacher.maxConsecutivePeriods) return false;

  return true;
}

/**
 * Check if a room is available at a specific time
 */
function isRoomAvailable(
  roomId: number,
  day: string,
  period: number,
  currentSchedule: TimetableEntry[]
): boolean {
  return !currentSchedule.some(
    entry => entry.roomId === roomId && 
             entry.day === day && 
             entry.period === period
  );
}

/**
 * Find suitable room for a subject
 */
function findSuitableRoom(
  subject: { subjectId: number; subjectName: string; requiresLab?: boolean },
  day: string,
  period: number,
  rooms: RoomRequirement[],
  currentSchedule: TimetableEntry[]
): RoomRequirement | null {
  // Filter rooms by type if lab is required
  let availableRooms = rooms;
  if (subject.requiresLab) {
    availableRooms = rooms.filter(r => r.type === 'lab');
  }

  // Find available room
  return availableRooms.find(room => 
    isRoomAvailable(room.roomId, day, period, currentSchedule)
  ) || null;
}

/**
 * Calculate schedule quality score
 */
function calculateScheduleScore(
  schedule: TimetableEntry[],
  constraints: ScheduleConstraint[]
): number {
  let score = 100;
  const satisfiedConstraints: string[] = [];
  const violatedConstraints: string[] = [];

  constraints.forEach(constraint => {
    const satisfied = constraint.validate(schedule);
    
    if (constraint.type === 'hard') {
      if (!satisfied) {
        score -= 25; // Heavy penalty for hard constraints
        violatedConstraints.push(constraint.name);
      } else {
        satisfiedConstraints.push(constraint.name);
      }
    } else {
      // Soft constraint
      if (!satisfied) {
        score -= (constraint.weight * 10);
        violatedConstraints.push(constraint.name);
      } else {
        satisfiedConstraints.push(constraint.name);
      }
    }
  });

  // Additional scoring factors
  
  // Penalize teacher idle time
  const teacherIdleTime = calculateTeacherIdleTime(schedule);
  score -= teacherIdleTime * 0.5;

  // Reward balanced workload
  const workloadBalance = calculateWorkloadBalance(schedule);
  score += workloadBalance * 0.3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate teacher idle time (gaps between classes)
 */
function calculateTeacherIdleTime(schedule: TimetableEntry[]): number {
  let totalIdleTime = 0;
  const teacherIds = [...new Set(schedule.map(e => e.teacherId))];

  teacherIds.forEach(teacherId => {
    DAYS.forEach(day => {
      const daySchedule = schedule
        .filter(e => e.teacherId === teacherId && e.day === day)
        .sort((a, b) => a.period - b.period);

      if (daySchedule.length < 2) return;

      for (let i = 1; i < daySchedule.length; i++) {
        const gap = daySchedule[i].period - daySchedule[i - 1].period - 1;
        if (gap > 0) totalIdleTime += gap;
      }
    });
  });

  return totalIdleTime;
}

/**
 * Calculate workload balance across days
 */
function calculateWorkloadBalance(schedule: TimetableEntry[]): number {
  const teacherIds = [...new Set(schedule.map(e => e.teacherId))];
  let totalBalance = 0;

  teacherIds.forEach(teacherId => {
    const dailyCounts = DAYS.map(day => 
      schedule.filter(e => e.teacherId === teacherId && e.day === day).length
    );
    
    const avg = dailyCounts.reduce((a, b) => a + b, 0) / DAYS.length;
    const variance = dailyCounts.reduce((sum, count) => 
      sum + Math.pow(count - avg, 2), 0
    ) / DAYS.length;
    
    // Lower variance = better balance
    totalBalance += Math.max(0, 10 - variance);
  });

  return totalBalance / teacherIds.length;
}

/**
 * Generate optimized schedule using constraint satisfaction
 */
export function optimizeSchedule(
  request: SchedulingRequest
): ScheduleOptimizationResult {
  const schedule: TimetableEntry[] = [];
  const suggestions: string[] = [];

  // Assign classes for each subject
  request.subjects.forEach(subject => {
    request.classes.forEach(classInfo => {
      let assignedPeriods = 0;

      // Try to assign required periods for this subject-class combination
      for (const day of DAYS) {
        if (assignedPeriods >= subject.periodsPerWeek) break;

        for (let period = 1; period <= PERIODS_PER_DAY; period++) {
          if (assignedPeriods >= subject.periodsPerWeek) break;

          // Find available teacher
          const availableTeacher = request.teachers.find(teacher =>
            isTeacherAvailable(teacher, day, period, schedule)
          );

          if (!availableTeacher) continue;

          // Find suitable room
          const room = findSuitableRoom(subject, day, period, request.rooms, schedule);
          if (!room) continue;

          // Get period times
          const periodTime = PERIOD_TIMES.find(pt => pt.period === period);
          if (!periodTime) continue;

          // Create timetable entry
          const entry: TimetableEntry = {
            id: `${classInfo.classId}-${subject.subjectId}-${day}-${period}`,
            day,
            period,
            startTime: periodTime.startTime,
            endTime: periodTime.endTime,
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            teacherId: availableTeacher.teacherId,
            teacherName: availableTeacher.teacherName,
            classId: classInfo.classId,
            className: classInfo.className,
            roomId: room.roomId,
            roomName: room.roomName,
          };

          schedule.push(entry);
          assignedPeriods++;
        }
      }

      // Check if all periods were assigned
      if (assignedPeriods < subject.periodsPerWeek) {
        suggestions.push(
          `Could not assign all ${subject.periodsPerWeek} periods for ${subject.subjectName} in ${classInfo.className}. ` +
          `Only ${assignedPeriods} periods assigned.`
        );
      }
    });
  });

  // Calculate score
  const score = calculateScheduleScore(schedule, request.constraints);

  // Get constraint validation results
  const satisfiedConstraints: string[] = [];
  const violatedConstraints: string[] = [];
  
  request.constraints.forEach(constraint => {
    if (constraint.validate(schedule)) {
      satisfiedConstraints.push(constraint.name);
    } else {
      violatedConstraints.push(constraint.name);
    }
  });

  // Generate alternative schedules (simplified - in production, use more sophisticated algorithm)
  const alternativeSchedules: TimetableEntry[][] = [];

  return {
    schedule,
    score,
    satisfiedConstraints,
    violatedConstraints,
    suggestions,
    alternativeSchedules,
  };
}

/**
 * Common constraints for schedule optimization
 */
export const commonConstraints = {
  noTeacherDoubleBooking: (): ScheduleConstraint => ({
    type: 'hard',
    name: 'No teacher double-booking',
    weight: 1,
    validate: (schedule: TimetableEntry[]) => {
      const slots = new Set<string>();
      for (const entry of schedule) {
        const key = `${entry.teacherId}-${entry.day}-${entry.period}`;
        if (slots.has(key)) return false;
        slots.add(key);
      }
      return true;
    },
  }),

  noClassDoubleBooking: (): ScheduleConstraint => ({
    type: 'hard',
    name: 'No class double-booking',
    weight: 1,
    validate: (schedule: TimetableEntry[]) => {
      const slots = new Set<string>();
      for (const entry of schedule) {
        const key = `${entry.classId}-${entry.day}-${entry.period}`;
        if (slots.has(key)) return false;
        slots.add(key);
      }
      return true;
    },
  }),

  noRoomDoubleBooking: (): ScheduleConstraint => ({
    type: 'hard',
    name: 'No room double-booking',
    weight: 1,
    validate: (schedule: TimetableEntry[]) => {
      const slots = new Set<string>();
      for (const entry of schedule) {
        if (!entry.roomId) continue;
        const key = `${entry.roomId}-${entry.day}-${entry.period}`;
        if (slots.has(key)) return false;
        slots.add(key);
      }
      return true;
    },
  }),

  balancedDailyLoad: (): ScheduleConstraint => ({
    type: 'soft',
    name: 'Balanced daily workload',
    weight: 0.8,
    validate: (schedule: TimetableEntry[]) => {
      // Check if no class has more than 6 periods in a day
      const dailyLoads = new Map<string, number>();
      schedule.forEach(entry => {
        const key = `${entry.classId}-${entry.day}`;
        dailyLoads.set(key, (dailyLoads.get(key) || 0) + 1);
      });
      return Array.from(dailyLoads.values()).every(count => count <= 6);
    },
  }),

  difficultSubjectsInMorning: (): ScheduleConstraint => ({
    type: 'soft',
    name: 'Difficult subjects scheduled in morning',
    weight: 0.6,
    validate: (schedule: TimetableEntry[]) => {
      const difficultSubjects = ['Mathematics', 'Physics', 'Chemistry', 'Further Mathematics'];
      const morningSlots = schedule.filter(e => 
        difficultSubjects.some(s => e.subjectName.includes(s)) && e.period <= 4
      );
      const totalDifficult = schedule.filter(e => 
        difficultSubjects.some(s => e.subjectName.includes(s))
      ).length;
      return totalDifficult === 0 || (morningSlots.length / totalDifficult) >= 0.7;
    },
  }),
};
