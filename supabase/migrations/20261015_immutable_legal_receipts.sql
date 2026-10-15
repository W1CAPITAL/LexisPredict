-- An electronic acceptance receipt is immutable after creation.
CREATE OR REPLACE FUNCTION public.lexis_legal_receipt_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 RAISE EXCEPTION 'Electronic acceptance receipt is immutable; create a new terms version';
END
$$;
DROP TRIGGER IF EXISTS lexis_legal_no_mutation ON public.lexis_user_legal_acceptances;
CREATE TRIGGER lexis_legal_no_mutation
 BEFORE UPDATE OR DELETE ON public.lexis_user_legal_acceptances
 FOR EACH ROW EXECUTE FUNCTION public.lexis_legal_receipt_immutable();
