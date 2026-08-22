import { apiClient } from './client.js';

/**
 * People identified from a deal's scanned IDs.
 *
 * <p>Produced by Textract extraction, never entered by hand — a beneficial owner with no source
 * document has no evidence behind it, so there is no create endpoint to call.
 */
export async function listDealBeneficialOwners(dealId) {
  const { data } = await apiClient.get(`/deals/${dealId}/beneficial-owners`);
  return data;
}
