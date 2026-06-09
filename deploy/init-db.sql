-- 初始化脚本：在 PostgreSQL 中创建智派数据库
-- Docker postgres 在首次启动时通过 psql 自动执行

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zhipai') THEN
    PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE zhipai');
  END IF;
END
$$;

-- 如果 dblink 扩展不可用，用简单方式（需要 SUPERUSER 权限）
-- CREATE DATABASE zhipai;
-- （Docker postgres 镜像默认以 SUPERUSER 运行，上面 DO 块足够）
