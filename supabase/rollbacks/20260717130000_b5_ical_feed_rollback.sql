drop function if exists regenerate_ical_token();
drop function if exists get_ical_feed(text);
alter table tutors drop column if exists ical_token;
