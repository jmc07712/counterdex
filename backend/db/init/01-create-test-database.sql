-- Runs once, when the Docker volume is first created. Tests get their own database so they
-- can reset it freely without touching development data.
CREATE DATABASE counterdex_test OWNER counterdex;
