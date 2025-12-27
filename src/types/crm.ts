import type { CustomerLoyalty } from './pos';

// CRM Types for Customer Management System

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: CustomerAddress;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  company?: string;
  jobTitle?: string;
  tags: string[];
  notes?: string;
  source: 'walk_in' | 'referral' | 'website' | 'social_media' | 'email' | 'phone' | 'other';
  status: 'active' | 'inactive' | 'prospect' | 'lost';
  totalSpent: number;
  totalPurchases: number;
  averageOrderValue: number;
  purchaseCount: number;
  visitCount: number;
  lastPurchaseDate?: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt: string;
  loyaltyInfo?: CustomerLoyalty;
  communicationHistory?: Communication[];
  segments?: string[];
  customFields?: Record<string, any>;
}

export interface CustomerAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Communication {
  id: string;
  customerId: string;
  type: 'email' | 'sms' | 'phone' | 'in_person' | 'social_media' | 'other';
  direction: 'inbound' | 'outbound';
  subject?: string;
  content: string;
  status: 'draft' | 'sent' | 'delivered' | 'failed' | 'opened' | 'replied';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  repliedAt?: string;
  employee: {
    id: string;
    name: string;
    email: string;
  };
  attachments?: CommunicationAttachment[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  color: string;
  criteria: SegmentCriteria;
  isDynamic: boolean;
  customerIds: string[];
  customerCount: number;
  lastCalculated?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SegmentCriteria {
  totalSpent?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    value: number;
  };
  purchaseCount?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    value: number;
  };
  averageOrderValue?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    value: number;
  };
  daysSinceLastPurchase?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    value: number;
  };
  daysSinceJoin?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    value: number;
  };
  tags?: {
    operator: 'includes' | 'excludes' | 'equals';
    values: string[];
  };
  source?: {
    operator: 'includes' | 'excludes' | 'equals';
    values: Customer['source'][];
  };
  status?: {
    operator: 'includes' | 'excludes' | 'equals';
    values: Customer['status'][];
  };
  customField?: {
    field: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'includes' | 'excludes' | 'equals';
    value: any;
  };
}

export interface MarketingCampaign {
  id: string;
  name: string;
  description: string;
  type: 'email' | 'sms' | 'push' | 'social' | 'multi';
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled' | 'active';
  targetSegments: string[];
  targetCustomers: string[];
  content: CampaignContent;
  schedule: CampaignSchedule;
  performance: CampaignPerformance;
  budget?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignContent {
  subject?: string;
  body: string;
  template?: string;
  attachments?: CommunicationAttachment[];
  variables?: Record<string, string>;
}

export interface CampaignSchedule {
  sendAt?: string;
  timezone: string;
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  endDate?: string;
  bestTimeToSend?: boolean;
}

export interface CampaignPerformance {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  converted: number;
  revenue: number;
  cost: number;
  roi: number;
}

export interface CustomerActivity {
  id: string;
  customerId: string;
  type: 'purchase' | 'website_visit' | 'email_open' | 'email_click' | 'sms_reply' | 'phone_call' | 'social_interaction' | 'form_submit' | 'other';
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  content: string;
  type: 'general' | 'call' | 'meeting' | 'issue' | 'complaint' | 'compliment' | 'follow_up';
  priority: 'low' | 'medium' | 'high';
  employee: {
    id: string;
    name: string;
  };
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTask {
  id: string;
  customerId: string;
  title: string;
  description: string;
  type: 'call' | 'email' | 'meeting' | 'follow_up' | 'task' | 'reminder';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string;
  completedAt?: string;
  assignedTo: {
    id: string;
    name: string;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  customerCount: number;
  createdAt: string;
}

export interface CRMSettings {
  defaultCommunicationTemplates: Record<string, CommunicationTemplate>;
  automatedWorkflows: AutomatedWorkflow[];
  integrations: CRMIntegration[];
  privacySettings: PrivacySettings;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: Communication['type'];
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface AutomatedWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  isActive: boolean;
  createdAt: string;
}

export interface WorkflowTrigger {
  type: 'customer_join' | 'purchase' | 'birthday' | 'inactivity' | 'segment_change' | 'custom';
  conditions: Record<string, any>;
}

export interface WorkflowAction {
  type: 'send_email' | 'send_sms' | 'add_tag' | 'remove_tag' | 'assign_task' | 'delay' | 'custom';
  parameters: Record<string, any>;
  delay?: number; // in minutes
}

export interface CRMIntegration {
  id: string;
  type: 'email_provider' | 'sms_provider' | 'social_media' | 'analytics' | 'ecommerce' | 'custom';
  name: string;
  config: Record<string, any>;
  isActive: boolean;
  lastSync?: string;
}

export interface PrivacySettings {
  dataRetentionDays: number;
  anonymizeInactiveCustomers: boolean;
  gdprCompliant: boolean;
  marketingConsentRequired: boolean;
  dataExportEnabled: boolean;
  dataDeletionEnabled: boolean;
}

export interface CRMAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  customerRetentionRate: number;
  averageCustomerLifetimeValue: number;
  topCustomers: Customer[];
  segmentGrowth: SegmentGrowth[];
  communicationMetrics: CommunicationMetrics;
  campaignMetrics: CampaignMetrics;
}

export interface SegmentGrowth {
  segmentId: string;
  segmentName: string;
  currentCount: number;
  previousCount: number;
  growthRate: number;
}

export interface CommunicationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalReplied: number;
  averageResponseTime: number; // in hours
  mostEffectiveChannel: Communication['type'];
}

export interface CampaignMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  averageOpenRate: number;
  averageClickRate: number;
  averageConversionRate: number;
  totalRevenue: number;
  averageROI: number;
}

// Re-export from pos.ts for compatibility
export type { CustomerLoyalty } from './pos';
