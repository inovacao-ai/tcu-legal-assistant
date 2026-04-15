-- Allow moderators to view all profiles
CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to view all roles
CREATE POLICY "Moderators can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));