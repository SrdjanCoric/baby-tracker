-- Baby Tracker Initial Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- Households (for multi-caregiver grouping)
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id),
  email VARCHAR(255),
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Babies
CREATE TABLE babies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) NOT NULL,
  name VARCHAR(100) NOT NULL,
  birth_date DATE,
  gender VARCHAR(10),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedings
CREATE TABLE feedings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('breast', 'bottle', 'solid')),
  side VARCHAR(10) CHECK (side IN ('left', 'right', 'both')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  left_duration_seconds INTEGER,
  right_duration_seconds INTEGER,
  amount_ml DECIMAL(6,2),
  content_type VARCHAR(20) CHECK (content_type IN ('breastMilk', 'formula')),
  food_type VARCHAR(100),
  solid_amount VARCHAR(20) CHECK (solid_amount IN ('aLittle', 'some', 'aLot')),
  reaction VARCHAR(20) CHECK (reaction IN ('loved', 'meh', 'refused')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sleep Sessions
CREATE TABLE sleep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('nap', 'night')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diapers
CREATE TABLE diapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('wet', 'dirty', 'mixed')),
  stool_color VARCHAR(30),
  changed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pumping Sessions
CREATE TABLE pumping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  logged_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  amount_ml DECIMAL(6,2),
  side VARCHAR(10) CHECK (side IN ('left', 'right', 'both')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth Measurements
CREATE TABLE growth_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  logged_by UUID REFERENCES users(id),
  measured_at DATE NOT NULL,
  weight_kg DECIMAL(5,3),
  height_cm DECIMAL(5,2),
  head_cm DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tummy Time Sessions
CREATE TABLE tummy_time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  logged_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings (for goals and preferences per baby)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  tummy_time_goal_seconds INTEGER DEFAULT 1800,
  sleep_goal_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(baby_id, user_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pumping_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tummy_time_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- Households policies
CREATE POLICY "Users can view own household" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create household" ON households
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own household" ON households
  FOR UPDATE USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Babies policies
CREATE POLICY "Users can view household babies" ON babies
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert household babies" ON babies
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update household babies" ON babies
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete household babies" ON babies
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Feedings policies
CREATE POLICY "Users can view household feedings" ON feedings
  FOR SELECT USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert household feedings" ON feedings
  FOR INSERT WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update household feedings" ON feedings
  FOR UPDATE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household feedings" ON feedings
  FOR DELETE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

-- Sleep sessions policies
CREATE POLICY "Users can view household sleep" ON sleep_sessions
  FOR SELECT USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert household sleep" ON sleep_sessions
  FOR INSERT WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update household sleep" ON sleep_sessions
  FOR UPDATE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household sleep" ON sleep_sessions
  FOR DELETE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

-- Diapers policies
CREATE POLICY "Users can view household diapers" ON diapers
  FOR SELECT USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert household diapers" ON diapers
  FOR INSERT WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update household diapers" ON diapers
  FOR UPDATE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household diapers" ON diapers
  FOR DELETE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

-- Pumping sessions policies
CREATE POLICY "Users can view household pumping" ON pumping_sessions
  FOR SELECT USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert household pumping" ON pumping_sessions
  FOR INSERT WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update household pumping" ON pumping_sessions
  FOR UPDATE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household pumping" ON pumping_sessions
  FOR DELETE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

-- Growth measurements policies
CREATE POLICY "Users can view household growth" ON growth_measurements
  FOR SELECT USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert household growth" ON growth_measurements
  FOR INSERT WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update household growth" ON growth_measurements
  FOR UPDATE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household growth" ON growth_measurements
  FOR DELETE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

-- Tummy time sessions policies
CREATE POLICY "Users can view household tummy time" ON tummy_time_sessions
  FOR SELECT USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert household tummy time" ON tummy_time_sessions
  FOR INSERT WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update household tummy time" ON tummy_time_sessions
  FOR UPDATE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household tummy time" ON tummy_time_sessions
  FOR DELETE USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own settings" ON user_settings
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_household ON users(household_id);
CREATE INDEX idx_babies_household ON babies(household_id);
CREATE INDEX idx_feedings_baby ON feedings(baby_id);
CREATE INDEX idx_feedings_started_at ON feedings(started_at DESC);
CREATE INDEX idx_sleep_sessions_baby ON sleep_sessions(baby_id);
CREATE INDEX idx_sleep_sessions_started_at ON sleep_sessions(started_at DESC);
CREATE INDEX idx_diapers_baby ON diapers(baby_id);
CREATE INDEX idx_diapers_changed_at ON diapers(changed_at DESC);
CREATE INDEX idx_pumping_sessions_baby ON pumping_sessions(baby_id);
CREATE INDEX idx_growth_measurements_baby ON growth_measurements(baby_id);
CREATE INDEX idx_tummy_time_sessions_baby ON tummy_time_sessions(baby_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to generate invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create household with invite code
CREATE OR REPLACE FUNCTION create_household_with_code()
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  new_code VARCHAR(8);
BEGIN
  new_code := generate_invite_code();
  -- Retry if code exists (unlikely but possible)
  WHILE EXISTS (SELECT 1 FROM households WHERE invite_code = new_code) LOOP
    new_code := generate_invite_code();
  END LOOP;

  INSERT INTO households (invite_code) VALUES (new_code) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create a new household for the user
  new_household_id := create_household_with_code();

  -- Insert the user with the new household
  INSERT INTO public.users (id, email, household_id)
  VALUES (NEW.id, NEW.email, new_household_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
