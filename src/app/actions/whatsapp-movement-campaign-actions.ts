'use server';

import {
  previewMovementCampaign,
  createMovementCampaign,
  getMovementCampaign,
  changeMovementCampaign,
  deliverMovementFromOperator,
} from '@/lib/wa-movement-campaign';

export async function previewWhatsAppMovementCampaignAction() {
  return previewMovementCampaign();
}

export async function startWhatsAppMovementCampaignAction(attestConsent: boolean) {
  return createMovementCampaign(attestConsent);
}

export async function getWhatsAppMovementCampaignAction() {
  return getMovementCampaign();
}

export async function changeWhatsAppMovementCampaignAction(
  campaignId: string, action: 'pause'|'resume'|'cancel'
) {
  return changeMovementCampaign(campaignId, action);
}

/** One claimed delivery per request; the UI paces repeated invocations.
 * The owner must remain signed in and keep the terminal open. */
export async function advanceWhatsAppMovementCampaignAction(campaignId: string) {
  return deliverMovementFromOperator(campaignId);
}
