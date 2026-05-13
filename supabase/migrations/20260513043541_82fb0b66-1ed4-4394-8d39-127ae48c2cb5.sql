-- Allow sitters to delete manual client profiles they created
CREATE POLICY "Sitters delete manual client profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'sitter'::app_role)
  AND created_by_sitter_id = auth.uid()
  AND is_manual = true
);

-- Allow admins to delete any profile
CREATE POLICY "Admins delete any profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);