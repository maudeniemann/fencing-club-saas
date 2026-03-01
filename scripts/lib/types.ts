// Scraped data shapes from mylessonschedule.com

export interface ScrapedReservation {
  date: string;               // ISO date e.g. "2025-03-15"
  start_time: string;         // "14:00"
  end_time: string;           // "15:00"
  instructor_name: string;
  student_names: string[];
  lesson_type: string;        // "Private Lesson", "Group Lesson", etc.
  location: string;           // Venue name
  status: string;             // "confirmed", "cancelled", etc.
  notes: string;
  price?: string;             // "$120.00" if displayed
  raw_text?: string;          // Original row text for debugging
}

export interface ScrapedStudent {
  name: string;
  email?: string;
  phone?: string;
  role: string;               // "student" | "instructor" | "parent"
  status?: string;            // "active" | "inactive"
  notes?: string;
  created_date?: string;
}

export interface ScrapedClassSchedule {
  class_name: string;
  instructor_name: string;
  day_of_week: string;        // "Monday", "Tuesday", etc.
  start_time: string;
  end_time: string;
  location: string;
  max_students?: number;
  enrolled_students: string[];
  category: string;           // "group", "clinic", etc.
}

export interface ScrapedPayment {
  date: string;
  student_name: string;
  amount: string;             // "$120.00"
  description: string;
  instructor_name?: string;
  payment_method?: string;
  status: string;
}

export interface ScrapedSettings {
  lesson_types: Array<{
    name: string;
    category: string;
    duration_minutes: number;
    price: string;
    max_participants?: number;
  }>;
  venues: Array<{
    name: string;
    address?: string;
  }>;
  cancellation_policy?: Record<string, unknown>;
}

export interface DiscoveryResult {
  url: string;
  title: string;
  screenshot_path: string;
  html_path: string;
  nav_links: Array<{ text: string; href: string }>;
}
