#!/bin/bash
set -e

echo "Starting local Supabase..."
supabase start

echo "Applying migrations..."
supabase db push

echo "Local Supabase ready!"
echo "API URL: http://localhost:54321"
echo "Studio: http://localhost:54323"

supabase status
