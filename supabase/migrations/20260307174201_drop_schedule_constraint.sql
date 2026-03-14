-- Drop the existing unique constraint that limits one slot per time
ALTER TABLE staff_schedules DROP CONSTRAINT staff_schedules_staff_id_date_time_slot_key;

-- Add new constraint allowing multiple zones per time slot
ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_date_time_zone_key UNIQUE (staff_id, date, time_slot, zone_id);
