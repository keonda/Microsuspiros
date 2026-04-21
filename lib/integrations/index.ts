import { analyticsIntegrationStatus } from "@/lib/integrations/analytics";
import type { IntegrationStatus } from "@/lib/integrations/types";
import { websiteIntegrationStatus } from "@/lib/integrations/website";
import { youtubeIntegrationStatus } from "@/lib/integrations/youtube";

export function integrationStatuses(): IntegrationStatus[] {
  return [youtubeIntegrationStatus(), websiteIntegrationStatus(), analyticsIntegrationStatus()];
}
