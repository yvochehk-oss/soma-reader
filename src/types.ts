export type Language = 'en' | 'sw';

export type ReaderTheme = 'paper' | 'sepia' | 'dark';

export interface Chapter {
  id: string;
  number: number;
  title: string;
  titleSwahili?: string;
  content: string; // English
  contentSwahili?: string; // Kiswahili
  wordCount: number;
  releaseDate: string;
}

export interface Book {
  id: string;
  databaseId?: string;
  parentBookId?: string | null;
  language?: Language;
  title: string;
  titleSwahili?: string;
  author: string;
  category: string; // Genre: Romance, Thriller, Sci-Fi, Historical, Fantasy, Contemporary, Urban Fantasy
  rating: number;
  heatMetric: string; // e.g. "450k", "9.8"
  description: string;
  descriptionSwahili?: string;
  coverImage: string;
  bannerImage?: string;
  rank?: number;
  status: 'Hot' | 'New' | 'Free' | 'Completed' | 'Bilingual';
  isEditorChoice?: boolean;
  isBilingualAvailable?: boolean;
  chaptersCount: number;
  chapters: Chapter[];
  publishedYear: string;
  tags: string[];
}

export interface UserLibraryItem {
  bookId: string;
  lastReadChapterId?: string;
  lastReadChapterNumber?: number;
  progressPercent: number;
  addedAt: string;
}

export interface ReaderSettings {
  fontSize: number; // in px
  fontFamily: 'Georgia' | 'Work Sans';
  theme: ReaderTheme;
  lineHeight: number;
  bilingualMode: boolean; // Show side-by-side or toggled Kiswahili
  spacing: 'compact' | 'comfortable'; // Paragraph spacing
}

export type ActiveNavTab = 'Home' | 'Classics' | 'Modern' | 'Romance' | 'Thriller' | 'Popular' | 'Library' | 'Free Zone' | 'Completed' | 'Bilingual';
