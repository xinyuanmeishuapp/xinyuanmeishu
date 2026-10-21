alter table public.courses
  drop constraint if exists courses_category_check;

update public.courses
set category = case category
  when 'kids' then '美術創作'
  when 'adults' then '大人日常畫畫'
  when 'holiday' then '連續假期活動'
  else category
end
where category in ('kids', 'adults', 'holiday');
