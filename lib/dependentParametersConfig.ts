/**
 * Configuration for nodes with dependent parameters that should appear in the Run tab
 * These parameters are automatically included in the Run tab when their parent nodes are present
 */

export interface DependentParameterConfig {
  nodeMasterId: string;
  parentParamKey: string;
  parentParamLabel: string;
  parentApiLoaderKey?: string; // Optional: API loader key for parent parameter (e.g., "slackChannels")
  dependentParams: Array<{
    paramKey: string;
    paramLabel: string;
    dependsOnValue?: string; // Optional: specific value that triggers this dependent param
    apiLoaderKey?: string; // Optional: key for API loader (e.g., "vercelProjects", "slackChannels")
  }>;
}

/**
 * Node IDs for nodes with dependent parameters
 * These constants should be used instead of hardcoded strings throughout the codebase
 */
export const DEPENDENT_PARAMETER_NODE_IDS = {
  SLACK_CHANNEL: "679b7f2181cd66532977854d",
  VERCEL_PROJECT: "6971bdd7483111f3ea679b7d",
  VERCEL_DEPLOYMENT: "68130e3782ccb2f73aa51fda", // Vercel Deployment node
  ZOHO_SEARCH_RECORDS: "68f880c284f68ca73f8fbcff", // Search Records in Zoho CRM
  INSTANTLY_WEBHOOK: "69733610c21593560e9a8bdd", // Instantly Webhook
  HUBSPOT_CONTACT_OWNER_1: "68408596f3f69b4977a1771b", // HubSpot Contact Owner node (Create Contact)
  HUBSPOT_CONTACT_OWNER_2: "68408551f3f69b4977a1771a", // HubSpot Contact Owner node (Update Contact)
  HUBSPOT_ENGAGEMENT_MEETING_CREATE: "6847f24b5696a48bd05a8f51", // HubSpot Create Engagement (Meeting)
  HUBSPOT_ENGAGEMENT_MEETING_UPDATE: "6847f29e5696a48bd05a8f52", // HubSpot Update Engagement (Meeting)
  HUBSPOT_ENGAGEMENT_CALL_CREATE: "684988ed87075c9ff836f6d6", // HubSpot Create Engagement (Call)
  HUBSPOT_ENGAGEMENT_CALL_UPDATE: "6849886987075c9ff836f6d4", // HubSpot Update Engagement (Call)
  HUBSPOT_LISTS: "6894472243cc40fc751ae43f", // HubSpot Lists node
} as const;

/**
 * Token format configuration
 * Variables in Run tab use ${parametername-nodename} format
 */
export const TOKEN_FORMAT = {
  SEPARATOR: "-", // Separator between parameter name and node variable name
  PATTERN: /^\$\{([^}]+)\}$/, // Pattern to match ${variable} tokens
} as const;

/**
 * Configuration mapping for dependent parameters
 */
export const DEPENDENT_PARAMETERS_CONFIG: DependentParameterConfig[] = [
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.SLACK_CHANNEL,
    parentParamKey: "channel",
    parentParamLabel: "Channel",
    parentApiLoaderKey: "slackChannels",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.VERCEL_PROJECT,
    parentParamKey: "project",
    parentParamLabel: "Select Project",
    dependentParams: [
      { paramKey: "name", paramLabel: "Name", dependsOnValue: "Create New Project" },
      { paramKey: "name", paramLabel: "Name", dependsOnValue: "Existing Project", apiLoaderKey: "vercelProjects" },
    ],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.VERCEL_DEPLOYMENT,
    parentParamKey: "project",
    parentParamLabel: "Select Project",
    dependentParams: [
      { paramKey: "name", paramLabel: "Name", dependsOnValue: "Create New Project" },
      { paramKey: "name", paramLabel: "Name", dependsOnValue: "Existing Project", apiLoaderKey: "vercelProjects" },
    ],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.ZOHO_SEARCH_RECORDS,
    parentParamKey: "moduleName",
    parentParamLabel: "Module Name",
    dependentParams: [
      { paramKey: "filters", paramLabel: "Filters", apiLoaderKey: "zohoFields" },
    ],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.INSTANTLY_WEBHOOK,
    parentParamKey: "campaign",
    parentParamLabel: "Campaign",
    parentApiLoaderKey: "instantlyCampaigns",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.HUBSPOT_CONTACT_OWNER_1,
    parentParamKey: "contactOwner",
    parentParamLabel: "Contact Owner",
    parentApiLoaderKey: "hubspotOwners",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.HUBSPOT_CONTACT_OWNER_2,
    parentParamKey: "contactOwner",
    parentParamLabel: "Contact Owner",
    parentApiLoaderKey: "hubspotOwners",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.HUBSPOT_LISTS,
    parentParamKey: "lists",
    parentParamLabel: "Lists",
    parentApiLoaderKey: "hubspotLists",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.HUBSPOT_ENGAGEMENT_MEETING_CREATE,
    parentParamKey: "contactOwner",
    parentParamLabel: "Contact Owner",
    parentApiLoaderKey: "hubspotOwners",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.HUBSPOT_ENGAGEMENT_MEETING_UPDATE,
    parentParamKey: "contactOwner",
    parentParamLabel: "Contact Owner",
    parentApiLoaderKey: "hubspotOwners",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.HUBSPOT_ENGAGEMENT_CALL_CREATE,
    parentParamKey: "contactOwner",
    parentParamLabel: "Contact Owner",
    parentApiLoaderKey: "hubspotOwners",
    dependentParams: [],
  },
  {
    nodeMasterId: DEPENDENT_PARAMETER_NODE_IDS.HUBSPOT_ENGAGEMENT_CALL_UPDATE,
    parentParamKey: "contactOwner",
    parentParamLabel: "Contact Owner",
    parentApiLoaderKey: "hubspotOwners",
    dependentParams: [],
  },
];

/**
 * Check if a node ID matches any of the dependent parameter node IDs
 */
export const isDependentParameterNode = (nodeMasterId: string): boolean => {
  return Object.values(DEPENDENT_PARAMETER_NODE_IDS).includes(
    nodeMasterId as (typeof DEPENDENT_PARAMETER_NODE_IDS)[keyof typeof DEPENDENT_PARAMETER_NODE_IDS]
  );
};

/**
 * Get dependent parameter configuration for a specific node
 */
export const getDependentParameterConfig = (
  nodeMasterId: string
): DependentParameterConfig | undefined => {
  return DEPENDENT_PARAMETERS_CONFIG.find(
    (config) => config.nodeMasterId === nodeMasterId
  );
};
