/**
 * Shared database types and interfaces
 */

export interface EmailRow {
  id: number;
  gmail_id: string;
  subject: string | null;
  from_address: string | null;
  body: string | null;
  confidence: 'high' | 'medium' | 'low';
  is_job_related: number;
  reason: string | null;
  processed: number;
  platform_id: number | null;
  created_at: string;
  scanned_at: string;
}

export interface JobRow {
  id: number;
  title: string;
  link: string;
  email_id: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  created_at: string;
  scanned_at: string;
  description: string | null;
  blacklisted: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface PlatformRow {
  id: number;
  platform_name: string;
  hostname: string;
  can_crawl: number;
  skip_reason: string | null;
  created_at: string;
}

export interface BlacklistKeyword {
  id: number;
  keyword: string;
  embedding: string | null;
  created_at: string;
}
