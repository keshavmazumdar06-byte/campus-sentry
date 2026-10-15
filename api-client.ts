/**
 * CampusSentry AI - Service Architecture & Backend Integration Contract
 *
 * This module defines the formal contract interfaces that the future backend team
 * will implement for REST / WebSocket / SSE endpoints.
 * Currently, it interfaces directly with the client-side Zustand store for demo mode.
 */

import {
  VisitorRequest,
  VisitorRecord,
  KnownIdentityRecord,
  StaffNotification,
  StaffUser,
  SecurityAlert,
  EntryExitLog,
  AIRecognitionEvent,
  SystemSettingsConfig,
  IdentityClassification,
  RequestStatus,
  VisitorCategory,
  VisitMode,
} from '@/types';
import { useDemoStore, SimulateRequestInput } from '@/store/demo-store';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RequestFilterParams {
  query?: string;
  status?: RequestStatus | 'all';
  category?: VisitorCategory | 'all';
  classification?: IdentityClassification | 'all';
  personToMeet?: string | 'all';
  date?: string;
}

export interface NotificationFilterParams {
  query?: string;
  isRead?: boolean;
  priority?: string;
  category?: string;
}

/**
 * Service contract interface for Visitor Requests
 */
export interface IVisitorRequestService {
  getRequests(params?: RequestFilterParams): Promise<VisitorRequest[]>;
  getRequestById(id: string): Promise<VisitorRequest | null>;
  approveRequest(requestId: string, adminNotes?: string): Promise<void>;
  rejectRequest(requestId: string, rejectionReason: string, adminNotes?: string): Promise<void>;
  requestMoreInfo(requestId: string, notes: string): Promise<void>;
  markPending(requestId: string, notes?: string): Promise<void>;
  simulateIncomingStaffRequest(input: SimulateRequestInput): Promise<string>;
}

/**
 * Service contract interface for Visitor Records
 */
export interface IVisitorRecordService {
  getRecords(params?: { query?: string; category?: string; classification?: string }): Promise<VisitorRecord[]>;
  getRecordById(id: string): Promise<VisitorRecord | null>;
  createRecord(record: Omit<VisitorRecord, 'visitorId' | 'registeredAt' | 'isArchived'>): Promise<void>;
  updateRecord(visitorId: string, updates: Partial<VisitorRecord>): Promise<void>;
  archiveRecord(visitorId: string): Promise<void>;
  recordCheckIn(visitorId: string, gate: string, staffName: string): Promise<void>;
  recordCheckOut(visitorId: string, gate: string, staffName: string): Promise<void>;
}

/**
 * Service contract interface for Known Identity Registry
 */
export interface IIdentityRegistryService {
  getIdentities(params?: { query?: string; classification?: string }): Promise<KnownIdentityRecord[]>;
  getIdentityById(id: string): Promise<KnownIdentityRecord | null>;
  addIdentity(name: string, category: VisitorCategory, department?: string, notes?: string): Promise<void>;
  editIdentity(id: string, updates: Partial<KnownIdentityRecord>): Promise<void>;
  updateClassification(id: string, newClassification: IdentityClassification, reason: string): Promise<void>;
  archiveIdentity(id: string): Promise<void>;
}

/**
 * Service contract interface for Staff Notifications
 */
export interface INotificationService {
  getNotifications(params?: NotificationFilterParams): Promise<StaffNotification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  archiveNotification(id: string): Promise<void>;
}

/**
 * Service contract interface for Staff & Security
 */
export interface ISecurityMonitoringService {
  getAlerts(): Promise<SecurityAlert[]>;
  updateAlertStatus(id: string, status: SecurityAlert['status'], resolutionNotes?: string): Promise<void>;
  getEntryExitLogs(): Promise<EntryExitLog[]>;
  getRecognitionEvents(): Promise<AIRecognitionEvent[]>;
  reviewRecognitionEvent(id: string, classification: IdentityClassification, notes?: string): Promise<void>;
}

/**
 * Unified API Client Adapter (Demo implementation backed by Zustand store)
 * When migrating to production, swap these methods to perform authenticated fetch() calls
 * to the API gateway (e.g. `NEXT_PUBLIC_API_GATEWAY_URL`).
 */
export const apiClient = {
  requests: {
    getRequests: async (): Promise<VisitorRequest[]> => {
      return useDemoStore.getState().visitorRequests;
    },
    getRequestById: async (id: string): Promise<VisitorRequest | null> => {
      return useDemoStore.getState().visitorRequests.find((r) => r.requestId === id) || null;
    },
    approveRequest: async (requestId: string, adminNotes?: string): Promise<void> => {
      useDemoStore.getState().approveRequest(requestId, adminNotes);
    },
    rejectRequest: async (requestId: string, rejectionReason: string, adminNotes?: string): Promise<void> => {
      useDemoStore.getState().rejectRequest(requestId, rejectionReason, adminNotes);
    },
    requestMoreInfo: async (requestId: string, notes: string): Promise<void> => {
      useDemoStore.getState().requestMoreInfo(requestId, notes);
    },
    markPending: async (requestId: string, notes?: string): Promise<void> => {
      useDemoStore.getState().markRequestPending(requestId, notes);
    },
    simulateIncomingStaffRequest: async (input: SimulateRequestInput): Promise<string> => {
      return useDemoStore.getState().simulateIncomingStaffRequest(input);
    },
  },
  records: {
    getRecords: async (params?: { query?: string; category?: string; classification?: string }): Promise<VisitorRecord[]> => {
      return useDemoStore.getState().visitorRecords.filter((record) => {
        if (record.isArchived) return false;
        if (params?.category && params.category !== 'all' && record.visitorCategory !== params.category) return false;
        if (params?.classification && params.classification !== 'all' && record.identityClassification !== params.classification) return false;
        const query = params?.query?.trim().toLowerCase();
        return !query || record.visitorName.toLowerCase().includes(query) || record.visitorId.toLowerCase().includes(query);
      });
    },
    getRecordById: async (id: string): Promise<VisitorRecord | null> => {
      return useDemoStore.getState().visitorRecords.find((record) => record.visitorId === id) || null;
    },
    createRecord: async (record: Omit<VisitorRecord, 'visitorId' | 'registeredAt' | 'isArchived'>): Promise<void> => {
      useDemoStore.getState().addVisitorRecord(record);
    },
    updateRecord: async (visitorId: string, updates: Partial<VisitorRecord>): Promise<void> => {
      useDemoStore.getState().updateVisitorRecord(visitorId, updates);
    },
    archiveRecord: async (visitorId: string): Promise<void> => {
      useDemoStore.getState().archiveVisitorRecord(visitorId);
    },
    recordCheckIn: async (visitorId: string, gate: string, staffName: string): Promise<void> => {
      useDemoStore.getState().recordCheckIn(visitorId, gate, staffName);
    },
    recordCheckOut: async (visitorId: string, gate: string, staffName: string): Promise<void> => {
      useDemoStore.getState().recordCheckOut(visitorId, gate, staffName);
    },
  },
  identities: {
    getIdentities: async (): Promise<KnownIdentityRecord[]> => {
      return useDemoStore.getState().knownIdentities.filter((k) => !k.isArchived);
    },
    updateClassification: async (id: string, classification: IdentityClassification, reason: string): Promise<void> => {
      useDemoStore.getState().updateIdentityClassification(id, classification, reason);
    },
    addIdentity: async (name: string, category: VisitorCategory, department?: string, notes?: string): Promise<void> => {
      useDemoStore.getState().addKnownIdentity(name, category, department, notes);
    },
    archiveIdentity: async (id: string): Promise<void> => {
      useDemoStore.getState().archiveKnownIdentity(id);
    },
  },
  notifications: {
    getNotifications: async (): Promise<StaffNotification[]> => {
      return useDemoStore.getState().notifications.filter((n) => !n.isArchived);
    },
    markAsRead: async (id: string): Promise<void> => {
      useDemoStore.getState().markNotificationAsRead(id);
    },
    markAllAsRead: async (): Promise<void> => {
      useDemoStore.getState().markAllNotificationsAsRead();
    },
    archiveNotification: async (id: string): Promise<void> => {
      useDemoStore.getState().archiveNotification(id);
    },
  },
};
