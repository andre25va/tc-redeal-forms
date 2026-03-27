-- Setup Supabase Storage buckets for ReDeal Forms
-- Run this in the Supabase SQL editor

-- Create storage bucket for PDF templates
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-templates',
  'form-templates',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for submitted PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-pdfs',
  'form-pdfs',
  true,
  20971520, -- 20MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for form-templates bucket (service role only)
CREATE POLICY "Service role can manage form templates"
ON storage.objects FOR ALL
USING (bucket_id = 'form-templates' AND auth.role() = 'service_role');

-- RLS Policies for form-pdfs bucket
-- Allow service role to upload
CREATE POLICY "Service role can upload form PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'form-pdfs' AND auth.role() = 'service_role');

-- Allow public to read (since bucket is public)
CREATE POLICY "Public can read form PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-pdfs');

-- Allow service role to delete
CREATE POLICY "Service role can delete form PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'form-pdfs' AND auth.role() = 'service_role');
