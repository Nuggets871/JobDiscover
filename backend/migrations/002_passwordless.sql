alter table users alter column password_hash drop not null;
alter table users drop constraint if exists users_password_hash_check;
alter table users add constraint users_password_hash_check check (
  password_hash is null or length(password_hash) between 80 and 180
);
alter table auth_tokens drop constraint if exists auth_tokens_purpose_check;
alter table auth_tokens add constraint auth_tokens_purpose_check check (
  purpose in ('email', 'recovery', 'login')
);