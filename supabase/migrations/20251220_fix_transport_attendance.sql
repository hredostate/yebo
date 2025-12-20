-- Migration: Fix Transport Attendance Loading and Duplicate Groups
-- Description: Fixes issues with attendance loading when no trips exist and prevents duplicate groups
-- Date: 2025-12-20

-- ============================================
-- FIX 1: Add unique constraint for groups
-- ============================================

-- Clean up any existing duplicate groups
-- Keep the oldest group and reassign members from duplicates
DO $$
DECLARE
  v_duplicate_record RECORD;
  v_oldest_id INTEGER;
BEGIN
  -- Find and process duplicate groups
  FOR v_duplicate_record IN
    SELECT group_name, created_by, term_id, array_agg(id ORDER BY created_at ASC) as ids
    FROM transport_class_groups
    GROUP BY group_name, created_by, term_id
    HAVING COUNT(*) > 1
  LOOP
    -- Get the oldest group ID
    v_oldest_id := v_duplicate_record.ids[1];
    
    -- Reassign members from duplicate groups to the oldest group
    UPDATE transport_class_group_members
    SET group_id = v_oldest_id
    WHERE group_id = ANY(v_duplicate_record.ids[2:])
      AND student_id NOT IN (
        -- Don't reassign if student already exists in oldest group
        SELECT student_id FROM transport_class_group_members WHERE group_id = v_oldest_id
      );
    
    -- Delete duplicate group members that couldn't be reassigned
    DELETE FROM transport_class_group_members
    WHERE group_id = ANY(v_duplicate_record.ids[2:]);
    
    -- Delete the duplicate groups (keeping the oldest)
    DELETE FROM transport_class_groups
    WHERE id = ANY(v_duplicate_record.ids[2:]);
    
    RAISE NOTICE 'Cleaned up duplicate group: % (kept ID: %, removed IDs: %)', 
      v_duplicate_record.group_name, v_oldest_id, v_duplicate_record.ids[2:];
  END LOOP;
END $$;

-- Add unique constraint to prevent future duplicates
ALTER TABLE transport_class_groups 
DROP CONSTRAINT IF EXISTS transport_class_groups_unique_name_per_teacher_term;

ALTER TABLE transport_class_groups
ADD CONSTRAINT transport_class_groups_unique_name_per_teacher_term 
UNIQUE (group_name, created_by, term_id);

-- ============================================
-- FIX 2: Update get_teacher_transport_attendance function
-- ============================================

-- This function now auto-creates trips if they don't exist and uses LEFT JOIN
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
DECLARE
  v_route_record RECORD;
  v_trip_id INTEGER;
BEGIN
  -- Auto-create trips for all routes that have active groups but no trip for this date/direction
  FOR v_route_record IN
    SELECT DISTINCT r.id as route_id
    FROM transport_class_groups cg
    INNER JOIN transport_class_group_members cgm ON cgm.group_id = cg.id
    INNER JOIN transport_subscriptions sub ON sub.id = cgm.subscription_id
    INNER JOIN transport_routes r ON r.id = sub.route_id
    WHERE cg.created_by = p_user_id
      AND cg.is_active = true
      AND sub.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM transport_trips
        WHERE route_id = r.id
          AND trip_date = p_date
          AND direction = p_direction
      )
  LOOP
    -- Create the missing trip
    INSERT INTO transport_trips (route_id, trip_date, direction, status)
    VALUES (v_route_record.route_id, p_date, p_direction, 'scheduled')
    ON CONFLICT (route_id, trip_date, direction) DO NOTHING;
    
    RAISE NOTICE 'Auto-created trip for route % on % (%)', 
      v_route_record.route_id, p_date, p_direction;
  END LOOP;

  -- Now return the attendance data with LEFT JOIN on trips
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
  LEFT JOIN transport_trips t ON t.route_id = r.id 
    AND t.trip_date = p_date 
    AND t.direction = p_direction
  LEFT JOIN transport_attendance a ON a.trip_id = t.id AND a.student_id = s.id
  WHERE cg.created_by = p_user_id
    AND cg.is_active = true
    AND sub.status = 'active'
  ORDER BY r.route_name, st.stop_order, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Ensure trip exists
-- ============================================

-- New helper function to ensure a trip exists for a route/date/direction
CREATE OR REPLACE FUNCTION ensure_transport_trip(
  p_route_id INTEGER,
  p_date DATE,
  p_direction VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
  v_trip_id INTEGER;
BEGIN
  -- Try to get existing trip
  SELECT id INTO v_trip_id
  FROM transport_trips
  WHERE route_id = p_route_id
    AND trip_date = p_date
    AND direction = p_direction;
  
  -- If no trip exists, create it
  IF v_trip_id IS NULL THEN
    INSERT INTO transport_trips (route_id, trip_date, direction, status)
    VALUES (p_route_id, p_date, p_direction, 'scheduled')
    RETURNING id INTO v_trip_id;
    
    RAISE NOTICE 'Auto-created trip % for route % on % (%)', 
      v_trip_id, p_route_id, p_date, p_direction;
  END IF;
  
  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the fix
COMMENT ON FUNCTION get_teacher_transport_attendance IS 
  'Gets teacher transport attendance and auto-creates trips if they do not exist for the selected date and direction';

COMMENT ON FUNCTION ensure_transport_trip IS 
  'Ensures a transport trip exists for the given route, date, and direction, creating it if necessary';

-- Add index to improve performance of trip lookups
CREATE INDEX IF NOT EXISTS idx_transport_trips_date_direction 
ON transport_trips(trip_date, direction);

CREATE INDEX IF NOT EXISTS idx_transport_class_groups_created_by_term 
ON transport_class_groups(created_by, term_id) 
WHERE is_active = true;
