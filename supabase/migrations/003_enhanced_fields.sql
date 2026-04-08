-- Add parking info to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gate_code TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS access_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS parking_info TEXT;

-- Add structured equipment fields to pools
ALTER TABLE pools ADD COLUMN IF NOT EXISTS has_pump BOOLEAN DEFAULT false;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS has_filter BOOLEAN DEFAULT false;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS filter_type TEXT; -- cartridge, sand, DE
ALTER TABLE pools ADD COLUMN IF NOT EXISTS has_heater BOOLEAN DEFAULT false;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS heater_type TEXT; -- gas, electric, heat_pump, solar
ALTER TABLE pools ADD COLUMN IF NOT EXISTS has_cleaner BOOLEAN DEFAULT false;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS cleaner_type TEXT; -- suction, pressure, robotic
ALTER TABLE pools ADD COLUMN IF NOT EXISTS has_salt_system BOOLEAN DEFAULT false;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS salt_system_model TEXT;

-- Add full chemical readings to service_logs
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS combined_chlorine DECIMAL(4, 2);
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS cya INTEGER; -- cyanuric acid / stabilizer
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS calcium INTEGER; -- calcium hardness
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS tds INTEGER; -- total dissolved solids
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS salt_level INTEGER; -- salt in ppm
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS water_temp INTEGER; -- water temperature

-- Chemicals added tracking
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS chemicals_added JSONB DEFAULT '[]';
-- Format: [{"chemical": "chlorine_tabs", "amount": 3, "unit": "tabs"}, ...]

-- Equipment status
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS equipment_status JSONB DEFAULT '{}';
-- Format: {"pump": "good", "filter": "needs_cleaning", "heater": "off", "cleaner": "good"}

-- Time tracking
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS time_on_site_minutes INTEGER;

-- Add discount code and expiration
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index on discount codes for quick lookup
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code) WHERE code IS NOT NULL;
