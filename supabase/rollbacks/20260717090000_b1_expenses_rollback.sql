delete from storage.buckets where id = 'receipts';

drop table if exists expenses;

alter table tutors drop column if exists mileage_rate_cents;
