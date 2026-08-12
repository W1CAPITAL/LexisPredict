/** Reexport NER + política de verdade para cadastro/scripts */
export { extractLegalEntities, extractCnjList, type LegalNerResult, type LegalEntity } from './legal-ner';
export { TRUTH_POLICY, stripInventedPlaceholders, assertObservedFact } from './truth-policy';
