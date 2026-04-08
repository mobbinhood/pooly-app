-- Fix RLS policies for customers table
-- First, check existing policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'customers';
