-- Оптимізація за результатами тестування обсягом даних (розділ 5.7):
-- робочий список менеджера сортує бронювання за часом створення (спочатку нові),
-- з фільтром за станом або без нього. Індекси дозволяють читати першу сторінку
-- без повного сортування таблиці.
CREATE INDEX ix_booking_created ON booking (created_at DESC, id DESC);
CREATE INDEX ix_booking_status_created ON booking (status, created_at DESC, id DESC);
