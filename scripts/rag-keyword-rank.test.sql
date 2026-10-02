-- The keyword leg of the cloudyjoe retrieval, on a real Postgres.
--
-- hybrid_search (scripts/supabase-setup.sql) scores every row as
--   0.7 * cosine + 0.3 * ts_rank(fts, websearch_to_tsquery('english', query_text))
-- and rag.js drops rows below 0.3. In round 1 of the 2026-10-02 work-knowledge
-- fix, rag.js sent query_text as the visitor's words plus the work bridge's
-- terms as OR alternatives ("... or Cbarrgs or merch"), on the theory that
-- this only widens the match. It does not: an OR at the top of the tsquery
-- makes ts_rank use its OR formula, which averages over every query item, so a
-- row matching ALL of the visitor's words lost most of its keyword score. Now
-- the bridge feeds the embedding only, and the keyword leg gets the original.
--
-- tests/fixtures/rag-keyword-leg.csv holds in-domain questions the bridge
-- fires on, the query_text rag.js sends for each (`sent`), the bridge terms
-- (`bridge_terms`) and a document that fully matches the question.
-- tests/agent-knowledge.test.ts asserts `sent` and `bridge_terms` are exactly
-- what the code produces today; this file asserts what Postgres does with them:
--   1. each fixture document really matches its question (the fixture is sound);
--   2. the text rag.js sends never ranks that document below the question
--      itself (the property the OR form broke);
--   3. the OR form WOULD rank it lower (this test can fail: it is not
--      comparing a string with itself by construction).
-- Runs in a transaction and creates only a temp table: no schema, no data.
-- Needs no pgvector: ts_rank and websearch_to_tsquery are core Postgres.
--
-- Run from the repository root (\copy reads the CSV relative to it):
--   psql -v ON_ERROR_STOP=1 -f scripts/rag-keyword-rank.test.sql

\set ON_ERROR_STOP 1
begin;

create temp table leg (query text not null, sent text not null, bridge_terms text not null, doc text not null);
\copy leg from 'tests/fixtures/rag-keyword-leg.csv' with (format csv, header true)

do $$
declare
  r record;
  n int := 0;
  base double precision;
  sent double precision;
  ored double precision;
  ored_q text;
begin
  for r in select * from leg loop
    n := n + 1;
    if not to_tsvector('english', r.doc) @@ websearch_to_tsquery('english', r.query) then
      raise exception 'fixture: the document does not match every word of "%"', r.query;
    end if;
    if r.bridge_terms = '' then
      raise exception 'fixture: "%" has no bridge terms (the bridge must fire on every fixture question)', r.query;
    end if;
    base := ts_rank(to_tsvector('english', r.doc), websearch_to_tsquery('english', r.query));
    sent := ts_rank(to_tsvector('english', r.doc), websearch_to_tsquery('english', r.sent));
    ored_q := r.query || ' or ' || replace(r.bridge_terms, ' ', ' or ');
    ored := ts_rank(to_tsvector('english', r.doc), websearch_to_tsquery('english', ored_q));
    raise notice 'rank % | sent % | or-form % | %', round(base::numeric, 4), round(sent::numeric, 4), round(ored::numeric, 4), r.query;
    if sent < base then
      raise exception 'keyword leg: rag.js''s query_text "%" ranks a full match of "%" at % (the question alone: %)', r.sent, r.query, sent, base;
    end if;
    if not ored < base * 0.5 then
      raise exception 'teeth: the OR form "%" no longer halves the rank (% vs %); this test would not catch a regression', ored_q, ored, base;
    end if;
  end loop;
  if n < 5 then
    raise exception 'fixture: only % rows loaded from tests/fixtures/rag-keyword-leg.csv', n;
  end if;
  raise notice 'rag keyword leg: all checks passed (% questions)', n;
end $$;

rollback;
