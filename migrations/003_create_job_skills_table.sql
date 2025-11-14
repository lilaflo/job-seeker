-- Migration: Create job_skills table and populate with skills from resume
-- Created: 2024-01-14

-- Create job_skills table
CREATE TABLE IF NOT EXISTS job_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  proficiency_level TEXT CHECK(proficiency_level IN ('Expert', 'Advanced', 'Proficient', 'Intermediate', 'Basic')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_skill_name ON job_skills(name);

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_skill_category ON job_skills(category);

-- Index for filtering by proficiency level
CREATE INDEX IF NOT EXISTS idx_skill_proficiency ON job_skills(proficiency_level);

-- Insert AI & Machine Learning skills
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('AI Agents & Assistants (LLM, Ollama)', 'AI & Machine Learning', 'Advanced'),
  ('Self-hosted AI solutions', 'AI & Machine Learning', 'Advanced'),
  ('Business Analytics', 'AI & Machine Learning', 'Advanced'),
  ('AI-assisted development (Cursor AI, Vibe-Coding)', 'AI & Machine Learning', 'Proficient'),
  ('Text generation & recognition', 'AI & Machine Learning', 'Advanced'),
  ('Image recognition', 'AI & Machine Learning', 'Proficient');

-- Insert Cloud & Infrastructure skills
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('Docker', 'Cloud & Infrastructure', 'Expert'),
  ('AWS', 'Cloud & Infrastructure', 'Advanced'),
  ('Terraform', 'Cloud & Infrastructure', 'Intermediate'),
  ('fly.io', 'Cloud & Infrastructure', 'Proficient'),
  ('NGINX', 'Cloud & Infrastructure', 'Expert'),
  ('Apache', 'Cloud & Infrastructure', 'Expert'),
  ('Caddy', 'Cloud & Infrastructure', 'Expert'),
  ('SSH', 'Cloud & Infrastructure', 'Expert'),
  ('Linux', 'Cloud & Infrastructure', 'Expert'),
  ('macOS', 'Cloud & Infrastructure', 'Expert');

-- Insert Modern Web Stack skills
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('Vue.js', 'Modern Web Stack', 'Advanced'),
  ('Nuxt', 'Modern Web Stack', 'Advanced'),
  ('React', 'Modern Web Stack', 'Proficient'),
  ('Supabase', 'Modern Web Stack', 'Proficient');

-- Insert Programming Languages
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('JavaScript', 'Programming Languages', 'Expert'),
  ('TypeScript', 'Programming Languages', 'Expert'),
  ('Node.js', 'Programming Languages', 'Expert'),
  ('PHP', 'Programming Languages', 'Expert'),
  ('Symfony', 'Programming Languages', 'Expert'),
  ('Laravel', 'Programming Languages', 'Expert'),
  ('Zend', 'Programming Languages', 'Expert'),
  ('Yii', 'Programming Languages', 'Expert'),
  ('HTML5', 'Programming Languages', 'Expert'),
  ('CSS3', 'Programming Languages', 'Expert'),
  ('Sass', 'Programming Languages', 'Expert'),
  ('Less', 'Programming Languages', 'Expert');

-- Insert Databases
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('MySQL', 'Databases', 'Expert'),
  ('MongoDB', 'Databases', 'Expert'),
  ('SQLite', 'Databases', 'Expert'),
  ('PostgreSQL', 'Databases', 'Proficient'),
  ('Redis', 'Databases', 'Advanced');

-- Insert E-Commerce & PIM skills
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('Shopware', 'E-Commerce & PIM', 'Advanced'),
  ('Akeneo', 'E-Commerce & PIM', 'Advanced'),
  ('Shopify', 'E-Commerce & PIM', 'Proficient'),
  ('WooCommerce', 'E-Commerce & PIM', 'Proficient'),
  ('Sylius', 'E-Commerce & PIM', 'Intermediate'),
  ('PIMCore', 'E-Commerce & PIM', 'Proficient');

-- Insert Development Tools
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('Git', 'Development Tools', 'Expert'),
  ('GitLab', 'Development Tools', 'Expert'),
  ('GitHub', 'Development Tools', 'Expert'),
  ('Gitea', 'Development Tools', 'Expert'),
  ('PhpStorm', 'Development Tools', 'Expert'),
  ('VS Code', 'Development Tools', 'Proficient'),
  ('Cursor AI', 'Development Tools', 'Proficient'),
  ('Vim', 'Development Tools', 'Expert');

-- Insert Management & Methodology
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('Scrum', 'Management & Methodology', 'Expert'),
  ('Kanban', 'Management & Methodology', 'Expert'),
  ('Remote Work', 'Management & Methodology', 'Expert'),
  ('IT Consulting', 'Management & Methodology', 'Expert'),
  ('Team Leadership', 'Management & Methodology', 'Advanced'),
  ('Certified Scrum Master', 'Management & Methodology', 'Expert'),
  ('Certified Product Owner', 'Management & Methodology', 'Expert');

-- Insert Privacy & Decentralization
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('Tor', 'Privacy & Decentralization', 'Advanced'),
  ('Yggdrasil', 'Privacy & Decentralization', 'Advanced'),
  ('I2P', 'Privacy & Decentralization', 'Advanced'),
  ('IPFS', 'Privacy & Decentralization', 'Advanced'),
  ('Nostr', 'Privacy & Decentralization', 'Advanced'),
  ('Handshake', 'Privacy & Decentralization', 'Advanced'),
  ('SearXNG', 'Privacy & Decentralization', 'Advanced');

-- Insert Blockchain & Crypto
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('Blockchain', 'Blockchain & Crypto', 'Advanced'),
  ('Cryptocurrency', 'Blockchain & Crypto', 'Advanced');

-- Insert Languages
INSERT INTO job_skills (name, category, proficiency_level) VALUES
  ('German', 'Languages', 'Expert'),
  ('English', 'Languages', 'Advanced'),
  ('French', 'Languages', 'Basic');
