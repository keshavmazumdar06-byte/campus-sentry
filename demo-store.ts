'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  VisitorRequest,
  VisitorRecord,
  KnownIdentityRecord,
  StaffNotification,
  StaffUser,
  SecurityAlert,
  EntryExitLog,
  AIRecognitionEvent,
  AuditLogItem,
  SystemSettingsConfig,
  IdentityClassification,
  RequestStatus,
  VisitorCategory,
  VisitMode,
  OtpStatus,
} from '@/types';
import {
  INITIAL_KNOWN_IDENTITIES,
  INITIAL_STAFF_USERS,
  INITIAL_VISITOR_REQUESTS,
  INITIAL_STAFF_NOTIFICATIONS,
  INITIAL_VISITOR_RECORDS,
  INITIAL_ENTRY_EXIT_LOGS,
  INITIAL_SECURITY_ALERTS,
  INITIAL_AI_RECOGNITION_EVENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS,
} from '@/mocks/demo-data';
import { generateId } from '@/lib/utils';
import { canTransitionRequest, findUniqueIdentityNameMatch, requiresDemoOtp } from '@/lib/workflow';

export interface SimulateRequestInput {
  visitorName: string;
  phoneNumber?: string;
  visitorCategory: VisitorCategory;
  identityClassification: IdentityClassification;
  personToMeet: string;
  department?: string;
  reasonForMeeting: string;
  visitMode: VisitMode;
  requestedDate: string;
  requestedTime: string;
  appointmentDetails?: string;
  submittingStaffId: string;
  gateOrLocation: string;
  staffNotes?: string;
  priority?: 'Normal' | 'Urgent' | 'High';
}

interface DemoState {
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;

  visitorRequests: VisitorRequest[];
  visitorRecords: VisitorRecord[];
  knownIdentities: KnownIdentityRecord[];
  notifications: StaffNotification[];
  staffUsers: StaffUser[];
  securityAlerts: SecurityAlert[];
  entryExitLogs: EntryExitLog[];
  recognitionEvents: AIRecognitionEvent[];
  auditLogs: AuditLogItem[];
  settings: SystemSettingsConfig;
  currentUser: StaffUser;
  setDemoRole: (role: 'admin' | 'security') => void;

  // UI Modals / Search
  isSimulationModalOpen: boolean;
  setSimulationModalOpen: (open: boolean) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;

  // Actions
  simulateIncomingStaffRequest: (input: SimulateRequestInput) => string;
  approveRequest: (requestId: string, adminNotes?: string) => void;
  rejectRequest: (requestId: string, rejectionReason: string, adminNotes?: string) => void;
  requestMoreInfo: (requestId: string, notes: string) => void;
  markRequestPending: (requestId: string, notes?: string) => void;
  completeDemoOtpVerification: (requestId: string) => void;

  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  archiveNotification: (notificationId: string) => void;

  updateIdentityClassification: (
    identityId: string,
    newClassification: IdentityClassification,
    reason: string,
    actor?: string
  ) => void;
  addKnownIdentity: (name: string, category: VisitorCategory, department?: string, notes?: string) => void;
  editKnownIdentity: (id: string, updates: Partial<KnownIdentityRecord>) => void;
  archiveKnownIdentity: (id: string) => void;

  addVisitorRecord: (record: Omit<VisitorRecord, 'visitorId' | 'registeredAt' | 'isArchived'>) => void;
  updateVisitorRecord: (visitorId: string, updates: Partial<VisitorRecord>) => void;
  archiveVisitorRecord: (visitorId: string) => void;

  recordCheckIn: (visitorId: string, gate: string, staffName: string) => void;
  recordCheckOut: (visitorId: string, gate: string, staffName: string) => void;

  addStaffUser: (user: Omit<StaffUser, 'staffId' | 'submittedRequestsCount' | 'lastActive'>) => void;
  updateStaffUser: (staffId: string, updates: Partial<StaffUser>) => void;

  updateSecurityAlertStatus: (alertId: string, status: SecurityAlert['status'], resolutionNotes?: string) => void;
  reviewAIRecognitionEvent: (eventId: string, classification: IdentityClassification, notes?: string) => void;

  updateSettings: (newSettings: Partial<SystemSettingsConfig>) => void;
  resetDemoData: () => void;
  resetIdentityRegistry: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validArray<T>(value: unknown, isValid: (item: unknown) => item is T, fallback: T[]): T[] {
  return Array.isArray(value) ? value.filter(isValid) : fallback;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),

      visitorRequests: INITIAL_VISITOR_REQUESTS,
      visitorRecords: INITIAL_VISITOR_RECORDS,
      knownIdentities: INITIAL_KNOWN_IDENTITIES,
      notifications: INITIAL_STAFF_NOTIFICATIONS,
      staffUsers: INITIAL_STAFF_USERS,
      securityAlerts: INITIAL_SECURITY_ALERTS,
      entryExitLogs: INITIAL_ENTRY_EXIT_LOGS,
      recognitionEvents: INITIAL_AI_RECOGNITION_EVENTS,
      auditLogs: INITIAL_AUDIT_LOGS,
      settings: INITIAL_SETTINGS,
      currentUser: INITIAL_STAFF_USERS[1], // Sunita Sharma (Admin)
      setDemoRole: (role) => {
        const users = get().staffUsers;
        const user = role === 'admin'
          ? users.find((staff) => staff.role === 'Admin')
          : users.find((staff) => staff.role === 'Security/Staff');
        if (user) set({ currentUser: user });
      },

      isSimulationModalOpen: false,
      setSimulationModalOpen: (open) => set({ isSimulationModalOpen: open }),
      globalSearchQuery: '',
      setGlobalSearchQuery: (q) => set({ globalSearchQuery: q }),

      simulateIncomingStaffRequest: (input) => {
        const state = get();
        const requestId = generateId('REQ');
        const visitorId = generateId('VIS');
        const notifId = generateId('NOTIF');
        const nowIso = new Date().toISOString();

        // Check for Demo Registry Match against Known Identities
        const identityMatchCandidates = state.knownIdentities.filter(
          (k) => k.name.trim().toLowerCase() === input.visitorName.trim().toLowerCase() && !k.isArchived
        );
        const matchedIdentity = findUniqueIdentityNameMatch(state.knownIdentities, input.visitorName);
        const otpRequired = requiresDemoOtp(input.visitorCategory, state.settings.requireOtpForGuests);

        const staffMember = state.staffUsers.find((s) => s.staffId === input.submittingStaffId) || state.staffUsers[0];

        const notesWithRegistryTag = matchedIdentity
          ? `[Demo registry match: ${matchedIdentity.name}] ${input.staffNotes || ''}`.trim()
          : identityMatchCandidates.length > 1
            ? `[Multiple demo registry matches; not linked] ${input.staffNotes || ''}`.trim()
            : input.staffNotes || '';

        const newRequest: VisitorRequest = {
          requestId,
          visitorId,
          visitorName: input.visitorName,
          phoneNumber: input.phoneNumber || 'Not provided',
          visitorCategory: input.visitorCategory,
          identityClassification: matchedIdentity ? matchedIdentity.classification : input.identityClassification,
          department: input.department || 'Not specified',
          personToMeet: input.personToMeet,
          reasonForMeeting: input.reasonForMeeting,
          visitMode: input.visitMode,
          requestedDate: input.requestedDate,
          requestedTime: input.requestedTime,
          appointmentDetails: input.appointmentDetails || (input.visitMode === 'Walk-in' ? 'Walk-in arrival at gate' : 'Pre-scheduled appointment'),
          otpVerificationStatus: otpRequired ? 'Pending' : 'Not Applicable',
          submittedByStaffId: staffMember.staffId,
          submittedByStaffName: `${staffMember.name} (${staffMember.role})`,
          gateOrLocation: input.gateOrLocation,
          submittedAt: nowIso,
          requestStatus: otpRequired ? 'Pending Verification' : 'Pending Approval',
          associatedIdentityRecordId: matchedIdentity?.id,
          reviewHistory: [
            {
              timestamp: nowIso,
              actor: `${staffMember.name} (Gate Security)`,
              action: 'Submitted Request from Staff Mobile App (Simulated)',
              newStatus: otpRequired ? 'Pending Verification' : 'Pending Approval',
              notes: notesWithRegistryTag || undefined,
            },
          ],
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        const newNotification: StaffNotification = {
          id: notifId,
          requestId,
          visitorId,
          associatedIdentityRecordId: matchedIdentity?.id,
          visitorName: input.visitorName,
          visitorCategory: input.visitorCategory,
          identityClassification: matchedIdentity ? matchedIdentity.classification : input.identityClassification,
          phoneNumber: input.phoneNumber || 'Not provided',
          personToMeet: input.personToMeet,
          departmentOrOffice: input.department || 'Not provided',
          reasonForMeeting: input.reasonForMeeting,
          requestedDate: input.requestedDate,
          requestedTime: input.requestedTime,
          isWalkIn: input.visitMode === 'Walk-in',
          submittedByStaffName: `${staffMember.name} (${staffMember.role})`,
          submittedByStaffId: staffMember.staffId,
          gateLocation: input.gateOrLocation,
          submittedAt: nowIso,
          otpStatus: otpRequired ? 'Pending' : 'Not Applicable',
          requestStatus: otpRequired ? 'Pending Verification' : 'Pending Approval',
          staffNotes: notesWithRegistryTag || undefined,
          isRead: false,
          isArchived: false,
          priority: input.priority || (state.settings.enableWalkInDirectReview && input.visitMode === 'Walk-in' ? 'Urgent' : 'Normal'),
        };

        const newAlert: SecurityAlert | null = state.settings.autoFlagUnknownVisitors && newRequest.identityClassification === 'Unknown'
          ? {
              id: generateId('ALT'),
              category: 'Classification Alert',
              priority: 'Medium',
              timestamp: nowIso,
              relatedVisitorId: visitorId,
              relatedVisitorName: input.visitorName,
              relatedRequestId: requestId,
              deviceOrGate: input.gateOrLocation,
              recognitionServiceHealth: 'Simulated Normal',
              status: 'Open',
              description: `Unknown identity review flag for ${input.visitorName}. This is not a risk determination or automatic denial.`,
            }
          : null;

        const newVisitorRecord: VisitorRecord = {
          visitorId,
          visitorName: input.visitorName,
          phoneNumber: input.phoneNumber || 'Not provided',
          visitorCategory: input.visitorCategory,
          identityClassification: matchedIdentity ? matchedIdentity.classification : input.identityClassification,
          purpose: input.reasonForMeeting,
          personToMeet: input.personToMeet,
          requestedDateTime: `${input.requestedDate} ${input.requestedTime}`,
          registeredAt: nowIso,
          otpStatus: otpRequired ? 'Pending' : 'Not Applicable',
          requestStatus: otpRequired ? 'Pending Verification' : 'Pending Approval',
          currentPresence: 'Not Checked In',
          associatedStaffName: staffMember.name,
          gateLocation: input.gateOrLocation,
          notes: notesWithRegistryTag || undefined,
          isArchived: false,
          associatedIdentityId: matchedIdentity?.id,
        };

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: `${staffMember.name} (Security)`,
          action: 'Simulated Staff Visitor Request Submitted',
          entityType: 'Request',
          entityId: requestId,
          description: `Simulated request submitted for ${input.visitorName} (${input.visitorCategory}, ${newRequest.identityClassification}) to meet ${input.personToMeet}`,
          result: 'Success',
        };

        // Increment staff submission count
        const updatedStaff = state.staffUsers.map((s) =>
          s.staffId === staffMember.staffId
            ? { ...s, submittedRequestsCount: s.submittedRequestsCount + 1, lastActive: nowIso }
            : s
        );

        set({
          visitorRequests: [newRequest, ...state.visitorRequests],
          notifications: [newNotification, ...state.notifications],
          visitorRecords: [newVisitorRecord, ...state.visitorRecords],
          auditLogs: [auditItem, ...state.auditLogs],
          securityAlerts: newAlert ? [newAlert, ...state.securityAlerts] : state.securityAlerts,
          staffUsers: updatedStaff,
        });

        return requestId;
      },

      approveRequest: (requestId, adminNotes) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const request = state.visitorRequests.find((r) => r.requestId === requestId);
        if (!request || !canTransitionRequest(request.requestStatus, 'Approved')) return;

        const updatedRequests = state.visitorRequests.map((r) => {
          if (r.requestId === requestId) {
            return {
              ...r,
              requestStatus: 'Approved' as RequestStatus,
              adminNotes: adminNotes || r.adminNotes,
              updatedAt: nowIso,
              reviewHistory: [
                ...r.reviewHistory,
                {
                  timestamp: nowIso,
                  actor: actorName,
                  action: 'Approved visitor request',
                  previousStatus: r.requestStatus,
                  newStatus: 'Approved' as RequestStatus,
                  notes: adminNotes,
                },
              ],
            };
          }
          return r;
        });

        const updatedRecords = state.visitorRecords.map((rec) => {
          if (rec.visitorId === request.visitorId) {
            return {
              ...rec,
              requestStatus: 'Approved' as RequestStatus,
              notes: adminNotes ? `${rec.notes || ''} [Admin Approval Note: ${adminNotes}]`.trim() : rec.notes,
            };
          }
          return rec;
        });

        const updatedNotifications = state.notifications.map((n) => {
          if (n.requestId === requestId) {
            return { ...n, requestStatus: 'Approved' as RequestStatus };
          }
          return n;
        });

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Visitor Request Approved',
          entityType: 'Request',
          entityId: requestId,
          description: `Approved request for ${request.visitorName} to meet ${request.personToMeet}. Notes: ${adminNotes || 'None'}`,
          result: 'Success',
        };

        set({
          visitorRequests: updatedRequests,
          visitorRecords: updatedRecords,
          notifications: updatedNotifications,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      rejectRequest: (requestId, rejectionReason, adminNotes) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const request = state.visitorRequests.find((r) => r.requestId === requestId);
        if (!request || !rejectionReason.trim() || !canTransitionRequest(request.requestStatus, 'Rejected')) return;

        const updatedRequests = state.visitorRequests.map((r) => {
          if (r.requestId === requestId) {
            return {
              ...r,
              requestStatus: 'Rejected' as RequestStatus,
              rejectionReason,
              adminNotes: adminNotes || r.adminNotes,
              updatedAt: nowIso,
              reviewHistory: [
                ...r.reviewHistory,
                {
                  timestamp: nowIso,
                  actor: actorName,
                  action: 'Rejected visitor request',
                  previousStatus: r.requestStatus,
                  newStatus: 'Rejected' as RequestStatus,
                  notes: `Reason: ${rejectionReason}${adminNotes ? ` | Note: ${adminNotes}` : ''}`,
                },
              ],
            };
          }
          return r;
        });

        const updatedRecords = state.visitorRecords.map((rec) => {
          if (rec.visitorId === request.visitorId) {
            return {
              ...rec,
              requestStatus: 'Rejected' as RequestStatus,
              notes: `Rejected: ${rejectionReason}`,
            };
          }
          return rec;
        });

        const updatedNotifications = state.notifications.map((n) => {
          if (n.requestId === requestId) {
            return { ...n, requestStatus: 'Rejected' as RequestStatus };
          }
          return n;
        });

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Visitor Request Rejected',
          entityType: 'Request',
          entityId: requestId,
          description: `Rejected request for ${request.visitorName}. Reason: ${rejectionReason}`,
          result: 'Success',
        };

        set({
          visitorRequests: updatedRequests,
          visitorRecords: updatedRecords,
          notifications: updatedNotifications,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      requestMoreInfo: (requestId, notes) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const request = state.visitorRequests.find((r) => r.requestId === requestId);
        if (!request || !notes.trim() || !canTransitionRequest(request.requestStatus, 'Additional Information Required')) return;

        const updatedRequests = state.visitorRequests.map((r) => {
          if (r.requestId === requestId) {
            return {
              ...r,
              requestStatus: 'Additional Information Required' as RequestStatus,
              adminNotes: notes,
              updatedAt: nowIso,
              reviewHistory: [
                ...r.reviewHistory,
                {
                  timestamp: nowIso,
                  actor: actorName,
                  action: 'Requested Additional Information',
                  previousStatus: r.requestStatus,
                  newStatus: 'Additional Information Required' as RequestStatus,
                  notes,
                },
              ],
            };
          }
          return r;
        });

        const updatedRecords = state.visitorRecords.map((rec) => {
          if (rec.visitorId === request.visitorId) {
            return {
              ...rec,
              requestStatus: 'Additional Information Required' as RequestStatus,
              notes: `Info Requested: ${notes}`,
            };
          }
          return rec;
        });

        const updatedNotifications = state.notifications.map((n) => {
          if (n.requestId === requestId) {
            return { ...n, requestStatus: 'Additional Information Required' as RequestStatus };
          }
          return n;
        });

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Additional Information Requested',
          entityType: 'Request',
          entityId: requestId,
          description: `Additional info requested for ${request.visitorName}: ${notes}`,
          result: 'Success',
        };

        set({
          visitorRequests: updatedRequests,
          visitorRecords: updatedRecords,
          notifications: updatedNotifications,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      markRequestPending: (requestId, notes) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const request = state.visitorRequests.find((r) => r.requestId === requestId);
        if (!request || !canTransitionRequest(request.requestStatus, 'Pending Approval')) return;

        const updatedRequests = state.visitorRequests.map((r) => {
          if (r.requestId === requestId) {
            return {
              ...r,
              requestStatus: 'Pending Approval' as RequestStatus,
              updatedAt: nowIso,
              reviewHistory: [
                ...r.reviewHistory,
                {
                  timestamp: nowIso,
                  actor: actorName,
                  action: 'Kept Request Pending',
                  previousStatus: r.requestStatus,
                  newStatus: 'Pending Approval' as RequestStatus,
                  notes: notes || 'Review in progress',
                },
              ],
            };
          }
          return r;
        });

        const updatedRecords = state.visitorRecords.map((record) => record.visitorId === request.visitorId
          ? { ...record, requestStatus: 'Pending Approval' as RequestStatus }
          : record);
        const updatedNotifications = state.notifications.map((notification) => notification.requestId === requestId
          ? { ...notification, requestStatus: 'Pending Approval' as RequestStatus }
          : notification);
        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Request Kept Pending',
          entityType: 'Request',
          entityId: requestId,
          description: `Kept request for ${request.visitorName} pending review. ${notes || ''}`.trim(),
          result: 'Success',
        };
        set({ visitorRequests: updatedRequests, visitorRecords: updatedRecords, notifications: updatedNotifications,
          auditLogs: [auditItem, ...state.auditLogs] });
      },

      completeDemoOtpVerification: (requestId) => {
        const state = get();
        const request = state.visitorRequests.find((item) => item.requestId === requestId);
        if (!request || request.requestStatus !== 'Pending Verification' || request.otpVerificationStatus !== 'Pending') return;
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;
        const updatedRequests = state.visitorRequests.map((item) => item.requestId === requestId ? {
          ...item,
          requestStatus: 'Pending Approval' as RequestStatus,
          otpVerificationStatus: 'Verified' as OtpStatus,
          updatedAt: nowIso,
          reviewHistory: [...item.reviewHistory, { timestamp: nowIso, actor: actorName,
            action: 'Simulated OTP verification completed', previousStatus: item.requestStatus,
            newStatus: 'Pending Approval' as RequestStatus, notes: 'Demo-only verification; no SMS was sent.' }],
        } : item);
        const updatedRecords = state.visitorRecords.map((item) => item.visitorId === request.visitorId
          ? { ...item, requestStatus: 'Pending Approval' as RequestStatus, otpStatus: 'Verified' as OtpStatus }
          : item);
        const updatedNotifications = state.notifications.map((item) => item.requestId === requestId
          ? { ...item, requestStatus: 'Pending Approval' as RequestStatus, otpStatus: 'Verified' as OtpStatus }
          : item);
        const auditItem: AuditLogItem = { id: generateId('AUD'), timestamp: nowIso, actor: actorName,
          action: 'Simulated OTP Verification Completed', entityType: 'Request', entityId: requestId,
          description: `Completed demo-only OTP verification for ${request.visitorName}; no SMS was sent.`, result: 'Success' };
        set({ visitorRequests: updatedRequests, visitorRecords: updatedRecords, notifications: updatedNotifications,
          auditLogs: [auditItem, ...state.auditLogs] });
      },

      markNotificationAsRead: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
        }));
      },

      markAllNotificationsAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => n.isArchived ? n : ({ ...n, isRead: true })),
        }));
      },

      archiveNotification: (notificationId) => {
        const state = get();
        const notification = state.notifications.find((item) => item.id === notificationId);
        if (!notification || notification.isArchived) return;
        const nowIso = new Date().toISOString();
        const auditItem: AuditLogItem = {
          id: generateId('AUD'), timestamp: nowIso,
          actor: `${state.currentUser.name} (${state.currentUser.role})`,
          action: 'Notification Archived', entityType: 'Request', entityId: notification.requestId,
          description: `Archived notification ${notification.id} for request ${notification.requestId}.`, result: 'Success',
        };
        set({
          notifications: state.notifications.map((item) => item.id === notificationId ? { ...item, isArchived: true } : item),
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      updateIdentityClassification: (identityId, newClassification, reason, actor) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = actor || `${state.currentUser.name} (${state.currentUser.role})`;

        const identity = state.knownIdentities.find((k) => k.id === identityId);
        if (!identity) return;

        const prevClassification = identity.classification;

        const updatedIdentities = state.knownIdentities.map((k) => {
          if (k.id === identityId) {
            return {
              ...k,
              classification: newClassification,
              updatedAt: nowIso,
              classificationHistory: [
                ...k.classificationHistory,
                {
                  timestamp: nowIso,
                  actor: actorName,
                  previousClassification: prevClassification,
                  newClassification,
                  reason,
                },
              ],
            };
          }
          return k;
        });

        // Synchronize corresponding visitor records & requests
        const updatedRecords = state.visitorRecords.map((v) => {
          if (v.associatedIdentityId === identityId) {
            return { ...v, identityClassification: newClassification };
          }
          return v;
        });

        const updatedRequests = state.visitorRequests.map((r) => {
          if (r.associatedIdentityRecordId === identityId) {
            return { ...r, identityClassification: newClassification };
          }
          return r;
        });

        const updatedNotifications = state.notifications.map((n) => {
          if (n.associatedIdentityRecordId === identityId) {
            return { ...n, identityClassification: newClassification };
          }
          return n;
        });

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Identity Classification Changed',
          entityType: 'Identity',
          entityId: identityId,
          description: `Updated classification of ${identity.name} from "${prevClassification}" to "${newClassification}". Reason: ${reason}`,
          result: 'Success',
        };

        set({
          knownIdentities: updatedIdentities,
          visitorRecords: updatedRecords,
          visitorRequests: updatedRequests,
          notifications: updatedNotifications,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      addKnownIdentity: (name, category, department, notes) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;
        const id = generateId('KID');

        const newRecord: KnownIdentityRecord = {
          id,
          name: name.trim(),
          classification: 'Known',
          category: category || 'Not specified',
          department: department || 'Not specified',
          notes,
          classificationHistory: [
            {
              timestamp: nowIso,
              actor: actorName,
              previousClassification: 'Known',
              newClassification: 'Known',
              reason: 'Manually added to Known Identity Registry',
            },
          ],
          isArchived: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Known Identity Added',
          entityType: 'Identity',
          entityId: id,
          description: `Added manual identity record for ${name} (${category})`,
          result: 'Success',
        };

        set({
          knownIdentities: [newRecord, ...state.knownIdentities],
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      editKnownIdentity: (id, updates) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const identity = state.knownIdentities.find((k) => k.id === id);
        if (!identity) return;

        const updatedIdentities = state.knownIdentities.map((k) =>
          k.id === id ? { ...k, ...updates, updatedAt: nowIso } : k
        );

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Known Identity Edited',
          entityType: 'Identity',
          entityId: id,
          description: `Edited identity details for ${identity.name}`,
          result: 'Success',
        };

        set({
          knownIdentities: updatedIdentities,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      archiveKnownIdentity: (id) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const identity = state.knownIdentities.find((k) => k.id === id);
        if (!identity) return;

        const updated = state.knownIdentities.map((k) => (k.id === id ? { ...k, isArchived: true } : k));

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Identity Archived',
          entityType: 'Identity',
          entityId: id,
          description: `Archived identity registry record for ${identity.name}`,
          result: 'Success',
        };

        set({
          knownIdentities: updated,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      addVisitorRecord: (recordData) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const visitorId = generateId('VIS');
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const newRecord: VisitorRecord = {
          ...recordData,
          visitorId,
          registeredAt: nowIso,
          isArchived: false,
          otpStatus: state.settings.requireOtpForGuests && recordData.visitorCategory === 'Guest/External Visitor'
            ? 'Pending'
            : 'Not Applicable',
          requestStatus: state.settings.requireOtpForGuests && recordData.visitorCategory === 'Guest/External Visitor'
            ? 'Pending Verification'
            : 'Pending Approval',
          currentPresence: 'Not Checked In',
          checkInTime: undefined,
          checkOutTime: undefined,
        };

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Manual Visitor Record Created for Review',
          entityType: 'Visitor',
          entityId: visitorId,
          description: `Created manual visitor record for ${recordData.visitorName} (${recordData.visitorCategory})`,
          result: 'Success',
        };

        set({
          visitorRecords: [newRecord, ...state.visitorRecords],
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      updateVisitorRecord: (visitorId, updates) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const rec = state.visitorRecords.find((r) => r.visitorId === visitorId);
        if (!rec) return;

        const updated = state.visitorRecords.map((r) => (r.visitorId === visitorId ? { ...r, ...updates } : r));
        const updatedRequests = state.visitorRequests.map((request) => request.visitorId === visitorId ? {
          ...request,
          visitorName: updates.visitorName ?? request.visitorName,
          phoneNumber: updates.phoneNumber ?? request.phoneNumber,
          visitorCategory: updates.visitorCategory ?? request.visitorCategory,
          identityClassification: updates.identityClassification ?? request.identityClassification,
          personToMeet: updates.personToMeet ?? request.personToMeet,
          reasonForMeeting: updates.purpose ?? request.reasonForMeeting,
          updatedAt: nowIso,
        } : request);
        const updatedNotifications = state.notifications.map((notification) => notification.visitorId === visitorId ? {
          ...notification,
          visitorName: updates.visitorName ?? notification.visitorName,
          phoneNumber: updates.phoneNumber ?? notification.phoneNumber,
          visitorCategory: updates.visitorCategory ?? notification.visitorCategory,
          identityClassification: updates.identityClassification ?? notification.identityClassification,
          personToMeet: updates.personToMeet ?? notification.personToMeet,
          reasonForMeeting: updates.purpose ?? notification.reasonForMeeting,
        } : notification);

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Visitor Record Updated',
          entityType: 'Visitor',
          entityId: visitorId,
          description: `Updated details for visitor record ${rec.visitorName}`,
          result: 'Success',
        };

        set({
          visitorRecords: updated,
          visitorRequests: updatedRequests,
          notifications: updatedNotifications,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      archiveVisitorRecord: (visitorId) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const actorName = `${state.currentUser.name} (${state.currentUser.role})`;

        const rec = state.visitorRecords.find((r) => r.visitorId === visitorId);
        if (!rec || rec.currentPresence === 'Inside Campus') return;

        const updated = state.visitorRecords.map((r) => (r.visitorId === visitorId ? { ...r, isArchived: true } : r));

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: actorName,
          action: 'Visitor Record Archived',
          entityType: 'Visitor',
          entityId: visitorId,
          description: `Archived visitor record for ${rec.visitorName}`,
          result: 'Success',
        };

        set({
          visitorRecords: updated,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      recordCheckIn: (visitorId, gate, staffName) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const rec = state.visitorRecords.find((r) => r.visitorId === visitorId);
        if (!rec) return;

        // Prevent duplicate check-in
        if (rec.currentPresence === 'Inside Campus' || rec.requestStatus !== 'Approved') {
          return;
        }

        const logId = generateId('EEL');
        const newLog: EntryExitLog = {
          id: logId,
          visitorId,
          visitorName: rec.visitorName,
          gateOrLocation: gate,
          eventType: 'Entry',
          timestamp: nowIso,
          recordingStaffName: staffName,
          source: 'Gate Scanner (Simulated)',
        };

        const updatedRecords = state.visitorRecords.map((r) =>
          r.visitorId === visitorId
            ? { ...r, currentPresence: 'Inside Campus' as const, checkInTime: nowIso }
            : r
        );

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: staffName,
          action: 'Visitor Gate Check-in',
          entityType: 'Visitor',
          entityId: visitorId,
          description: `Recorded campus entry for ${rec.visitorName} at ${gate}`,
          result: 'Success',
        };

        set({
          visitorRecords: updatedRecords,
          entryExitLogs: [newLog, ...state.entryExitLogs],
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      recordCheckOut: (visitorId, gate, staffName) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const rec = state.visitorRecords.find((r) => r.visitorId === visitorId);
        if (!rec) return;

        // Prevent invalid checkout if not inside campus
        if (rec.currentPresence !== 'Inside Campus') {
          return;
        }

        const logId = generateId('EEL');
        const newLog: EntryExitLog = {
          id: logId,
          visitorId,
          visitorName: rec.visitorName,
          gateOrLocation: gate,
          eventType: 'Exit',
          timestamp: nowIso,
          recordingStaffName: staffName,
          source: 'Gate Scanner (Simulated)',
        };

        const updatedRecords = state.visitorRecords.map((r) =>
          r.visitorId === visitorId
            ? { ...r, currentPresence: 'Exited' as const, checkOutTime: nowIso }
            : r
        );

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: staffName,
          action: 'Visitor Gate Check-out',
          entityType: 'Visitor',
          entityId: visitorId,
          description: `Recorded campus exit for ${rec.visitorName} at ${gate}`,
          result: 'Success',
        };

        set({
          visitorRecords: updatedRecords,
          entryExitLogs: [newLog, ...state.entryExitLogs],
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      addStaffUser: (userData) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const staffId = generateId('STF');

        const newStaff: StaffUser = {
          ...userData,
          staffId,
          submittedRequestsCount: 0,
          lastActive: nowIso,
        };

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: `${state.currentUser.name} (${state.currentUser.role})`,
          action: 'Staff Account Created',
          entityType: 'Staff',
          entityId: staffId,
          description: `Created demo staff account for ${userData.name} (${userData.role})`,
          result: 'Success',
        };

        set({
          staffUsers: [...state.staffUsers, newStaff],
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      updateStaffUser: (staffId, updates) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const target = state.staffUsers.find((s) => s.staffId === staffId);
        if (!target) return;

        const updated = state.staffUsers.map((s) => (s.staffId === staffId ? { ...s, ...updates } : s));

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: `${state.currentUser.name} (${state.currentUser.role})`,
          action: 'Staff Details Updated',
          entityType: 'Staff',
          entityId: staffId,
          description: `Updated profile/role for staff member ${target.name}`,
          result: 'Success',
        };

        set({
          staffUsers: updated,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      updateSecurityAlertStatus: (alertId, status, resolutionNotes) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const alert = state.securityAlerts.find((a) => a.id === alertId);
        if (!alert) return;

        const updated = state.securityAlerts.map((a) =>
          a.id === alertId
            ? {
                ...a,
                status,
                resolutionNotes: resolutionNotes || a.resolutionNotes,
                assignedReviewer: `${state.currentUser.name} (${state.currentUser.role})`,
              }
            : a
        );

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: `${state.currentUser.name} (${state.currentUser.role})`,
          action: 'Security Alert Status Changed',
          entityType: 'SecurityAlert',
          entityId: alertId,
          description: `Changed alert ${alertId} status to ${status}. Notes: ${resolutionNotes || 'None'}`,
          result: 'Success',
        };

        set({
          securityAlerts: updated,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      reviewAIRecognitionEvent: (eventId, classification, notes) => {
        const state = get();
        const nowIso = new Date().toISOString();
        const evt = state.recognitionEvents.find((e) => e.id === eventId);
        if (!evt) return;

        const updated = state.recognitionEvents.map((e) =>
          e.id === eventId
            ? {
                ...e,
                matchClassification: classification,
                reviewerStatus: 'Reviewed' as const,
                reviewedBy: `${state.currentUser.name} (${state.currentUser.role})`,
                reviewedAt: nowIso,
                notes: notes || e.notes,
              }
            : e
        );

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: `${state.currentUser.name} (${state.currentUser.role})`,
          action: 'AI Recognition Event Reviewed',
          entityType: 'RecognitionEvent',
          entityId: eventId,
          description: `Reviewed recognition event ${eventId}, set classification to ${classification}`,
          result: 'Success',
        };

        set({
          recognitionEvents: updated,
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      updateSettings: (newSettings) => {
        const state = get();
        const nowIso = new Date().toISOString();

        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: `${state.currentUser.name} (${state.currentUser.role})`,
          action: 'System Settings Updated',
          entityType: 'Settings',
          entityId: 'SYSTEM-CONFIG',
          description: 'Updated system administrative configuration',
          result: 'Success',
        };

        set({
          settings: { ...state.settings, ...newSettings },
          auditLogs: [auditItem, ...state.auditLogs],
        });
      },

      resetDemoData: () => {
        const nowIso = new Date().toISOString();
        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: 'Administrator',
          action: 'Reset Demo Data',
          entityType: 'Settings',
          entityId: 'DEMO-RESET',
          description: 'Restored canonical demo database state and 5 initial Known Identity records (Keshav, Praveen, Raj, Aditi, Supriya)',
          result: 'Success',
        };

        set({
          visitorRequests: INITIAL_VISITOR_REQUESTS,
          visitorRecords: INITIAL_VISITOR_RECORDS,
          knownIdentities: INITIAL_KNOWN_IDENTITIES,
          notifications: INITIAL_STAFF_NOTIFICATIONS,
          staffUsers: INITIAL_STAFF_USERS,
          securityAlerts: INITIAL_SECURITY_ALERTS,
          entryExitLogs: INITIAL_ENTRY_EXIT_LOGS,
          recognitionEvents: INITIAL_AI_RECOGNITION_EVENTS,
          auditLogs: [auditItem, ...INITIAL_AUDIT_LOGS],
          settings: INITIAL_SETTINGS,
          currentUser: INITIAL_STAFF_USERS[1],
        });
      },

      resetIdentityRegistry: () => {
        const state = get();
        const nowIso = new Date().toISOString();
        const auditItem: AuditLogItem = {
          id: generateId('AUD'),
          timestamp: nowIso,
          actor: `${state.currentUser.name} (${state.currentUser.role})`,
          action: 'Identity Registry Restored',
          entityType: 'Identity',
          entityId: 'IDENTITY-REGISTRY',
          description: 'Restored the five canonical demo identity records; other demo data was retained.',
          result: 'Success',
        };
        set({ knownIdentities: INITIAL_KNOWN_IDENTITIES, auditLogs: [auditItem, ...state.auditLogs] });
      },
    }),
    {
      name: 'campussentry-ai-demo-store-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        visitorRequests: state.visitorRequests,
        visitorRecords: state.visitorRecords,
        knownIdentities: state.knownIdentities,
        notifications: state.notifications,
        staffUsers: state.staffUsers,
        securityAlerts: state.securityAlerts,
        entryExitLogs: state.entryExitLogs,
        recognitionEvents: state.recognitionEvents,
        auditLogs: state.auditLogs,
        settings: state.settings,
        currentUser: state.currentUser,
      }),
      merge: (persistedState, currentState) => {
        const saved = isRecord(persistedState) ? persistedState : {};
        const staffUsers = validArray(saved.staffUsers, (item): item is StaffUser => isRecord(item)
          && typeof item.staffId === 'string' && typeof item.name === 'string', currentState.staffUsers);
        const storedUser = isRecord(saved.currentUser) ? saved.currentUser : null;
        const currentUser = storedUser && typeof storedUser.staffId === 'string'
          ? staffUsers.find((user) => user.staffId === storedUser.staffId) || currentState.currentUser
          : currentState.currentUser;
        const savedSettings = isRecord(saved.settings) ? saved.settings : {};
        const stringList = (value: unknown, fallback: string[]) => {
          const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
          return values.length ? values : fallback;
        };
        const booleanSetting = (key: keyof SystemSettingsConfig) => typeof savedSettings[key] === 'boolean'
          ? savedSettings[key] as boolean
          : INITIAL_SETTINGS[key] as boolean;
        const settings: SystemSettingsConfig = {
          ...INITIAL_SETTINGS,
          visitorCategories: stringList(savedSettings.visitorCategories, INITIAL_SETTINGS.visitorCategories),
          authorizedMeetingAuthorities: stringList(savedSettings.authorizedMeetingAuthorities, INITIAL_SETTINGS.authorizedMeetingAuthorities),
          autoFlagUnknownVisitors: booleanSetting('autoFlagUnknownVisitors'),
          requireOtpForGuests: booleanSetting('requireOtpForGuests'),
          enableWalkInDirectReview: booleanSetting('enableWalkInDirectReview'),
          retentionDays: typeof savedSettings.retentionDays === 'number' && Number.isFinite(savedSettings.retentionDays)
            ? Math.max(1, Math.min(3650, savedSettings.retentionDays))
            : INITIAL_SETTINGS.retentionDays,
        };
        return {
          ...currentState,
          visitorRequests: validArray(saved.visitorRequests, (item): item is VisitorRequest => isRecord(item)
            && typeof item.requestId === 'string' && typeof item.visitorId === 'string', currentState.visitorRequests),
          visitorRecords: validArray(saved.visitorRecords, (item): item is VisitorRecord => isRecord(item)
            && typeof item.visitorId === 'string' && typeof item.visitorName === 'string', currentState.visitorRecords),
          knownIdentities: validArray(saved.knownIdentities, (item): item is KnownIdentityRecord => isRecord(item)
            && typeof item.id === 'string' && typeof item.name === 'string', currentState.knownIdentities),
          notifications: validArray(saved.notifications, (item): item is StaffNotification => isRecord(item)
            && typeof item.id === 'string' && typeof item.requestId === 'string', currentState.notifications),
          staffUsers,
          securityAlerts: validArray(saved.securityAlerts, (item): item is SecurityAlert => isRecord(item)
            && typeof item.id === 'string' && typeof item.timestamp === 'string', currentState.securityAlerts),
          entryExitLogs: validArray(saved.entryExitLogs, (item): item is EntryExitLog => isRecord(item)
            && typeof item.id === 'string' && typeof item.visitorId === 'string' && typeof item.timestamp === 'string', currentState.entryExitLogs),
          recognitionEvents: validArray(saved.recognitionEvents, (item): item is AIRecognitionEvent => isRecord(item)
            && typeof item.id === 'string' && typeof item.timestamp === 'string', currentState.recognitionEvents),
          auditLogs: validArray(saved.auditLogs, (item): item is AuditLogItem => isRecord(item)
            && typeof item.id === 'string' && typeof item.timestamp === 'string', currentState.auditLogs),
          settings,
          currentUser,
          hasHydrated: false,
          isSimulationModalOpen: false,
          globalSearchQuery: '',
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);
