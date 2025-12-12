-- Переконайтеся, що ви підключені до потрібної бази даних.
-- DROP TABLE IF EXISTS... використовуються для очищення, якщо таблиці вже існують.

--------------------------------------------------------------------------------
-- 1. КОРИСТУВАЧІ ТА ПРОФІЛІ (USERS & PROFILES)
--------------------------------------------------------------------------------

DROP TABLE IF EXISTS user_saved_tours, user_saved_posts, user_fridge_magnets, fridge_settings, user_stats, user_profiles, posts, comments, post_likes, companion_ads, companion_ad_tags, user_interests, messages, conversations, tours, tour_categories, agencies, users, magnets CASCADE;


CREATE TABLE users (
                       user_id SERIAL PRIMARY KEY,
                       email VARCHAR(255) UNIQUE NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                       is_agent BOOLEAN DEFAULT FALSE,
                       is_email_public BOOLEAN DEFAULT FALSE,
                       is_location_public BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_profiles (
                               user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                               first_name VARCHAR(100),
                               last_name VARCHAR(100),
                               location VARCHAR(255),
                               date_of_birth DATE,
                               bio TEXT,
                               travel_interests VARCHAR(500),
                               profile_image_url VARCHAR(500)
);

CREATE TABLE user_stats (
                            user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                            countries_visited INT DEFAULT 0 CHECK (countries_visited >= 0),
                            cities_visited INT DEFAULT 0 CHECK (cities_visited >= 0),
                            followers_count INT DEFAULT 0 CHECK (followers_count >= 0)
);

--------------------------------------------------------------------------------
-- 2. ХОЛОДИЛЬНИК ТА МАГНІТИ (FRIDGE & MAGNETS)
--------------------------------------------------------------------------------

CREATE TABLE fridge_settings (
                                 user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                                 fridge_color VARCHAR(7) DEFAULT '#f3f4f6', -- HEX колір
                                 is_public BOOLEAN DEFAULT TRUE,
                                 allow_comments BOOLEAN DEFAULT TRUE
);

CREATE TABLE magnets (
                         magnet_id SERIAL PRIMARY KEY,
                         country VARCHAR(100) NOT NULL,
                         city VARCHAR(100),
                         icon_class VARCHAR(50) NOT NULL, -- Наприклад, 'plane', 'camera'
                         color_group VARCHAR(50) -- Наприклад, 'burgundy', 'teal'
);

CREATE UNIQUE INDEX idx_unique_magnet ON magnets (country, city);

CREATE TABLE user_fridge_magnets (
                                     user_fridge_magnet_id SERIAL PRIMARY KEY,
                                     user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                                     magnet_id INT NOT NULL REFERENCES magnets(magnet_id) ON DELETE RESTRICT,
                                     x_position INT NOT NULL,
                                     y_position INT NOT NULL,
    -- Комбінований унікальний індекс, якщо користувач не може мати однаковий магніт двічі
                                     UNIQUE (user_id, magnet_id)
);


--------------------------------------------------------------------------------
-- 3. ТУРИ ТА АГЕНЦІЇ (TOURS & AGENCIES)
--------------------------------------------------------------------------------

CREATE TABLE agencies (
                          agency_id SERIAL PRIMARY KEY,
                          name VARCHAR(255) UNIQUE NOT NULL,
                          description TEXT,
                          avg_rating NUMERIC(2, 1) DEFAULT 0.0 CHECK (avg_rating >= 0 AND avg_rating <= 5.0),
                          review_count INT DEFAULT 0,
                          total_tours_count INT DEFAULT 0
);

CREATE TABLE tour_categories (
                                 category_id SERIAL PRIMARY KEY,
                                 name_ukr VARCHAR(100) UNIQUE NOT NULL -- Наприклад, Пляжний відпочинок
);

CREATE TABLE tours (
                       tour_id SERIAL PRIMARY KEY,
                       agency_id INT REFERENCES agencies(agency_id) ON DELETE CASCADE,
                       category_id INT REFERENCES tour_categories(category_id) ON DELETE SET NULL,
                       title VARCHAR(255) NOT NULL,
                       description TEXT,
                       location VARCHAR(255),
                       duration_days INT,
                       price_uah NUMERIC(10, 2) NOT NULL CHECK (price_uah >= 0),
                       image_url VARCHAR(500),
                       rating NUMERIC(2, 1) DEFAULT 0.0
);

CREATE TABLE user_saved_tours (
                                  user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                                  tour_id INT REFERENCES tours(tour_id) ON DELETE CASCADE,
                                  saved_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                  PRIMARY KEY (user_id, tour_id)
);

--------------------------------------------------------------------------------
-- 4. ФОРУМ ТА КОНТЕНТ (FORUM & CONTENT)
--------------------------------------------------------------------------------

CREATE TABLE posts (
                       post_id SERIAL PRIMARY KEY,
                       author_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                       title VARCHAR(255) NOT NULL,
                       content TEXT NOT NULL,
                       category VARCHAR(100), -- Категорія/Геотег (Азія, Спорядження)
                       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                       updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                       likes_count INT DEFAULT 0 CHECK (likes_count >= 0)
);

CREATE TABLE post_likes (
                            user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                            post_id INT REFERENCES posts(post_id) ON DELETE CASCADE,
                            PRIMARY KEY (user_id, post_id)
);

CREATE TABLE comments (
                          comment_id SERIAL PRIMARY KEY,
                          post_id INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
                          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                          content TEXT NOT NULL,
                          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_saved_posts (
                                  user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                                  post_id INT REFERENCES posts(post_id) ON DELETE CASCADE,
                                  saved_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                  PRIMARY KEY (user_id, post_id)
);

--------------------------------------------------------------------------------
-- 5. ТЕГИ ТА ІНТЕРЕСИ (TAGS & INTERESTS)
--------------------------------------------------------------------------------

CREATE TABLE tags (
                      tag_id SERIAL PRIMARY KEY,
                      tag_name VARCHAR(100) UNIQUE NOT NULL -- Наприклад, 'Гори', 'Гастрономія', 'budget_low'
);

-- Таблиця для зв'язку інтересів з профілем користувача
CREATE TABLE user_interests (
                                user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                                tag_id INT NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
                                PRIMARY KEY (user_id, tag_id)
);

--------------------------------------------------------------------------------
-- 6. ПОШУК КОМПАНІЇ (COMPANIONS)
--------------------------------------------------------------------------------

CREATE TABLE companion_ads (
                               ad_id SERIAL PRIMARY KEY,
                               user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                               destination_country VARCHAR(100) NOT NULL,
                               start_date DATE NOT NULL,
                               end_date DATE NOT NULL,
                               min_group_size INT DEFAULT 1 CHECK (min_group_size >= 1),
                               max_group_size INT CHECK (max_group_size >= min_group_size),
                               budget_level NUMERIC(10, 2) DEFAULT 0,
                               description TEXT,
                               created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companion_ad_tags (
                                   ad_id INT REFERENCES companion_ads(ad_id) ON DELETE CASCADE,
                                   tag_id INT REFERENCES tags(tag_id) ON DELETE CASCADE,
                                   PRIMARY KEY (ad_id, tag_id)
);

--------------------------------------------------------------------------------
-- 7. ПОВІДОМЛЕННЯ (MESSAGES)
--------------------------------------------------------------------------------

-- Таблиця розмов (ЗБЕРЕЖЕНО ЯК ОКРЕМА ТАБЛИЦЯ, ЩОБ ЛЕГШЕ КЕРУВАТИ ЧАТОМ)
CREATE TABLE conversations (
                               conversation_id SERIAL PRIMARY KEY,
                               user_one_id INT REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
                               user_two_id INT REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
                               created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                               CONSTRAINT check_user_order CHECK (user_one_id < user_two_id),
                               CONSTRAINT unique_user_pair UNIQUE (user_one_id, user_two_id)
);

-- Таблиця повідомлень (СПРОЩЕНА: без receiver_id, оскільки є conversation_id)
CREATE TABLE messages (
                          message_id SERIAL PRIMARY KEY,
                          conversation_id INT REFERENCES conversations(conversation_id) ON DELETE CASCADE NOT NULL,
                          sender_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                          content TEXT NOT NULL,
                          sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_followers (
                                              follower_id INT REFERENCES users(user_id) ON DELETE CASCADE, -- Хто підписався
                                              following_id INT REFERENCES users(user_id) ON DELETE CASCADE, -- На кого підписався
                                              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                              PRIMARY KEY (follower_id, following_id),
                                              CONSTRAINT check_self_follow CHECK (follower_id != following_id)
);

CREATE TABLE IF NOT EXISTS post_images (
                                           image_id SERIAL PRIMARY KEY,
                                           post_id INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
                                           image_url TEXT NOT NULL,
                                           created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Індекс для швидкого пошуку зображень по ID поста
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);

-- Додаємо доступні магніти
INSERT INTO magnets (country, city, icon_class, color_group) VALUES
                                                                 ('Франція', 'Париж', 'plane', 'burgundy'),
                                                                 ('Японія', 'Токіо', 'camera', 'burgundy'),
                                                                 ('Швейцарія', 'Цюріх', 'mountain', 'burgundy'),
                                                                 ('Італія', 'Рим', 'coffee', 'teal'),
                                                                 ('Греція', 'Афіни', 'umbrella-beach', 'teal'),
                                                                 ('Іспанія', 'Барселона', 'map-marker-alt', 'teal'),
                                                                 ('Велика Британія', 'Лондон', 'bus', 'burgundy'),
                                                                 ('США', 'Нью-Йорк', 'building', 'teal')
ON CONFLICT (country, city) DO NOTHING;

CREATE TABLE notifications (
                               notification_id SERIAL PRIMARY KEY,
                               user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                               message TEXT NOT NULL,
                               link_url VARCHAR(500),
                               is_read BOOLEAN DEFAULT FALSE,
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);

DROP TABLE IF EXISTS agencies CASCADE;

-- Таблиця агенцій (зв'язана з користувачем-власником)
CREATE TABLE IF NOT EXISTS agencies (
                                        agency_id SERIAL PRIMARY KEY,
                                        owner_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                                        name VARCHAR(255) UNIQUE NOT NULL,
                                        license_number VARCHAR(100) UNIQUE NOT NULL,
                                        phone VARCHAR(50) NOT NULL,
                                        email VARCHAR(255) NOT NULL,
                                        website VARCHAR(255),
                                        is_agreed_data_processing BOOLEAN NOT NULL DEFAULT FALSE,
                                        description TEXT,
                                        avg_rating NUMERIC(2, 1) DEFAULT 0.0,
                                        review_count INT DEFAULT 0,
                                        total_tours_count INT DEFAULT 0,
                                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agencies_owner_id ON agencies(owner_id);