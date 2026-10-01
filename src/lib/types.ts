export type Role = 'admin' | 'instructor' | 'learner';
export type LessonType = 'video' | 'audio' | 'document' | 'scorm' | 'page' | 'link' | 'embed' | 'quiz' | 'assignment' | 'live';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: string;
  avatarColor: string;
  title: string;
  bio: string;
  department: string;
  xp: number;
  streak: number;
  longestStreak: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Category { id: number; name: string; slug: string; color: string; courseCount?: number }

export interface Enrollment {
  status: 'active' | 'completed';
  progress: number;
  dueDate: string | null;
  lastLessonId: number | null;
  enrolledAt: string | null;
  completedAt: string | null;
}

export interface CourseCard {
  id: number;
  title: string;
  subtitle: string;
  status: 'draft' | 'published' | 'archived';
  level: string;
  theme: string;
  coverUrl: string | null;
  category: Category | null;
  instructor: { id: number; name: string; avatarColor: string; title: string } | null;
  tags: string[];
  lessonCount: number;
  durationMinutes: number;
  enrolledCount: number;
  completedCount: number;
  rating: number | null;
  ratingCount: number;
  featured: boolean;
  certificate: boolean;
  sequential: boolean;
  enrollmentMode: 'open' | 'invite';
  updatedAt: string | null;
  saved: boolean;
  enrollment: Enrollment | null;
}

export interface LessonLite {
  id: number;
  title: string;
  type: LessonType;
  durationMinutes: number;
  required: boolean;
  preview: boolean;
  summary: string;
  status: 'not_started' | 'in_progress' | 'pending' | 'completed';
  locked: boolean;
}
export interface SectionLite { id: number; title: string; position: number; lessons: LessonLite[] }

export interface CourseDetail extends CourseCard {
  description: string;
  objectives: string[];
  passMark: number;
  instructorBio: string;
  sections: SectionLite[];
  enrolled: boolean;
  canEdit: boolean;
  myReview: { rating: number; body: string } | null;
  ratingDistribution: { rating: number; count: number }[];
}
export interface LearnCourse extends CourseCard {
  description: string;
  objectives: string[];
  sections: SectionLite[];
  preview: boolean;
}

export interface QuizQuestionPublic {
  id: string;
  type: 'single' | 'multiple' | 'truefalse' | 'short' | 'ordering';
  prompt: string;
  options?: { id: string; text: string }[];
  points: number;
}
export interface QuizResultItem { id: string; correct: boolean; earned: number; points: number; correctAnswer?: any; explanation?: string }
export interface Submission {
  id: number; text: string; link: string; fileId: number | null; fileName: string | null;
  status: 'submitted' | 'graded' | 'returned'; grade: number | null; feedback: string; submittedAt: string; gradedAt: string | null;
}
export interface LessonFull {
  id: number; courseId: number; sectionId: number; title: string; type: LessonType; durationMinutes: number; required: boolean; preview: boolean; summary: string;
  courseTitle: string; tracked: boolean; staffPreview: boolean;
  content: Record<string, any>;
  progress: { status: string; position: number; timeSpent: number; score: number | null } | null;
}

export interface BadgeInfo { key: string; name: string; description: string; icon: string; tone: 'violet' | 'cyan' | 'amber' | 'pink' | 'emerald'; earnedAt: string | null }
export interface Notification { id: number; type: string; title: string; body: string; link: string; read: boolean; createdAt: string }
export interface Certificate { id: number; code: string; courseId: number; course: string; theme: string; instructor: string | null; score: number | null; issuedAt: string; learner: string; signer: string; signerTitle: string; platform: string }
export interface Announcement { id: number; title: string; body: string; pinned: boolean; author: string; createdAt: string }
export interface PathDto { id: number; title: string; description: string; theme: string; status: string; courses: CourseCard[]; courseCount: number; completedCount: number; progress: number; durationMinutes: number; enrolled: boolean }
export interface DiscussionPost { id: number; body: string; pinned: boolean; parentId: number | null; lessonId: number | null; lessonTitle: string | null; createdAt: string; user: { id: number; name: string; avatarColor: string; role: Role }; replies?: DiscussionPost[] }
