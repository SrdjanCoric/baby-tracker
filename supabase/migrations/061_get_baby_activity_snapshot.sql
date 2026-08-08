-- Additive, authenticated read model for native selected-baby activity surfaces.
CREATE OR REPLACE FUNCTION public.widget_snapshot_statement_timestamp()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT pg_catalog.statement_timestamp() $$;

REVOKE ALL ON FUNCTION public.widget_snapshot_statement_timestamp()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.widget_snapshot_statement_timestamp()
TO authenticated;

-- The initial body is intentionally a single SQL statement so every relation added to the
-- snapshot reads from one PostgreSQL statement snapshot.
CREATE OR REPLACE FUNCTION public.get_baby_activity_snapshot(
  p_baby_id uuid,
  p_timezone text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH RECURSIVE request_clock AS (
    SELECT public.widget_snapshot_statement_timestamp() AS server_as_of
  ),
  valid_timezone AS (
    SELECT
      zone.name,
      request_clock.server_as_of,
      pg_catalog.date_trunc(
        'day',
        request_clock.server_as_of AT TIME ZONE zone.name
      ) AT TIME ZONE zone.name AS local_day_start
    FROM pg_catalog.pg_timezone_names AS zone
    CROSS JOIN request_clock
    WHERE zone.name = p_timezone
      AND zone.name NOT LIKE 'posix/%'
      AND zone.name NOT LIKE 'right/%'
    LIMIT 1
  ),
  authorized_baby AS (
    SELECT
      baby.id,
      baby.name,
      baby.birth_date,
      valid_timezone.name AS timezone_name,
      valid_timezone.server_as_of,
      valid_timezone.local_day_start,
      (
        pg_catalog.date_trunc(
          'day',
          valid_timezone.server_as_of AT TIME ZONE valid_timezone.name
        ) + INTERVAL '1 day'
      ) AT TIME ZONE valid_timezone.name AS local_day_end
    FROM public.babies AS baby
    CROSS JOIN valid_timezone
    WHERE baby.id = p_baby_id
      AND baby.deleted = false
  ),
  snapshot_config AS (
    SELECT
      authorized_baby.*,
      COALESCE(preferences.enabled, false) AS wake_enabled,
      COALESCE(preferences.source, 'age_based') AS wake_source,
      COALESCE(preferences.wake_window_slots, '[]'::jsonb) AS wake_window_slots,
      COALESCE(preferences.day_start_hour, 6) AS day_start_hour,
      COALESCE(preferences.day_end_hour, 19) AS day_end_hour,
      COALESCE(preferences.nap_continuation_minutes, 25) AS nap_continuation_minutes,
      COALESCE(
        sleep_goal.target_value,
        CASE
          WHEN authorized_baby.birth_date IS NULL THEN 840
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 0 AND 90 THEN 930
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 91 AND 150 THEN 870
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 151 AND 240 THEN 840
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 241 AND 540 THEN 810
          ELSE 690
        END
      ) AS sleep_goal_minutes,
      COALESCE(
        tummy_goal.target_value,
        CASE
          WHEN authorized_baby.birth_date IS NULL THEN 600
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 0 AND 14 THEN 120
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 15 AND 28 THEN 300
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 29 AND 60 THEN 600
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 61 AND 90 THEN 1200
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 91 AND 120 THEN 1800
          WHEN (authorized_baby.server_as_of AT TIME ZONE authorized_baby.timezone_name)::date
            - authorized_baby.birth_date BETWEEN 121 AND 180 THEN 2700
          ELSE 3600
        END
      ) AS tummy_goal_seconds
    FROM authorized_baby
    LEFT JOIN public.wake_window_preferences AS preferences
      ON preferences.baby_id = authorized_baby.id
    LEFT JOIN public.activity_goals AS sleep_goal
      ON sleep_goal.baby_id = authorized_baby.id
      AND sleep_goal.goal_type = 'sleep'
    LEFT JOIN public.activity_goals AS tummy_goal
      ON tummy_goal.baby_id = authorized_baby.id
      AND tummy_goal.goal_type = 'tummy_time'
  ),
  configured_windows AS (
    SELECT
      snapshot_config.*,
      CASE
        WHEN EXTRACT(
          HOUR FROM snapshot_config.server_as_of AT TIME ZONE snapshot_config.timezone_name
        ) < snapshot_config.day_start_hour
        THEN (
          pg_catalog.date_trunc(
            'day',
            snapshot_config.server_as_of AT TIME ZONE snapshot_config.timezone_name
          ) - INTERVAL '1 day'
          + pg_catalog.make_interval(hours => snapshot_config.day_start_hour)
        ) AT TIME ZONE snapshot_config.timezone_name
        ELSE (
          pg_catalog.date_trunc(
            'day',
            snapshot_config.server_as_of AT TIME ZONE snapshot_config.timezone_name
          ) + pg_catalog.make_interval(hours => snapshot_config.day_start_hour)
        ) AT TIME ZONE snapshot_config.timezone_name
      END AS sleep_day_start
    FROM snapshot_config
  ),
  config AS (
    SELECT
      configured_windows.*,
      (
        configured_windows.sleep_day_start
          AT TIME ZONE configured_windows.timezone_name
        + INTERVAL '1 day'
      ) AT TIME ZONE configured_windows.timezone_name AS sleep_day_end,
      (
        pg_catalog.date_trunc(
          'day',
          configured_windows.server_as_of AT TIME ZONE configured_windows.timezone_name
        ) + pg_catalog.make_interval(hours => configured_windows.day_end_hour)
      ) AT TIME ZONE configured_windows.timezone_name AS current_day_end
    FROM configured_windows
  ),
  timer_rows AS (
    SELECT
      timer.baby_id,
      timer.activity_type,
      timer.started_by,
      starter.display_name AS started_by_name,
      timer.started_at,
      timer.timer_data
    FROM public.active_timers AS timer
    JOIN config ON config.id = timer.baby_id
    LEFT JOIN public.users AS starter ON starter.id = timer.started_by
  ),
  active_timer_values AS (
    SELECT
      CASE timer.activity_type
        WHEN 'feeding' THEN 1
        WHEN 'sleep' THEN 2
        WHEN 'pumping' THEN 3
        WHEN 'tummy_time' THEN 4
      END AS sort_order,
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'type', CASE timer.activity_type
          WHEN 'tummy_time' THEN 'tummyTime'
          ELSE timer.activity_type
        END,
        'startTime', pg_catalog.to_char(
          timer.started_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'timerInstanceId', NULLIF(timer.timer_data->>'timerInstanceId', ''),
        'context', CASE
          WHEN timer.started_by <> auth.uid() THEN timer.started_by_name
          ELSE COALESCE(
            timer.timer_data->>'side',
            timer.timer_data->>'sleepType',
            CASE WHEN timer.activity_type = 'sleep'
              THEN timer.timer_data->>'type'
            END
          )
        END,
        'isRemote', timer.started_by <> auth.uid(),
        'isPaused', COALESCE((timer.timer_data->>'isPaused')::boolean, false),
        'accumulatedSeconds', CASE
          WHEN pg_catalog.jsonb_typeof(timer.timer_data->'accumulatedSeconds') = 'number'
          THEN (timer.timer_data->>'accumulatedSeconds')::integer
          ELSE NULL
        END
      )) AS value
    FROM timer_rows AS timer
  ),
  active_timer_summary AS (
    SELECT COALESCE(
      pg_catalog.jsonb_agg(active_timer_values.value ORDER BY active_timer_values.sort_order),
      '[]'::jsonb
    ) AS timers
    FROM active_timer_values
  ),
  visible_feedings AS (
    SELECT
      feeding.id,
      feeding.baby_id,
      feeding.logged_by,
      feeding.type,
      feeding.side,
      feeding.started_at,
      feeding.ended_at
    FROM public.feedings AS feeding
    JOIN config ON config.id = feeding.baby_id
    WHERE feeding.deleted = false
      AND NOT EXISTS (
        SELECT 1
        FROM timer_rows AS timer
        WHERE timer.activity_type = 'feeding'
          AND (
            (
              NULLIF(timer.timer_data->>'activityId', '') IS NOT NULL
              AND timer.timer_data->>'activityId' = feeding.id::text
            )
            OR (
              NULLIF(timer.timer_data->>'activityId', '') IS NULL
              AND feeding.logged_by = timer.started_by
              AND feeding.started_at = timer.started_at
            )
          )
      )
  ),
  visible_sleep AS (
    SELECT
      sleep.id,
      sleep.baby_id,
      sleep.logged_by,
      sleep.type,
      sleep.started_at,
      sleep.ended_at,
      sleep.duration_seconds,
      sleep.morning_classification,
      sleep.morning_classification_version
    FROM public.sleep_sessions AS sleep
    JOIN config ON config.id = sleep.baby_id
    WHERE sleep.deleted = false
      AND NOT EXISTS (
        SELECT 1
        FROM timer_rows AS timer
        WHERE timer.activity_type = 'sleep'
          AND (
            (
              NULLIF(timer.timer_data->>'activityId', '') IS NOT NULL
              AND timer.timer_data->>'activityId' = sleep.id::text
            )
            OR (
              NULLIF(timer.timer_data->>'activityId', '') IS NULL
              AND sleep.logged_by = timer.started_by
              AND sleep.started_at = timer.started_at
            )
          )
      )
  ),
  visible_pumping AS (
    SELECT
      pumping.id,
      pumping.baby_id,
      pumping.logged_by,
      pumping.started_at,
      pumping.amount_ml,
      pumping.side
    FROM public.pumping_sessions AS pumping
    JOIN config ON config.id = pumping.baby_id
    WHERE pumping.deleted = false
      AND NOT EXISTS (
        SELECT 1
        FROM timer_rows AS timer
        WHERE timer.activity_type = 'pumping'
          AND (
            (
              NULLIF(timer.timer_data->>'activityId', '') IS NOT NULL
              AND timer.timer_data->>'activityId' = pumping.id::text
            )
            OR (
              NULLIF(timer.timer_data->>'activityId', '') IS NULL
              AND pumping.logged_by = timer.started_by
              AND pumping.started_at = timer.started_at
            )
          )
      )
  ),
  visible_tummy_time AS (
    SELECT
      tummy.id,
      tummy.baby_id,
      tummy.logged_by,
      tummy.started_at,
      tummy.duration_seconds
    FROM public.tummy_time_sessions AS tummy
    JOIN config ON config.id = tummy.baby_id
    WHERE tummy.deleted = false
      AND NOT EXISTS (
        SELECT 1
        FROM timer_rows AS timer
        WHERE timer.activity_type = 'tummy_time'
          AND (
            (
              NULLIF(timer.timer_data->>'activityId', '') IS NOT NULL
              AND timer.timer_data->>'activityId' = tummy.id::text
            )
            OR (
              NULLIF(timer.timer_data->>'activityId', '') IS NULL
              AND tummy.logged_by = timer.started_by
              AND tummy.started_at = timer.started_at
            )
          )
      )
  ),
  latest_feeding AS (
    SELECT feeding.*
    FROM visible_feedings AS feeding
    ORDER BY feeding.started_at DESC, feeding.id DESC
    LIMIT 1
  ),
  feeding_day_ordered AS (
    SELECT
      feeding.started_at,
      pg_catalog.lag(COALESCE(feeding.ended_at, feeding.started_at)) OVER (
        ORDER BY feeding.started_at, feeding.id
      ) AS previous_end
    FROM visible_feedings AS feeding
    JOIN config ON true
    WHERE feeding.started_at >= config.local_day_start
      AND feeding.started_at < config.local_day_end
  ),
  feeding_summary AS (
    SELECT COALESCE(
      pg_catalog.sum(
        CASE
          WHEN previous_end IS NULL OR started_at - previous_end >= INTERVAL '1 hour' THEN 1
          ELSE 0
        END
      ),
      0
    )::integer AS today_count
    FROM feeding_day_ordered
  ),
  completed_sleep AS (
    SELECT sleep.*
    FROM visible_sleep AS sleep
    WHERE sleep.ended_at IS NOT NULL
  ),
  latest_sleep AS (
    SELECT completed_sleep.*
    FROM completed_sleep
    ORDER BY completed_sleep.started_at DESC, completed_sleep.id DESC
    LIMIT 1
  ),
  last_ended_sleep AS (
    SELECT completed_sleep.ended_at
    FROM completed_sleep
    ORDER BY completed_sleep.ended_at DESC, completed_sleep.id DESC
    LIMIT 1
  ),
  sleep_summary AS (
    SELECT COALESCE(
      pg_catalog.sum(
        pg_catalog.floor(COALESCE(completed_sleep.duration_seconds, 0) / 60.0)
      ),
      0
    )::integer AS today_minutes
    FROM config
    LEFT JOIN completed_sleep
      ON completed_sleep.started_at >= config.local_day_start
      AND completed_sleep.started_at < config.local_day_end
  ),
  morning_window AS (
    SELECT
      config.*,
      (
        pg_catalog.date_trunc(
          'day',
          config.server_as_of AT TIME ZONE config.timezone_name
        ) + pg_catalog.make_interval(hours => config.day_start_hour)
      ) AT TIME ZONE config.timezone_name AS morning_day_start
    FROM config
  ),
  overnight_sleep AS (
    SELECT
      completed_sleep.id,
      completed_sleep.ended_at
    FROM completed_sleep
    CROSS JOIN morning_window
    WHERE completed_sleep.started_at
        < morning_window.morning_day_start - INTERVAL '183 minutes'
      AND completed_sleep.ended_at
        >= morning_window.morning_day_start - INTERVAL '183 minutes'
      AND completed_sleep.ended_at <= morning_window.server_as_of
    ORDER BY completed_sleep.ended_at DESC, completed_sleep.id DESC
    LIMIT 1
  ),
  early_morning_candidates AS (
    SELECT
      sleep.id,
      sleep.started_at,
      sleep.ended_at,
      sleep.morning_classification,
      sleep.morning_classification_version,
      pg_catalog.row_number() OVER (
        ORDER BY sleep.started_at, sleep.id
      )::integer AS sequence
    FROM visible_sleep AS sleep
    CROSS JOIN morning_window
    LEFT JOIN overnight_sleep ON true
    WHERE sleep.id IS DISTINCT FROM overnight_sleep.id
      AND sleep.started_at >= COALESCE(
        overnight_sleep.ended_at,
        morning_window.morning_day_start - INTERVAL '183 minutes'
      )
      AND sleep.started_at < morning_window.morning_day_start
      AND sleep.started_at <= morning_window.server_as_of
      AND (sleep.ended_at IS NULL OR sleep.ended_at <= morning_window.server_as_of)
  ),
  morning_resolution AS (
    SELECT
      0::integer AS sequence,
      ARRAY[]::uuid[] AS continuation_ids,
      overnight_sleep.ended_at AS morning_wake_time,
      overnight_sleep.ended_at AS last_relevant_end,
      false AS first_nap_settled
    FROM (SELECT true) AS seed
    LEFT JOIN overnight_sleep ON true

    UNION ALL

    SELECT
      candidate.sequence,
      CASE WHEN decision.is_continuation
        THEN pg_catalog.array_append(resolution.continuation_ids, candidate.id)
        ELSE resolution.continuation_ids
      END,
      CASE WHEN decision.is_continuation AND candidate.ended_at IS NOT NULL
        THEN candidate.ended_at
        ELSE resolution.morning_wake_time
      END,
      CASE
        WHEN resolution.first_nap_settled
          OR candidate.morning_classification = 'confirmed_first_nap'
          OR decision.is_ignored_legacy
        THEN resolution.last_relevant_end
        ELSE COALESCE(candidate.ended_at, resolution.last_relevant_end)
      END,
      resolution.first_nap_settled
        OR candidate.morning_classification = 'confirmed_first_nap'
    FROM morning_resolution AS resolution
    JOIN early_morning_candidates AS candidate
      ON candidate.sequence = resolution.sequence + 1
    CROSS JOIN morning_window
    LEFT JOIN overnight_sleep ON true
    CROSS JOIN LATERAL (
      SELECT
        candidate.morning_classification_version IS NULL
          AND pg_catalog.cardinality(resolution.continuation_ids) > 0
          AS is_ignored_legacy,
        NOT resolution.first_nap_settled
        AND candidate.morning_classification IS DISTINCT FROM 'confirmed_first_nap'
        AND NOT (
          candidate.morning_classification_version IS NULL
          AND pg_catalog.cardinality(resolution.continuation_ids) > 0
        )
        AND (
          candidate.morning_classification = 'confirmed_night_continuation'
          OR (
            overnight_sleep.id IS NULL
            AND pg_catalog.cardinality(resolution.continuation_ids) = 0
          )
          OR (
            candidate.morning_classification = 'automatic'
            AND (
              resolution.last_relevant_end IS NULL
              OR candidate.started_at - resolution.last_relevant_end
                <= pg_catalog.make_interval(
                  mins => morning_window.nap_continuation_minutes
                )
            )
          )
          OR (
            candidate.morning_classification IS NULL
            AND (
              candidate.morning_classification_version IS NULL
              OR resolution.last_relevant_end IS NULL
              OR candidate.started_at - resolution.last_relevant_end
                <= pg_catalog.make_interval(
                  mins => morning_window.nap_continuation_minutes
                )
            )
          )
        ) AS is_continuation
    ) AS decision
  ),
  morning_result AS (
    SELECT
      morning_resolution.morning_wake_time,
      morning_resolution.continuation_ids
    FROM morning_resolution
    ORDER BY morning_resolution.sequence DESC
    LIMIT 1
  ),
  nap_candidates AS (
    SELECT
      completed_sleep.id,
      completed_sleep.started_at,
      completed_sleep.ended_at
    FROM completed_sleep
    CROSS JOIN config
    CROSS JOIN morning_result
    WHERE morning_result.morning_wake_time IS NOT NULL
      AND completed_sleep.started_at > morning_result.morning_wake_time
      AND completed_sleep.started_at < config.current_day_end
      AND completed_sleep.ended_at <= config.server_as_of
      AND NOT (completed_sleep.id = ANY(morning_result.continuation_ids))
  ),
  nap_candidates_ordered AS (
    SELECT
      nap_candidates.*,
      pg_catalog.max(nap_candidates.ended_at) OVER (
        ORDER BY nap_candidates.started_at, nap_candidates.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS previous_max_end
    FROM nap_candidates
  ),
  nap_groups AS (
    SELECT
      nap_candidates_ordered.*,
      pg_catalog.sum(
        CASE
          WHEN nap_candidates_ordered.previous_max_end IS NULL
            OR nap_candidates_ordered.started_at - nap_candidates_ordered.previous_max_end
              > pg_catalog.make_interval(mins => config.nap_continuation_minutes)
          THEN 1
          ELSE 0
        END
      ) OVER (
        ORDER BY nap_candidates_ordered.started_at, nap_candidates_ordered.id
      ) AS group_number
    FROM nap_candidates_ordered
    CROSS JOIN config
  ),
  nap_islands AS (
    SELECT
      pg_catalog.min(nap_groups.started_at) AS started_at,
      pg_catalog.max(nap_groups.ended_at) AS ended_at
    FROM nap_groups
    GROUP BY nap_groups.group_number
  ),
  nap_summary AS (
    SELECT pg_catalog.count(*)::integer AS nap_count
    FROM nap_islands
    WHERE nap_islands.ended_at - nap_islands.started_at >= INTERVAL '15 minutes'
  ),
  morning_summary AS (
    SELECT (
      EXISTS (
        SELECT 1
        FROM early_morning_candidates AS candidate
        WHERE candidate.morning_classification = 'unresolved'
          AND NOT (candidate.id = ANY(morning_result.continuation_ids))
      )
      OR EXISTS (
        SELECT 1
        FROM timer_rows AS timer
        WHERE timer.activity_type = 'sleep'
          AND timer.timer_data->>'morningClassification' = 'unresolved'
      )
    ) AS confirmation_pending
    FROM morning_result
  ),
  wake_slot AS (
    SELECT CASE
      WHEN config.wake_enabled
        AND config.wake_source = 'custom'
        AND pg_catalog.jsonb_array_length(config.wake_window_slots) > 0
        AND EXTRACT(
          HOUR FROM config.server_as_of AT TIME ZONE config.timezone_name
        ) >= config.day_start_hour
        AND EXTRACT(
          HOUR FROM config.server_as_of AT TIME ZONE config.timezone_name
        ) < config.day_end_hour
      THEN config.wake_window_slots -> LEAST(
        nap_summary.nap_count,
        pg_catalog.jsonb_array_length(config.wake_window_slots) - 1
      )
      ELSE NULL
    END AS value
    FROM config
    CROSS JOIN nap_summary
  ),
  latest_diaper AS (
    SELECT
      diaper.id,
      diaper.type,
      diaper.changed_at
    FROM public.diapers AS diaper
    JOIN config ON config.id = diaper.baby_id
    WHERE diaper.deleted = false
    ORDER BY diaper.changed_at DESC, diaper.id DESC
    LIMIT 1
  ),
  diaper_summary AS (
    SELECT
      pg_catalog.count(*) FILTER (WHERE diaper.type = 'wet')::integer AS wet,
      pg_catalog.count(*) FILTER (WHERE diaper.type = 'dirty')::integer AS dirty,
      pg_catalog.count(*) FILTER (WHERE diaper.type = 'mixed')::integer AS mixed,
      pg_catalog.count(*) FILTER (WHERE diaper.type = 'dry')::integer AS dry
    FROM config
    LEFT JOIN public.diapers AS diaper
      ON diaper.baby_id = config.id
      AND diaper.deleted = false
      AND diaper.changed_at >= config.local_day_start
      AND diaper.changed_at < config.local_day_end
  ),
  latest_pumping AS (
    SELECT pumping.*
    FROM visible_pumping AS pumping
    ORDER BY pumping.started_at DESC, pumping.id DESC
    LIMIT 1
  ),
  pumping_summary AS (
    SELECT
      COALESCE(pg_catalog.sum(pumping.amount_ml), 0) AS today_volume_ml,
      pg_catalog.count(pumping.id)::integer AS session_count
    FROM config
    LEFT JOIN visible_pumping AS pumping
      ON pumping.started_at >= config.local_day_start
      AND pumping.started_at < config.local_day_end
  ),
  latest_growth AS (
    SELECT
      growth.id,
      growth.measured_at,
      growth.weight_kg,
      growth.height_cm,
      growth.head_cm
    FROM public.growth_measurements AS growth
    JOIN config ON config.id = growth.baby_id
    WHERE growth.deleted = false
    ORDER BY growth.measured_at DESC, growth.id DESC
    LIMIT 1
  ),
  latest_tummy_time AS (
    SELECT tummy.*
    FROM visible_tummy_time AS tummy
    ORDER BY tummy.started_at DESC, tummy.id DESC
    LIMIT 1
  ),
  tummy_time_summary AS (
    SELECT COALESCE(
      pg_catalog.sum(pg_catalog.floor(COALESCE(tummy.duration_seconds, 0) / 60.0)),
      0
    )::integer AS today_minutes
    FROM config
    LEFT JOIN visible_tummy_time AS tummy
      ON tummy.started_at >= config.local_day_start
      AND tummy.started_at < config.local_day_end
  )
  SELECT pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'serverAsOf', pg_catalog.to_char(
      config.server_as_of AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'timezone', config.timezone_name,
    'localDay', pg_catalog.jsonb_build_object(
      'startedAt', pg_catalog.to_char(
        config.local_day_start AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'endsAt', pg_catalog.to_char(
        config.local_day_end AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    ),
    'babyId', config.id,
    'babyName', config.name,
    'activities', pg_catalog.jsonb_build_object(
      'feeding', pg_catalog.jsonb_build_object(
        'lastTime', CASE WHEN latest_feeding.id IS NULL THEN NULL ELSE pg_catalog.to_char(
          latest_feeding.started_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) END,
        'todayCount', feeding_summary.today_count,
        'lastType', latest_feeding.type,
        'lastSide', latest_feeding.side
      ),
      'sleep', pg_catalog.jsonb_build_object(
        'lastTime', CASE WHEN latest_sleep.id IS NULL THEN NULL ELSE pg_catalog.to_char(
          COALESCE(latest_sleep.ended_at, latest_sleep.started_at) AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) END,
        'todayMinutes', sleep_summary.today_minutes,
        'goalMinutes', config.sleep_goal_minutes,
        'lastDurationMinutes', CASE WHEN latest_sleep.id IS NULL THEN NULL ELSE
          pg_catalog.floor(COALESCE(latest_sleep.duration_seconds, 0) / 60.0)::integer
        END,
        'isActive', EXISTS (
          SELECT 1 FROM timer_rows AS timer WHERE timer.activity_type = 'sleep'
        ),
        'sleepType', latest_sleep.type,
        'wakeWindowMinutes', (wake_slot.value->>'durationMinutes')::integer,
        'wakeWindowSlotLabel', wake_slot.value->>'label',
        'wakeWindowRequiresNewbornOptIn', config.birth_date IS NOT NULL
          AND (
            config.server_as_of AT TIME ZONE config.timezone_name
          )::date - config.birth_date < 61,
        'lastSleepEndedAt', CASE WHEN last_ended_sleep.ended_at IS NULL THEN NULL ELSE
          pg_catalog.to_char(
            last_ended_sleep.ended_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        END,
        'napCountToday', nap_summary.nap_count,
        'morningConfirmationPending', COALESCE(morning_summary.confirmation_pending, false)
      ),
      'diaper', pg_catalog.jsonb_build_object(
        'lastTime', CASE WHEN latest_diaper.id IS NULL THEN NULL ELSE pg_catalog.to_char(
          latest_diaper.changed_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) END,
        'todayCounts', pg_catalog.jsonb_build_object(
          'wet', diaper_summary.wet,
          'dirty', diaper_summary.dirty,
          'mixed', diaper_summary.mixed,
          'dry', diaper_summary.dry
        ),
        'lastType', latest_diaper.type
      ),
      'pumping', pg_catalog.jsonb_build_object(
        'lastTime', CASE WHEN latest_pumping.id IS NULL THEN NULL ELSE pg_catalog.to_char(
          latest_pumping.started_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) END,
        'todayVolumeMl', pumping_summary.today_volume_ml,
        'sessionCount', pumping_summary.session_count,
        'lastSide', latest_pumping.side
      ),
      'growth', pg_catalog.jsonb_build_object(
        'lastMeasurement', CASE WHEN latest_growth.id IS NULL THEN NULL ELSE
          pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'date', pg_catalog.to_char(
              latest_growth.measured_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'weightKg', latest_growth.weight_kg,
            'heightCm', latest_growth.height_cm,
            'headCircumferenceCm', latest_growth.head_cm
          ))
        END
      ),
      'tummyTime', pg_catalog.jsonb_build_object(
        'lastTime', CASE WHEN latest_tummy_time.id IS NULL THEN NULL ELSE pg_catalog.to_char(
          latest_tummy_time.started_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) END,
        'todayMinutes', tummy_time_summary.today_minutes,
        'goalMinutes', pg_catalog.floor(config.tummy_goal_seconds / 60.0)::integer,
        'lastDurationMinutes', CASE WHEN latest_tummy_time.id IS NULL THEN NULL ELSE
          pg_catalog.floor(COALESCE(latest_tummy_time.duration_seconds, 0) / 60.0)::integer
        END
      )
    ),
    'activeTimer', active_timer_summary.timers->0,
    'activeTimers', active_timer_summary.timers,
    'updatedAt', pg_catalog.to_char(
      config.server_as_of AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  )
  FROM config
  CROSS JOIN feeding_summary
  CROSS JOIN active_timer_summary
  CROSS JOIN sleep_summary
  CROSS JOIN nap_summary
  CROSS JOIN morning_summary
  CROSS JOIN wake_slot
  CROSS JOIN diaper_summary
  CROSS JOIN pumping_summary
  CROSS JOIN tummy_time_summary
  LEFT JOIN latest_feeding ON true
  LEFT JOIN latest_sleep ON true
  LEFT JOIN last_ended_sleep ON true
  LEFT JOIN latest_diaper ON true
  LEFT JOIN latest_pumping ON true
  LEFT JOIN latest_growth ON true
  LEFT JOIN latest_tummy_time ON true
$$;

REVOKE ALL ON FUNCTION public.get_baby_activity_snapshot(uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_baby_activity_snapshot(uuid, text)
TO authenticated;

-- SECURITY INVOKER requires caller read privileges. Keep these column-scoped so the RPC does not
-- reopen notes or other raw-history fields; existing household RLS remains authoritative.
GRANT SELECT (id, household_id, display_name)
ON TABLE public.users TO authenticated;
GRANT SELECT (id, household_id, name, birth_date, deleted)
ON TABLE public.babies TO authenticated;
GRANT SELECT (
  baby_id, enabled, source, wake_window_slots, day_start_hour, day_end_hour,
  nap_continuation_minutes
)
ON TABLE public.wake_window_preferences TO authenticated;
GRANT SELECT (baby_id, goal_type, target_value)
ON TABLE public.activity_goals TO authenticated;
GRANT SELECT (id, baby_id, logged_by, type, side, started_at, ended_at, deleted)
ON TABLE public.feedings TO authenticated;
GRANT SELECT (
  id, baby_id, logged_by, type, started_at, ended_at, duration_seconds,
  morning_classification, morning_classification_version, deleted
)
ON TABLE public.sleep_sessions TO authenticated;
GRANT SELECT (id, baby_id, type, changed_at, deleted)
ON TABLE public.diapers TO authenticated;
GRANT SELECT (id, baby_id, logged_by, started_at, amount_ml, side, deleted)
ON TABLE public.pumping_sessions TO authenticated;
GRANT SELECT (id, baby_id, measured_at, weight_kg, height_cm, head_cm, deleted)
ON TABLE public.growth_measurements TO authenticated;
GRANT SELECT (id, baby_id, logged_by, started_at, duration_seconds, deleted)
ON TABLE public.tummy_time_sessions TO authenticated;

COMMENT ON FUNCTION public.get_baby_activity_snapshot(uuid, text) IS
'Returns one versioned, coherent native activity summary for an authenticated household member and selected active baby.';
