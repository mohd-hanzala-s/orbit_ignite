export const LESSON_TYPES = [
  'video',
  'audio',
  'document',
  'scorm',
  'page',
  'link',
  'embed',
  'quiz',
  'assignment',
  'live',
] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const ROLES = ['admin', 'instructor', 'learner'] as const;
export type Role = (typeof ROLES)[number];

export const COURSE_THEMES = ['nebula', 'aurora', 'sunset', 'ocean', 'ember', 'lunar', 'nova', 'forest'] as const;
export type CourseTheme = (typeof COURSE_THEMES)[number];

export const QUESTION_TYPES = ['single', 'multiple', 'truefalse', 'short', 'ordering'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const XP = {
  lesson: 10,
  quizPass: 25,
  quizPerfect: 15,
  course: 100,
  review: 5,
  post: 3,
} as const;

export const levelFromXp = (xp: number) => {
  // level n requires 60*(n-1)^2 XP : 0,60,240,540,960...
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  const floor = 60 * (level - 1) ** 2;
  const next = 60 * level ** 2;
  return { level, floor, next, pct: Math.round(((xp - floor) / (next - floor)) * 100) };
};
