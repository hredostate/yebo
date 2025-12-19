-- Migration: Student Transportation System
-- Description: Complete transportation management system for school buses
-- Date: 2025-12-19

-- ============================================
-- CORE TRANSPORT TABLES
-- ============================================

-- Transport Routes (school-level, can serve multiple campuses)
CREATE TABLE IF NOT EXISTS transport_routes (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  route_name VARCHAR(100) NOT NULL,
  route_code VARCHAR(50),
  description TEXT,
  serves_campus_ids INTEGER[], -- NULL means all campuses
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  UNIQUE(school_id, route_code)
);

-- Transport Stops (pickup/dropoff locations per route)
CREATE TABLE IF NOT EXISTS transport_stops (
  id SERIAL PRIMARY KEY,
  route_id INTEGER REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_name VARCHAR(100) NOT NULL,
  stop_address TEXT,
  near_campus_id INTEGER REFERENCES campuses(id),
  pickup_time TIME, -- morning pickup time
  dropoff_time TIME, -- afternoon dropoff time
  stop_order INTEGER NOT NULL, -- order in route
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transport Buses (physical vehicles)
CREATE TABLE IF NOT EXISTS transport_buses (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  bus_number VARCHAR(50) NOT NULL,
  license_plate VARCHAR(50),
  capacity INTEGER NOT NULL DEFAULT 40,
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  home_campus_id INTEGER REFERENCES campuses(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, bus_number)
);

-- Transport Route Buses (buses assigned to routes)
CREATE TABLE IF NOT EXISTS transport_route_buses (
  id SERIAL PRIMARY KEY,
  route_id INTEGER REFERENCES transport_routes(id) ON DELETE CASCADE,
  bus_id INTEGER REFERENCES transport_buses(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, bus_id)
);

-- Transport Trips (daily trip instances)
CREATE TABLE IF NOT EXISTS transport_trips (
  id SERIAL PRIMARY KEY,
  route_id INTEGER REFERENCES transport_routes(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL,
  direction VARCHAR(20) NOT NULL, -- 'morning_pickup' or 'afternoon_dropoff'
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, trip_date, direction)
);

-- Transport Trip Buses (buses assigned to specific trips)
CREATE TABLE IF NOT EXISTS transport_trip_buses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES transport_trips(id) ON DELETE CASCADE,
  bus_id INTEGER REFERENCES transport_buses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, bus_id)
);

-- ============================================
-- SIGN-UP & SUBSCRIPTION TABLES
-- ============================================

-- Transport Requests (student sign-up requests)
CREATE TABLE IF NOT EXISTS transport_requests (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE,
  route_id INTEGER REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_id INTEGER REFERENCES transport_stops(id) ON DELETE CASCADE,
  preferred_bus_id INTEGER REFERENCES transport_buses(id),
  preferred_seat_label VARCHAR(10), -- e.g. "1A", "3C"
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'waitlisted', 'cancelled'
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  UNIQUE(student_id, term_id, route_id) -- One request per student per term per route
);

-- Transport Subscriptions (approved placements)
CREATE TABLE IF NOT EXISTS transport_subscriptions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE,
  route_id INTEGER REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_id INTEGER REFERENCES transport_stops(id) ON DELETE CASCADE,
  assigned_bus_id INTEGER REFERENCES transport_buses(id) ON DELETE CASCADE,
  seat_label VARCHAR(10), -- e.g. "1A", "3C"
  student_campus_id INTEGER REFERENCES campuses(id), -- snapshot of student's campus
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES user_profiles(id),
  cancellation_reason TEXT,
  UNIQUE(student_id, term_id), -- One active subscription per student per term
  UNIQUE(assigned_bus_id, seat_label, term_id, status) WHERE status = 'active' -- One seat per bus per term
);

-- ============================================
-- CLASS GROUP ATTENDANCE TABLES
-- ============================================

-- Transport Class Groups (teacher-created groups for attendance)
CREATE TABLE IF NOT EXISTS transport_class_groups (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  group_name VARCHAR(100) NOT NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE,
  route_id INTEGER REFERENCES transport_routes(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transport Class Group Members (students added to groups)
CREATE TABLE IF NOT EXISTS transport_class_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES transport_class_groups(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES transport_subscriptions(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES user_profiles(id),
  UNIQUE(group_id, student_id)
);

-- Transport Attendance (daily attendance records)
CREATE TABLE IF NOT EXISTS transport_attendance (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES transport_trips(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  class_group_id INTEGER REFERENCES transport_class_groups(id),
  status VARCHAR(20) NOT NULL, -- 'present', 'absent', 'late', 'excused', 'parent_pickup'
  marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  marked_by UUID REFERENCES user_profiles(id),
  note TEXT,
  sms_sent BOOLEAN DEFAULT false,
  sms_sent_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(trip_id, student_id)
);

-- ============================================
-- SMS NOTIFICATION TABLES
-- ============================================

-- Transport SMS Templates
CREATE TABLE IF NOT EXISTS transport_sms_templates (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  template_name VARCHAR(50) NOT NULL, -- 'boarding_confirmed', 'absent_alert', 'late_notification', 'departure', 'dropoff'
  template_text TEXT NOT NULL, -- Supports variables: {student_name}, {bus_number}, {route_name}, {time}, {stop_name}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, template_name)
);

-- Transport SMS Log
CREATE TABLE IF NOT EXISTS transport_sms_log (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  attendance_id INTEGER REFERENCES transport_attendance(id),
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  message_text TEXT NOT NULL,
  template_name VARCHAR(50),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'pending'
  error_message TEXT
);

-- ============================================
-- SETTINGS TABLE
-- ============================================

-- Transport Settings (per-school configuration)
CREATE TABLE IF NOT EXISTS transport_settings (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
  enable_sms_notifications BOOLEAN DEFAULT true,
  auto_send_boarding_sms BOOLEAN DEFAULT true,
  auto_send_absent_sms BOOLEAN DEFAULT true,
  auto_send_late_sms BOOLEAN DEFAULT false,
  auto_promote_waitlist BOOLEAN DEFAULT true,
  default_bus_capacity INTEGER DEFAULT 40,
  seat_layout_config JSONB DEFAULT '{"rows": 10, "columns": ["A", "B", "C", "D"]}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON transport_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_transport_buses_school ON transport_buses(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_trips_route_date ON transport_trips(route_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_transport_requests_student ON transport_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_transport_requests_term ON transport_requests(term_id);
CREATE INDEX IF NOT EXISTS idx_transport_requests_status ON transport_requests(status);
CREATE INDEX IF NOT EXISTS idx_transport_subscriptions_student ON transport_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_transport_subscriptions_term ON transport_subscriptions(term_id);
CREATE INDEX IF NOT EXISTS idx_transport_subscriptions_bus ON transport_subscriptions(assigned_bus_id);
CREATE INDEX IF NOT EXISTS idx_transport_attendance_trip ON transport_attendance(trip_id);
CREATE INDEX IF NOT EXISTS idx_transport_attendance_student ON transport_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_transport_class_groups_term ON transport_class_groups(term_id);
CREATE INDEX IF NOT EXISTS idx_transport_class_group_members_group ON transport_class_group_members(group_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_route_buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trip_buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_class_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transport_routes
CREATE POLICY "Users can view routes for their school"
ON transport_routes FOR SELECT
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Transport managers can manage routes"
ON transport_routes FOR ALL
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

-- RLS Policies for transport_stops
CREATE POLICY "Users can view stops for their school routes"
ON transport_stops FOR SELECT
USING (route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid())));

CREATE POLICY "Transport managers can manage stops"
ON transport_stops FOR ALL
USING (route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid())));

-- RLS Policies for transport_buses
CREATE POLICY "Users can view buses for their school"
ON transport_buses FOR SELECT
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Transport managers can manage buses"
ON transport_buses FOR ALL
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

-- RLS Policies for transport_route_buses
CREATE POLICY "Users can view route-bus assignments"
ON transport_route_buses FOR SELECT
USING (route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid())));

CREATE POLICY "Transport managers can manage route-bus assignments"
ON transport_route_buses FOR ALL
USING (route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid())));

-- RLS Policies for transport_trips
CREATE POLICY "Users can view trips for their school routes"
ON transport_trips FOR SELECT
USING (route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid())));

CREATE POLICY "Transport managers can manage trips"
ON transport_trips FOR ALL
USING (route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid())));

-- RLS Policies for transport_trip_buses
CREATE POLICY "Users can view trip-bus assignments"
ON transport_trip_buses FOR SELECT
USING (trip_id IN (SELECT id FROM transport_trips WHERE route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()))));

CREATE POLICY "Transport managers can manage trip-bus assignments"
ON transport_trip_buses FOR ALL
USING (trip_id IN (SELECT id FROM transport_trips WHERE route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()))));

-- RLS Policies for transport_requests
CREATE POLICY "Students can view their own requests"
ON transport_requests FOR SELECT
USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "Students can create transport requests"
ON transport_requests FOR INSERT
WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "Staff can view all requests for their school"
ON transport_requests FOR SELECT
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Transport managers can manage requests"
ON transport_requests FOR ALL
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

-- RLS Policies for transport_subscriptions
CREATE POLICY "Students can view their own subscriptions"
ON transport_subscriptions FOR SELECT
USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "Staff can view all subscriptions for their school"
ON transport_subscriptions FOR SELECT
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Transport managers can manage subscriptions"
ON transport_subscriptions FOR ALL
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

-- RLS Policies for transport_class_groups
CREATE POLICY "Teachers can view their own groups"
ON transport_class_groups FOR SELECT
USING (created_by = auth.uid() OR school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Teachers can create groups"
ON transport_class_groups FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Teachers can manage their own groups"
ON transport_class_groups FOR ALL
USING (created_by = auth.uid());

-- RLS Policies for transport_class_group_members
CREATE POLICY "Users can view group members"
ON transport_class_group_members FOR SELECT
USING (group_id IN (SELECT id FROM transport_class_groups WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid())));

CREATE POLICY "Group owners can manage members"
ON transport_class_group_members FOR ALL
USING (group_id IN (SELECT id FROM transport_class_groups WHERE created_by = auth.uid()));

-- RLS Policies for transport_attendance
CREATE POLICY "Users can view attendance for their school"
ON transport_attendance FOR SELECT
USING (trip_id IN (SELECT id FROM transport_trips WHERE route_id IN (SELECT id FROM transport_routes WHERE school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()))));

CREATE POLICY "Teachers can mark attendance for their groups"
ON transport_attendance FOR INSERT
WITH CHECK (class_group_id IN (SELECT id FROM transport_class_groups WHERE created_by = auth.uid()));

CREATE POLICY "Teachers can update attendance for their groups"
ON transport_attendance FOR UPDATE
USING (class_group_id IN (SELECT id FROM transport_class_groups WHERE created_by = auth.uid()));

-- RLS Policies for transport_sms_templates
CREATE POLICY "Users can view SMS templates for their school"
ON transport_sms_templates FOR SELECT
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Transport managers can manage SMS templates"
ON transport_sms_templates FOR ALL
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

-- RLS Policies for transport_sms_log
CREATE POLICY "Staff can view SMS log for their school"
ON transport_sms_log FOR SELECT
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "System can insert SMS log"
ON transport_sms_log FOR INSERT
WITH CHECK (true);

-- RLS Policies for transport_settings
CREATE POLICY "Users can view transport settings for their school"
ON transport_settings FOR SELECT
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Transport managers can manage transport settings"
ON transport_settings FOR ALL
USING (school_id IN (SELECT school_id FROM user_profiles WHERE id = auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_transport_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transport_routes_updated_at
  BEFORE UPDATE ON transport_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_updated_at();

CREATE TRIGGER trigger_transport_stops_updated_at
  BEFORE UPDATE ON transport_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_updated_at();

CREATE TRIGGER trigger_transport_buses_updated_at
  BEFORE UPDATE ON transport_buses
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_updated_at();

CREATE TRIGGER trigger_transport_trips_updated_at
  BEFORE UPDATE ON transport_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_updated_at();

CREATE TRIGGER trigger_transport_class_groups_updated_at
  BEFORE UPDATE ON transport_class_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_updated_at();

CREATE TRIGGER trigger_transport_sms_templates_updated_at
  BEFORE UPDATE ON transport_sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_updated_at();

CREATE TRIGGER trigger_transport_settings_updated_at
  BEFORE UPDATE ON transport_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_updated_at();

-- ============================================
-- DATABASE FUNCTIONS (RPCs)
-- ============================================

-- Function: Get available seats for a route
CREATE OR REPLACE FUNCTION get_route_available_seats(
  p_route_id INTEGER,
  p_term_id INTEGER
)
RETURNS TABLE(
  bus_id INTEGER,
  bus_number VARCHAR(50),
  total_capacity INTEGER,
  occupied_seats INTEGER,
  available_seats INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.bus_number,
    b.capacity,
    COALESCE(COUNT(s.id), 0)::INTEGER,
    (b.capacity - COALESCE(COUNT(s.id), 0))::INTEGER
  FROM transport_buses b
  INNER JOIN transport_route_buses rb ON rb.bus_id = b.id
  LEFT JOIN transport_subscriptions s ON s.assigned_bus_id = b.id 
    AND s.term_id = p_term_id 
    AND s.status = 'active'
  WHERE rb.route_id = p_route_id
    AND b.is_active = true
  GROUP BY b.id, b.bus_number, b.capacity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get route availability for a school
CREATE OR REPLACE FUNCTION get_route_availability(
  p_school_id INTEGER,
  p_term_id INTEGER,
  p_student_campus_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
  route_id INTEGER,
  route_name VARCHAR(100),
  route_code VARCHAR(50),
  total_capacity INTEGER,
  occupied_seats INTEGER,
  available_seats INTEGER,
  is_full BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.route_name,
    r.route_code,
    SUM(b.capacity)::INTEGER,
    COALESCE(COUNT(s.id), 0)::INTEGER,
    (SUM(b.capacity) - COALESCE(COUNT(s.id), 0))::INTEGER,
    (SUM(b.capacity) - COALESCE(COUNT(s.id), 0)) <= 0
  FROM transport_routes r
  INNER JOIN transport_route_buses rb ON rb.route_id = r.id
  INNER JOIN transport_buses b ON b.id = rb.bus_id AND b.is_active = true
  LEFT JOIN transport_subscriptions s ON s.assigned_bus_id = b.id 
    AND s.term_id = p_term_id 
    AND s.status = 'active'
  WHERE r.school_id = p_school_id
    AND r.is_active = true
    AND (r.serves_campus_ids IS NULL OR p_student_campus_id = ANY(r.serves_campus_ids))
  GROUP BY r.id, r.route_name, r.route_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Approve transport request with seat assignment
CREATE OR REPLACE FUNCTION approve_transport_request(
  p_request_id INTEGER,
  p_assigned_bus_id INTEGER,
  p_seat_label VARCHAR(10),
  p_approved_by UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  subscription_id INTEGER
) AS $$
DECLARE
  v_request transport_requests%ROWTYPE;
  v_bus_capacity INTEGER;
  v_occupied_seats INTEGER;
  v_new_subscription_id INTEGER;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM transport_requests WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Request not found'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Check bus capacity
  SELECT b.capacity INTO v_bus_capacity
  FROM transport_buses b
  WHERE b.id = p_assigned_bus_id AND b.is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Bus not found or inactive'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Count occupied seats
  SELECT COUNT(*) INTO v_occupied_seats
  FROM transport_subscriptions
  WHERE assigned_bus_id = p_assigned_bus_id
    AND term_id = v_request.term_id
    AND status = 'active';
  
  -- Check capacity
  IF v_occupied_seats >= v_bus_capacity THEN
    RETURN QUERY SELECT false, 'Bus is at full capacity'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Check if seat is already taken (if seat is specified)
  IF p_seat_label IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM transport_subscriptions
      WHERE assigned_bus_id = p_assigned_bus_id
        AND seat_label = p_seat_label
        AND term_id = v_request.term_id
        AND status = 'active'
    ) THEN
      RETURN QUERY SELECT false, 'Seat already occupied'::TEXT, NULL::INTEGER;
      RETURN;
    END IF;
  END IF;
  
  -- Create subscription
  INSERT INTO transport_subscriptions (
    school_id, student_id, term_id, route_id, stop_id,
    assigned_bus_id, seat_label, student_campus_id, status
  )
  SELECT
    school_id, student_id, term_id, route_id, stop_id,
    p_assigned_bus_id, p_seat_label,
    (SELECT campus_id FROM students WHERE id = v_request.student_id),
    'active'
  FROM transport_requests
  WHERE id = p_request_id
  RETURNING id INTO v_new_subscription_id;
  
  -- Update request status
  UPDATE transport_requests
  SET status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = p_approved_by
  WHERE id = p_request_id;
  
  RETURN QUERY SELECT true, 'Request approved successfully'::TEXT, v_new_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reject transport request
CREATE OR REPLACE FUNCTION reject_transport_request(
  p_request_id INTEGER,
  p_reason TEXT,
  p_rejected_by UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  UPDATE transport_requests
  SET status = 'rejected',
      rejection_reason = p_reason,
      reviewed_at = NOW(),
      reviewed_by = p_rejected_by
  WHERE id = p_request_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Request rejected successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Request not found'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Promote next waitlisted student
CREATE OR REPLACE FUNCTION promote_next_waitlisted(
  p_route_id INTEGER,
  p_term_id INTEGER,
  p_approved_by UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  promoted_request_id INTEGER
) AS $$
DECLARE
  v_next_request transport_requests%ROWTYPE;
  v_available_bus INTEGER;
  v_result RECORD;
BEGIN
  -- Find next waitlisted request (oldest first)
  SELECT * INTO v_next_request
  FROM transport_requests
  WHERE route_id = p_route_id
    AND term_id = p_term_id
    AND status = 'waitlisted'
  ORDER BY requested_at ASC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No waitlisted requests found'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Find a bus with available capacity
  SELECT bus_id INTO v_available_bus
  FROM get_route_available_seats(p_route_id, p_term_id)
  WHERE available_seats > 0
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No available seats on route'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Approve the request
  SELECT * INTO v_result
  FROM approve_transport_request(
    v_next_request.id,
    v_available_bus,
    NULL, -- No specific seat assigned during auto-promotion
    p_approved_by
  );
  
  RETURN QUERY SELECT v_result.success, v_result.message, v_next_request.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cancel transport subscription
CREATE OR REPLACE FUNCTION cancel_transport_subscription(
  p_subscription_id INTEGER,
  p_cancelled_by UUID,
  p_auto_promote BOOLEAN DEFAULT true
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_subscription transport_subscriptions%ROWTYPE;
  v_promote_result RECORD;
BEGIN
  -- Get subscription details
  SELECT * INTO v_subscription FROM transport_subscriptions WHERE id = p_subscription_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Subscription not found'::TEXT;
    RETURN;
  END IF;
  
  -- Cancel subscription
  UPDATE transport_subscriptions
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = p_cancelled_by
  WHERE id = p_subscription_id;
  
  -- Auto-promote from waitlist if enabled
  IF p_auto_promote THEN
    SELECT * INTO v_promote_result
    FROM promote_next_waitlisted(
      v_subscription.route_id,
      v_subscription.term_id,
      p_cancelled_by
    );
  END IF;
  
  RETURN QUERY SELECT true, 'Subscription cancelled successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Generate transport trips for date range
CREATE OR REPLACE FUNCTION generate_transport_trips(
  p_school_id INTEGER,
  p_start_date DATE,
  p_end_date DATE,
  p_route_ids INTEGER[] DEFAULT NULL,
  p_skip_weekends BOOLEAN DEFAULT true
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  trips_created INTEGER
) AS $$
DECLARE
  v_current_date DATE;
  v_route_id INTEGER;
  v_trips_count INTEGER := 0;
  v_route_ids INTEGER[];
BEGIN
  -- Get route IDs if not specified
  IF p_route_ids IS NULL THEN
    SELECT ARRAY_AGG(id) INTO v_route_ids
    FROM transport_routes
    WHERE school_id = p_school_id AND is_active = true;
  ELSE
    v_route_ids := p_route_ids;
  END IF;
  
  -- Loop through dates
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    -- Skip weekends if requested
    IF NOT p_skip_weekends OR EXTRACT(DOW FROM v_current_date) NOT IN (0, 6) THEN
      -- Create trips for each route
      FOREACH v_route_id IN ARRAY v_route_ids LOOP
        -- Morning pickup trip
        INSERT INTO transport_trips (route_id, trip_date, direction, status)
        VALUES (v_route_id, v_current_date, 'morning_pickup', 'scheduled')
        ON CONFLICT (route_id, trip_date, direction) DO NOTHING;
        
        IF FOUND THEN
          v_trips_count := v_trips_count + 1;
        END IF;
        
        -- Afternoon dropoff trip
        INSERT INTO transport_trips (route_id, trip_date, direction, status)
        VALUES (v_route_id, v_current_date, 'afternoon_dropoff', 'scheduled')
        ON CONFLICT (route_id, trip_date, direction) DO NOTHING;
        
        IF FOUND THEN
          v_trips_count := v_trips_count + 1;
        END IF;
      END LOOP;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN QUERY SELECT true, format('Created %s trips', v_trips_count)::TEXT, v_trips_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get transport roster (students available for class groups)
CREATE OR REPLACE FUNCTION get_transport_roster(
  p_school_id INTEGER,
  p_term_id INTEGER,
  p_route_id INTEGER DEFAULT NULL,
  p_bus_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
  student_id INTEGER,
  student_name VARCHAR,
  admission_number VARCHAR,
  campus_name VARCHAR,
  route_name VARCHAR,
  stop_name VARCHAR,
  bus_number VARCHAR,
  seat_label VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.admission_number,
    c.name,
    r.route_name,
    st.stop_name,
    b.bus_number,
    sub.seat_label
  FROM transport_subscriptions sub
  INNER JOIN students s ON s.id = sub.student_id
  INNER JOIN transport_routes r ON r.id = sub.route_id
  INNER JOIN transport_stops st ON st.id = sub.stop_id
  INNER JOIN transport_buses b ON b.id = sub.assigned_bus_id
  LEFT JOIN campuses c ON c.id = s.campus_id
  WHERE sub.school_id = p_school_id
    AND sub.term_id = p_term_id
    AND sub.status = 'active'
    AND (p_route_id IS NULL OR sub.route_id = p_route_id)
    AND (p_bus_id IS NULL OR sub.assigned_bus_id = p_bus_id)
  ORDER BY r.route_name, st.stop_order, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get available students for a class group (not yet in group)
CREATE OR REPLACE FUNCTION get_available_students_for_group(
  p_group_id INTEGER
)
RETURNS TABLE(
  student_id INTEGER,
  student_name VARCHAR,
  route_name VARCHAR,
  stop_name VARCHAR
) AS $$
DECLARE
  v_group_term_id INTEGER;
  v_group_school_id INTEGER;
  v_group_route_id INTEGER;
BEGIN
  -- Get group details
  SELECT term_id, school_id, route_id 
  INTO v_group_term_id, v_group_school_id, v_group_route_id
  FROM transport_class_groups
  WHERE id = p_group_id;
  
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    r.route_name,
    st.stop_name
  FROM transport_subscriptions sub
  INNER JOIN students s ON s.id = sub.student_id
  INNER JOIN transport_routes r ON r.id = sub.route_id
  INNER JOIN transport_stops st ON st.id = sub.stop_id
  WHERE sub.school_id = v_group_school_id
    AND sub.term_id = v_group_term_id
    AND sub.status = 'active'
    AND (v_group_route_id IS NULL OR sub.route_id = v_group_route_id)
    AND sub.student_id NOT IN (
      SELECT student_id FROM transport_class_group_members WHERE group_id = p_group_id
    )
  ORDER BY r.route_name, st.stop_order, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get teacher's transport attendance view
CREATE OR REPLACE FUNCTION get_teacher_transport_attendance(
  p_user_id UUID,
  p_date DATE,
  p_direction VARCHAR
)
RETURNS TABLE(
  trip_id INTEGER,
  student_id INTEGER,
  student_name VARCHAR,
  route_name VARCHAR,
  stop_name VARCHAR,
  class_group_name VARCHAR,
  class_group_id INTEGER,
  attendance_status VARCHAR,
  marked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    s.id,
    s.name,
    r.route_name,
    st.stop_name,
    cg.group_name,
    cg.id,
    a.status,
    a.marked_at
  FROM transport_class_groups cg
  INNER JOIN transport_class_group_members cgm ON cgm.group_id = cg.id
  INNER JOIN students s ON s.id = cgm.student_id
  INNER JOIN transport_subscriptions sub ON sub.id = cgm.subscription_id
  INNER JOIN transport_routes r ON r.id = sub.route_id
  INNER JOIN transport_stops st ON st.id = sub.stop_id
  INNER JOIN transport_trips t ON t.route_id = r.id 
    AND t.trip_date = p_date 
    AND t.direction = p_direction
  LEFT JOIN transport_attendance a ON a.trip_id = t.id AND a.student_id = s.id
  WHERE cg.created_by = p_user_id
    AND cg.is_active = true
    AND sub.status = 'active'
  ORDER BY r.route_name, st.stop_order, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark transport attendance by teacher
CREATE OR REPLACE FUNCTION mark_transport_attendance_by_teacher(
  p_trip_id INTEGER,
  p_student_id INTEGER,
  p_status VARCHAR,
  p_marked_by UUID,
  p_class_group_id INTEGER,
  p_note TEXT DEFAULT NULL,
  p_send_sms BOOLEAN DEFAULT false
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  INSERT INTO transport_attendance (
    trip_id, student_id, class_group_id, status, marked_by, note
  )
  VALUES (
    p_trip_id, p_student_id, p_class_group_id, p_status, p_marked_by, p_note
  )
  ON CONFLICT (trip_id, student_id) 
  DO UPDATE SET
    status = p_status,
    marked_at = NOW(),
    marked_by = p_marked_by,
    note = p_note;
  
  -- TODO: Implement SMS sending logic here if p_send_sms is true
  
  RETURN QUERY SELECT true, 'Attendance marked successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Bulk mark attendance for multiple students
CREATE OR REPLACE FUNCTION bulk_mark_transport_attendance(
  p_trip_id INTEGER,
  p_class_group_id INTEGER,
  p_marked_by UUID,
  p_students_jsonb JSONB -- Array of {student_id, status, note}
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  processed_count INTEGER
) AS $$
DECLARE
  v_student JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_student IN SELECT * FROM jsonb_array_elements(p_students_jsonb) LOOP
    INSERT INTO transport_attendance (
      trip_id, student_id, class_group_id, status, marked_by, note
    )
    VALUES (
      p_trip_id,
      (v_student->>'student_id')::INTEGER,
      p_class_group_id,
      v_student->>'status',
      p_marked_by,
      v_student->>'note'
    )
    ON CONFLICT (trip_id, student_id) 
    DO UPDATE SET
      status = v_student->>'status',
      marked_at = NOW(),
      marked_by = p_marked_by,
      note = v_student->>'note';
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT true, format('Processed %s attendance records', v_count)::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Generate transport manifest
CREATE OR REPLACE FUNCTION generate_transport_manifest(
  p_trip_id INTEGER
)
RETURNS TABLE(
  student_id INTEGER,
  student_name VARCHAR,
  admission_number VARCHAR,
  campus_name VARCHAR,
  stop_name VARCHAR,
  stop_order INTEGER,
  seat_label VARCHAR,
  attendance_status VARCHAR,
  marked_at TIMESTAMP WITH TIME ZONE,
  parent_phone VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.admission_number,
    c.name,
    st.stop_name,
    st.stop_order,
    sub.seat_label,
    a.status,
    a.marked_at,
    COALESCE(s.parent_phone_number_1, s.parent_phone_number_2)
  FROM transport_trips t
  INNER JOIN transport_subscriptions sub ON sub.route_id = t.route_id 
    AND sub.term_id IN (SELECT id FROM terms WHERE is_current = true LIMIT 1)
    AND sub.status = 'active'
  INNER JOIN students s ON s.id = sub.student_id
  INNER JOIN transport_stops st ON st.id = sub.stop_id
  LEFT JOIN campuses c ON c.id = s.campus_id
  LEFT JOIN transport_attendance a ON a.trip_id = t.id AND a.student_id = s.id
  WHERE t.id = p_trip_id
  ORDER BY st.stop_order, sub.seat_label, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DEFAULT SMS TEMPLATES
-- ============================================

-- Note: These templates are school-specific and should be created during school setup
-- For multi-school deployments, use the following pattern:
-- INSERT INTO transport_sms_templates (school_id, template_name, template_text) VALUES
-- (:school_id, 'boarding_confirmed', 'Hello! {student_name} has boarded bus {bus_number} on route {route_name} at {time}.')
-- etc. for each school

-- Example templates (comment out or customize for your deployment):
-- INSERT INTO transport_sms_templates (school_id, template_name, template_text) VALUES
-- (1, 'boarding_confirmed', 'Hello! {student_name} has boarded bus {bus_number} on route {route_name} at {time}.'),
-- (1, 'absent_alert', 'Alert: {student_name} was marked absent from bus {bus_number} ({route_name}) at {time}.'),
-- (1, 'late_notification', 'Notice: {student_name} was marked late for bus {bus_number} ({route_name}) at {time}.'),
-- (1, 'departure', 'Bus {bus_number} ({route_name}) has departed at {time}.'),
-- (1, 'dropoff', '{student_name} has been dropped off at {stop_name} at {time}.')
-- ON CONFLICT (school_id, template_name) DO NOTHING;

-- Insert default transport settings (school-specific)
-- INSERT INTO transport_settings (school_id) VALUES (1)
-- ON CONFLICT (school_id) DO NOTHING;
