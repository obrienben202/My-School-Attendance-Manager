-- Additive only. Run against development via migrate:development, never at startup.
CREATE TABLE IF NOT EXISTS ilp_review_templates (
 id serial PRIMARY KEY, term integer NOT NULL CHECK (term BETWEEN 1 AND 3),
 version integer NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
 revision integer NOT NULL DEFAULT 0, content jsonb NOT NULL,
 created_by varchar REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ilp_template_term_version ON ilp_review_templates(term,version);
CREATE TABLE IF NOT EXISTS ilp_review_terms (
 id serial PRIMARY KEY, academic_year text NOT NULL, term integer NOT NULL CHECK (term BETWEEN 1 AND 3),
 template_id integer NOT NULL REFERENCES ilp_review_templates(id),
 start_date date NOT NULL, end_date date NOT NULL, deadline date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (start_date <= deadline AND deadline <= end_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS ilp_term_year_term ON ilp_review_terms(academic_year,term);
CREATE TABLE IF NOT EXISTS ilp_learner_assignments (
 student_id integer PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
 learner_user_id varchar UNIQUE REFERENCES users(id) ON DELETE SET NULL,
 tutor_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
 updated_by varchar REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ilp_term_reviews (
 id serial PRIMARY KEY, student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 term_id integer NOT NULL REFERENCES ilp_review_terms(id), template_id integer NOT NULL REFERENCES ilp_review_templates(id),
 status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','draft','submitted','reviewed','returned')),
 revision integer NOT NULL DEFAULT 0,
 work jsonb NOT NULL DEFAULT '{"answers":{},"summary":"","targets":[],"priorTargetUpdates":{}}',
 teacher_comment text NOT NULL DEFAULT '', review_date date,
 history jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ilp_review_student_term ON ilp_term_reviews(student_id,term_id);
CREATE TABLE IF NOT EXISTS ilp_support_audit (
 id serial PRIMARY KEY, actor_id varchar NOT NULL, review_id integer, action text NOT NULL,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- Directory/roster imports may write students outside the HTTP router. Enforce
-- late-join reconciliation at the authoritative roster boundary as well.
CREATE OR REPLACE FUNCTION ilp_assign_confirmed_learner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.confirmed_learner THEN
  PERFORM pg_advisory_xact_lock(961003);
  INSERT INTO ilp_term_reviews (student_id,term_id,template_id)
  SELECT NEW.id,id,template_id FROM ilp_review_terms
  ON CONFLICT (student_id,term_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ilp_confirmed_learner_reviews') THEN
  CREATE TRIGGER ilp_confirmed_learner_reviews AFTER INSERT OR UPDATE OF confirmed_learner ON students
   FOR EACH ROW EXECUTE FUNCTION ilp_assign_confirmed_learner();
 END IF;
END;
$$;