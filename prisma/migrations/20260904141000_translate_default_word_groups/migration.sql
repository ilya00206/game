UPDATE "WordGroup" SET "name" = CASE "name"
  WHEN 'greetings' THEN 'Приветствия'
  WHEN 'basics' THEN 'Основы'
  WHEN 'animals' THEN 'Животные'
  WHEN 'nature' THEN 'Природа'
  WHEN 'feelings' THEN 'Чувства'
  WHEN 'food' THEN 'Еда'
  WHEN 'objects' THEN 'Предметы'
  WHEN 'travel' THEN 'Путешествия'
  WHEN 'time' THEN 'Время'
  ELSE "name"
END
WHERE "name" IN ('greetings', 'basics', 'animals', 'nature', 'feelings', 'food', 'objects', 'travel', 'time');