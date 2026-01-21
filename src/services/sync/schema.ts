import { column, Schema, Table } from '@powersync/react-native';

const babies = new Table({
  household_id: column.text,
  name: column.text,
  birth_date: column.text,
  gender: column.text,
  photo_url: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const feedings = new Table({
  baby_id: column.text,
  logged_by: column.text,
  type: column.text,
  side: column.text,
  started_at: column.text,
  ended_at: column.text,
  duration_seconds: column.integer,
  left_duration_seconds: column.integer,
  right_duration_seconds: column.integer,
  amount_ml: column.real,
  content_type: column.text,
  food_type: column.text,
  solid_amount: column.text,
  reaction: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const sleepSessions = new Table(
  {
    baby_id: column.text,
    logged_by: column.text,
    type: column.text,
    started_at: column.text,
    ended_at: column.text,
    duration_seconds: column.integer,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} }
);

const diapers = new Table({
  baby_id: column.text,
  logged_by: column.text,
  type: column.text,
  stool_color: column.text,
  changed_at: column.text,
  notes: column.text,
  created_at: column.text,
});

const pumpingSessions = new Table({
  baby_id: column.text,
  logged_by: column.text,
  started_at: column.text,
  ended_at: column.text,
  duration_seconds: column.integer,
  amount_ml: column.real,
  side: column.text,
  notes: column.text,
  created_at: column.text,
});

const growthMeasurements = new Table({
  baby_id: column.text,
  logged_by: column.text,
  measured_at: column.text,
  weight_kg: column.real,
  height_cm: column.real,
  head_cm: column.real,
  notes: column.text,
  created_at: column.text,
});

const tummyTimeSessions = new Table({
  baby_id: column.text,
  logged_by: column.text,
  started_at: column.text,
  ended_at: column.text,
  duration_seconds: column.integer,
  notes: column.text,
  created_at: column.text,
});

export const AppSchema = new Schema({
  babies,
  feedings,
  sleep_sessions: sleepSessions,
  diapers,
  pumping_sessions: pumpingSessions,
  growth_measurements: growthMeasurements,
  tummy_time_sessions: tummyTimeSessions,
});

export type Database = (typeof AppSchema)['types'];
export type BabyRecord = Database['babies'];
export type FeedingRecord = Database['feedings'];
export type SleepSessionRecord = Database['sleep_sessions'];
export type DiaperRecord = Database['diapers'];
export type PumpingSessionRecord = Database['pumping_sessions'];
export type GrowthMeasurementRecord = Database['growth_measurements'];
export type TummyTimeSessionRecord = Database['tummy_time_sessions'];
