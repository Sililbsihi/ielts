-- 雅思学习站 · 数据库建表 SQL（在 Supabase SQL Editor 执行一次）
-- 说明：本站不启用 anon 直查（无 RLS 策略 = anon 全拒），所有读写走服务端 service_role。

create extension if not exists "pgcrypto";

-- ===== 板块1：单词抄写 =====
create table if not exists wl_lists(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists wl_words(
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references wl_lists(id) on delete cascade,
  word text not null,                -- 原样（保留大小写/短语空格）
  norm text not null,                -- 归一化：小写去多余空格，用于去重
  meaning text not null default '',  -- 两个释义，用 ; 分隔
  is_phrase boolean not null default false,
  pos int not null default 0,        -- 排序
  err_count int not null default 0,  -- 累计抄错次数（复习参考）
  created_at timestamptz not null default now(),
  unique(list_id, norm)
);
create index if not exists wl_words_list_idx on wl_words(list_id, pos);

-- ===== 板块2：短文填空 =====
create table if not exists ps_passages(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,                -- 纠错后的全文
  marks jsonb not null default '[]', -- 隐藏区间 [{start,end}]（字符偏移）
  created_at timestamptz not null default now()
);

-- ===== 板块3：写作演练 =====
create table if not exists wr_prompts(
  id uuid primary key default gen_random_uuid(),
  content text not null,
  kind text not null default 'task2', -- task1 | task2 | other
  created_at timestamptz not null default now()
);

create table if not exists wr_essays(
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references wr_prompts(id) on delete set null,
  prompt_text text not null default '',
  title text not null default '',
  brainstorm text not null default '',
  content text not null default '',
  seconds int not null default 0,
  feedback jsonb,   -- [{orig,fixed,type,note}]
  scores jsonb,     -- {task_response,coherence,lexical,grammar,overall,comment}
  created_at timestamptz not null default now()
);

-- 关闭 anon 匿名访问（无策略 = 全拒；service_role 不受影响）
alter table wl_lists enable row level security;
alter table wl_words enable row level security;
alter table ps_passages enable row level security;
alter table wr_prompts enable row level security;
alter table wr_essays enable row level security;
