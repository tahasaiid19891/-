/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CourseSubItem {
  subtitle: string;
  image?: string;
  paragraphs: string[];
}

export interface CourseChapter {
  id: string;
  title: string;
  intro?: string;
  sections: {
    title: string;
    image?: string;
    content?: string;
    bulletPoints?: string[];
    subsections?: CourseSubItem[];
  }[];
}

export type CourseViewType = 'home' | 'course';
