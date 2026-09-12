-- RAG Setup for cloudyjoe.com chatbot
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Enable pgvector extension
create extension if not exists vector with schema extensions;

-- 2. Create documents table
create table if not exists public.documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(512),
  fts tsvector generated always as (to_tsvector('english', content)) stored
);

-- 3. Hybrid search function (vector similarity + BM25 keyword match)
create or replace function hybrid_search (
  query_text text,
  query_embedding vector(512),
  match_count int default 10,
  semantic_weight float default 0.7,
  keyword_weight float default 0.3,
  filter jsonb default '{}'::jsonb
) returns table (
  id bigint, content text, metadata jsonb, similarity float
) language plpgsql as $$
begin
  return query
  select d.id, d.content, d.metadata,
    (semantic_weight * (1 - (d.embedding <=> query_embedding)) +
     keyword_weight * coalesce(ts_rank(d.fts, websearch_to_tsquery('english', query_text)), 0)
    ) as similarity
  from documents d
  where case when filter != '{}'::jsonb then d.metadata @> filter else true end
  order by similarity desc
  limit match_count;
end; $$;

-- 4. Delete function for re-indexing
create or replace function delete_documents_by_slug(slug text)
returns void language plpgsql as $$
begin
  delete from documents where metadata->>'article_id' = slug;
end; $$;

-- 5. Indices
create index if not exists documents_embedding_idx on documents
  using ivfflat (embedding vector_cosine_ops) with (lists = 10);
create index if not exists documents_fts_idx on documents using gin (fts);
create index if not exists documents_metadata_idx on documents using gin (metadata);

-- 6. Keyword-only retrieval (used when no embedding provider is configured;
--    hybrid_search needs a query vector). websearch (AND) semantics first,
--    then OR-of-lexemes so multi-word questions still hit.
create or replace function keyword_search(
  query_text text,
  match_count integer default 10
)
returns table(id bigint, content text, metadata jsonb, similarity double precision)
language plpgsql
set search_path to 'public', 'extensions'
as $$
declare
  q tsquery := websearch_to_tsquery('english', query_text);
  q_or text;
begin
  return query
  select d.id, d.content, d.metadata,
    ts_rank_cd(d.fts, q, 32)::double precision as similarity
  from public.documents d
  where d.fts @@ q
  order by similarity desc
  limit match_count;
  if found then return; end if;

  select string_agg(lexeme, ' | ') into q_or
  from unnest(tsvector_to_array(to_tsvector('english', query_text))) as lexeme;
  if q_or is null or q_or = '' then return; end if;

  return query
  select d.id, d.content, d.metadata,
    ts_rank_cd(d.fts, to_tsquery('english', q_or), 32)::double precision as similarity
  from public.documents d
  where d.fts @@ to_tsquery('english', q_or)
  order by similarity desc
  limit match_count;
end;
$$;
