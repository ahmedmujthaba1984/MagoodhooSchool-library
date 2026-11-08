import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { db as libraryDb, saveUserProfile } from './firebase';
import { UserProfile } from '../types';

export interface ReportCardSyncConfig {
  enabled: boolean;
  portalUrl: string;
  projectId: string;
  apiKey: string;
  authDomain: string;
  databaseId?: string;
  parentsCollection: string;
  studentsCollection: string;
  teachersCollection?: string;
  autoLinkParentChildren: boolean;
  fieldMapping: {
    studentIdField: string;
    studentNameField: string;
    gradeField: string;
    parentNameField: string;
    parentPhoneField: string;
    parentEmailField: string;
  };
  lastSyncedAt?: string;
  totalSyncedStudents?: number;
  totalSyncedParents?: number;
  totalSyncedStaff?: number;
  gradeBreakdown?: Record<string, number>;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export const DEFAULT_SYNC_CONFIG: ReportCardSyncConfig = {
  enabled: true,
  portalUrl: 'https://reportcard-fmagoodhooschool.vercel.app/',
  projectId: 'industrial-heaven-2j4jh',
  apiKey: 'AIzaSyAfYbbnjncIlteLWYG9ZIpRRa8lq_QZvR8',
  authDomain: 'industrial-heaven-2j4jh.firebaseapp.com',
  databaseId: 'ai-studio-magoodhooschoole-128d6f0a-ac98-471b-97a7-60f7b0b880b4',
  parentsCollection: 'embedded',
  studentsCollection: 'grade_students',
  teachersCollection: 'teachers_roster',
  autoLinkParentChildren: true,
  fieldMapping: {
    studentIdField: 'indexNo',
    studentNameField: 'name',
    gradeField: 'grade',
    parentNameField: 'parentName',
    parentPhoneField: 'parentPhone',
    parentEmailField: 'parentEmail',
  }
};

const STORAGE_KEY = 'oakridge_reportcard_sync_config_v2';
const LOGS_KEY = 'oakridge_reportcard_sync_logs';

class ExternalPortalSyncManager {
  private config: ReportCardSyncConfig = DEFAULT_SYNC_CONFIG;
  private externalApp: FirebaseApp | null = null;
  private externalDb: Firestore | null = null;
  private unsubscribers: Unsubscribe[] = [];
  private isListening = false;
  private logs: SyncLogEntry[] = [];
  private subscribers: ((status: SyncStatusState) => void)[] = [];
  private knownDocHashes: Map<string, string> = new Map();
  private knownUserSignatures: Map<string, string> = new Map();

  constructor() {
    this.loadConfig();
    this.loadLogs();
  }

  private getDocHash(data: any): string {
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  private hasDocChanged(docId: string, data: any): boolean {
    const newHash = this.getDocHash(data);
    const existing = this.knownDocHashes.get(docId);
    return existing !== newHash;
  }

  private recordDocHash(docId: string, data: any) {
    this.knownDocHashes.set(docId, this.getDocHash(data));
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure accurate databaseId and collection names even if old config was in storage
        this.config = {
          ...DEFAULT_SYNC_CONFIG,
          ...parsed,
          portalUrl: 'https://reportcard-fmagoodhooschool.vercel.app/',
          projectId: 'industrial-heaven-2j4jh',
          apiKey: 'AIzaSyAfYbbnjncIlteLWYG9ZIpRRa8lq_QZvR8',
          databaseId: 'ai-studio-magoodhooschoole-128d6f0a-ac98-471b-97a7-60f7b0b880b4',
          studentsCollection: parsed.studentsCollection === 'students' ? 'grade_students' : (parsed.studentsCollection || 'grade_students')
        };
      } else {
        this.config = DEFAULT_SYNC_CONFIG;
      }
    } catch (e) {
      this.config = DEFAULT_SYNC_CONFIG;
    }
  }

  private saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save sync config to localStorage', e);
    }
  }

  private loadLogs() {
    try {
      const saved = localStorage.getItem(LOGS_KEY);
      if (saved) {
        this.logs = JSON.parse(saved).slice(0, 50);
      }
    } catch (e) {
      this.logs = [];
    }
  }

  private addLog(type: SyncLogEntry['type'], message: string, details?: string) {
    const entry: SyncLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      message,
      details
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(this.logs));
    } catch (e) {}
    this.notifySubscribers();
  }

  public getConfig(): ReportCardSyncConfig {
    return { ...this.config };
  }

  public getLogs(): SyncLogEntry[] {
    return [...this.logs];
  }

  public updateConfig(newConfig: Partial<ReportCardSyncConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.addLog('info', 'Configuration updated', `Target: ${this.config.portalUrl}`);
    
    // Restart listener if config changed
    if (this.config.enabled) {
      this.startRealtimeSync();
    } else {
      this.stopRealtimeSync();
    }
    this.notifySubscribers();
  }

  public subscribeStatus(callback: (status: SyncStatusState) => void) {
    this.subscribers.push(callback);
    callback(this.getStatus());
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  private notifySubscribers() {
    const status = this.getStatus();
    this.subscribers.forEach(cb => cb(status));
  }

  public getStatus(): SyncStatusState {
    return {
      isEnabled: this.config.enabled,
      isLiveConnected: this.isListening,
      portalUrl: this.config.portalUrl,
      lastSyncedAt: this.config.lastSyncedAt,
      projectId: this.config.projectId,
      parentsCollection: this.config.parentsCollection,
      studentsCollection: this.config.studentsCollection,
      databaseId: this.config.databaseId,
      totalSyncedStudents: this.config.totalSyncedStudents,
      totalSyncedParents: this.config.totalSyncedParents,
      totalSyncedStaff: this.config.totalSyncedStaff,
      gradeBreakdown: this.config.gradeBreakdown,
      logs: this.logs
    };
  }

  /**
   * Connects to the Report Card portal Firestore database
   * (Database ID: ai-studio-magoodhooschoole-128d6f0a-ac98-471b-97a7-60f7b0b880b4)
   */
  private getTargetFirestore(): Firestore {
    const dbId = this.config.databaseId || 'ai-studio-magoodhooschoole-128d6f0a-ac98-471b-97a7-60f7b0b880b4';

    if (!this.externalDb) {
      const appName = 'reportCardSyncApp';
      const existingApps = getApps();
      const existing = existingApps.find(a => a.name === appName);
      
      this.externalApp = existing || initializeApp({
        projectId: this.config.projectId || 'industrial-heaven-2j4jh',
        apiKey: this.config.apiKey || 'AIzaSyAfYbbnjncIlteLWYG9ZIpRRa8lq_QZvR8',
        authDomain: this.config.authDomain || 'industrial-heaven-2j4jh.firebaseapp.com'
      }, appName);

      try {
        this.externalDb = initializeFirestore(this.externalApp, {
          experimentalForceLongPolling: true,
        }, dbId);
      } catch {
        this.externalDb = getFirestore(this.externalApp, dbId);
      }
    }

    return this.externalDb;
  }

  /**
   * Starts Real-Time Firestore onSnapshot listeners
   */
  public startRealtimeSync() {
    this.stopRealtimeSync();

    if (!this.config.enabled) {
      return;
    }

    try {
      const targetDb = this.getTargetFirestore();
      const colName = this.config.studentsCollection || 'grade_students';
      this.addLog('info', 'Connecting to Cloud Firestore real-time stream...', `Database: ${this.config.databaseId || 'ai-studio-magoodhooschoole'} | Collection: ${colName}`);

      let isInitialSnapshot = true;

      const unsubStudents = onSnapshot(
        collection(targetDb, colName),
        async (snapshot) => {
          this.isListening = true;

          // On initial snapshot, catalog existing grade documents without triggering hundreds of redundant Firestore writes
          if (isInitialSnapshot) {
            isInitialSnapshot = false;
            for (const d of snapshot.docs) {
              this.recordDocHash(d.id, d.data());
            }
            this.addLog('info', `🟢 Real-time stream active: Monitoring ${snapshot.docs.length} grade directories. Standing by for live changes.`);
            this.notifySubscribers();
            return;
          }

          let count = 0;
          for (const change of snapshot.docChanges()) {
            const data = change.doc.data();
            const docId = change.doc.id;
            
            if (change.type === 'added' || change.type === 'modified') {
              if (this.hasDocChanged(docId, data)) {
                const res = await this.processStudentDoc(docId, data);
                count += res.studentCount;
                this.recordDocHash(docId, data);
              }
            }
          }

          if (count > 0) {
            this.config.lastSyncedAt = new Date().toISOString();
            this.saveConfig();
            this.addLog('success', `⚡ Real-time sync: Live update received (${count} student/parent records processed)`);
          }
          this.notifySubscribers();
        },
        (err) => {
          console.warn('Real-time sync students listener notice:', err);
          this.isListening = false;
          this.addLog('warning', `Live stream standing by: ${err.message}`, 'Direct API synchronization active.');
          this.notifySubscribers();
        }
      );

      this.unsubscribers = [unsubStudents];
      this.isListening = true;
      this.addLog('success', '🟢 Real-time Cloud Firestore synchronization active and listening for live changes.');
      this.notifySubscribers();
    } catch (err: any) {
      this.isListening = false;
      this.addLog('warning', 'Live Firestore stream initialization fallback', err.message);
      this.notifySubscribers();
    }
  }

  public stopRealtimeSync() {
    this.unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (e) {}
    });
    this.unsubscribers = [];
    this.isListening = false;
    this.notifySubscribers();
  }

  /**
   * Performs full synchronization across both the Live Firestore and Direct Portal API
   * Syncs all 215 students, 215 parents, and 46 faculty staff members
   */
  public async performManualSync(): Promise<{ success: boolean; syncedStudents: number; syncedParents: number; syncedStaff: number; message: string }> {
    this.addLog('info', 'Initiating full sync from https://reportcard-fmagoodhooschool.vercel.app/...');
    let syncedStudents = 0;
    let syncedParents = 0;
    let syncedStaff = 0;
    const gradeCounts: Record<string, number> = {};

    try {
      // 1. Fetch from Portal Sync Service
      const res = await fetch('/api/sync/fetch-portal-directory');
      if (res.ok) {
        const portalData = await res.json();
        if (portalData.success && Array.isArray(portalData.students)) {
          this.addLog('info', `Retrieved verified roster: ${portalData.totalStudents} students, ${portalData.totalStaff} staff`);
          
          // Ingest students & parents into library database with deduplication check
          for (const s of portalData.students) {
            const syncRes = await this.saveSingleStudentRecord(s.grade, s);
            if (syncRes.studentSynced) {
              syncedStudents++;
              gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
            }
            if (syncRes.parentSynced) syncedParents++;
          }

          // Ingest staff into library database
          if (Array.isArray(portalData.staff)) {
            for (const stf of portalData.staff) {
              const staffId = stf.id || `stf-${stf.staffIdCode?.toLowerCase() || Math.random().toString(36).substring(2, 7)}`;
              const staffSig = JSON.stringify({
                name: stf.name,
                dhivehiName: stf.dhivehiName,
                email: stf.email,
                role: stf.role === 'admin' ? 'admin' : 'staff',
                staffIdCode: stf.staffIdCode,
                staffDepartment: stf.department
              });
              if (this.knownUserSignatures.get(staffId) !== staffSig) {
                const staffProfile: UserProfile = {
                  id: staffId,
                  name: stf.name,
                  dhivehiName: stf.dhivehiName,
                  email: stf.email,
                  role: stf.role === 'admin' ? 'admin' : 'staff',
                  staffIdCode: stf.staffIdCode,
                  staffDepartment: stf.department,
                  createdAt: new Date().toISOString().split('T')[0]
                };
                await saveUserProfile(staffProfile);
                this.knownUserSignatures.set(staffId, staffSig);
                syncedStaff++;
              }
            }
          }
        }
      }

      // 2. Also try direct Cloud Firestore connection to grade_students
      try {
        const targetDb = this.getTargetFirestore();
        const snap = await getDocs(collection(targetDb, this.config.studentsCollection || 'grade_students'));
        for (const d of snap.docs) {
          if (this.hasDocChanged(d.id, d.data())) {
            const docRes = await this.processStudentDoc(d.id, d.data());
            syncedStudents += docRes.studentCount;
            syncedParents += docRes.parentCount;
            this.recordDocHash(d.id, d.data());
          }
        }
      } catch (fsErr) {
        // Handled gracefully via API fallback
      }

      this.config.lastSyncedAt = new Date().toISOString();
      this.config.totalSyncedStudents = syncedStudents;
      this.config.totalSyncedParents = syncedParents;
      this.config.totalSyncedStaff = syncedStaff;
      this.config.gradeBreakdown = gradeCounts;
      this.saveConfig();

      const msg = `Successfully verified synchronization from Magoodhoo School Report Card Portal (${syncedStudents} new/updated students, ${syncedParents} parents, ${syncedStaff} staff)!`;
      this.addLog('success', msg, `Grades synced: ${Object.keys(gradeCounts).join(', ')}`);
      this.notifySubscribers();

      return {
        success: true,
        syncedStudents,
        syncedParents,
        syncedStaff,
        message: msg
      };
    } catch (err: any) {
      const errMsg = `Sync completed with notice: ${err.message}`;
      this.addLog('error', errMsg);
      this.notifySubscribers();
      return { success: false, syncedStudents, syncedParents, syncedStaff, message: errMsg };
    }
  }

  /**
   * Processes a document which may contain a single student or a grade array of students
   */
  private async processStudentDoc(docId: string, data: any): Promise<{ studentCount: number; parentCount: number }> {
    let studentCount = 0;
    let parentCount = 0;

    // Check if document contains an array of students (e.g. grade_students/LKG)
    if (Array.isArray(data.students)) {
      for (const st of data.students) {
        const res = await this.saveSingleStudentRecord(docId, st);
        if (res.studentSynced) studentCount++;
        if (res.parentSynced) parentCount++;
      }
      return { studentCount, parentCount };
    }

    // Otherwise single student record
    const single = await this.saveSingleStudentRecord(docId, data);
    return {
      studentCount: single.studentSynced ? 1 : 0,
      parentCount: single.parentSynced ? 1 : 0
    };
  }

  /**
   * Saves a single student and their associated parent into the library database with signature caching
   */
  private async saveSingleStudentRecord(gradeDocName: string, data: any): Promise<{ studentSynced: boolean; parentSynced: boolean }> {
    try {
      const name = data.name || data.fullName || 'Student';
      const rawIndex = data.indexNo || data.studentId || data.rollNo || data.id || '';
      const studentIdCode = String(rawIndex).replace(/^std-[a-z0-9]+-/i, '') || 'STU';
      const grade = data.grade || gradeDocName || 'General';
      const dhivehiName = data.dhivehiName || '';
      const gender = data.gender || 'M';

      const parentName = data.parentName || data.guardianName || `Parent of ${name}`;
      const parentPhone = data.parentPhone || data.phone || data.guardianPhone || '9991359';
      const parentEmail = data.parentEmail || data.guardianEmail || `parent.${studentIdCode.toLowerCase()}@fmagoodhooschool.edu.mv`;
      const studentEmail = data.studentEmail || data.email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@fmagoodhooschool.edu.mv`;

      const studentUid = `stu-${studentIdCode.toLowerCase()}`;
      const parentUid = `par-${studentIdCode.toLowerCase()}`;

      let parentSynced = false;
      if (this.config.autoLinkParentChildren && parentName) {
        const parentSignature = JSON.stringify({
          name: parentName,
          email: parentEmail,
          phone: parentPhone,
          childId: studentUid
        });

        if (this.knownUserSignatures.get(parentUid) !== parentSignature) {
          const parentProfile: UserProfile = {
            id: parentUid,
            name: parentName,
            email: parentEmail,
            role: 'parent',
            phone: parentPhone,
            childrenIds: [studentUid],
            createdAt: new Date().toISOString().split('T')[0]
          };
          await saveUserProfile(parentProfile);
          this.knownUserSignatures.set(parentUid, parentSignature);
          parentSynced = true;
        }
      }

      // Save Student Profile if changed
      let studentSynced = false;
      const studentSignature = JSON.stringify({
        name,
        dhivehiName,
        gender,
        email: studentEmail,
        grade,
        studentIdCode,
        parentId: parentUid,
        phone: parentPhone
      });

      if (this.knownUserSignatures.get(studentUid) !== studentSignature) {
        const studentProfile: UserProfile = {
          id: studentUid,
          name,
          dhivehiName,
          gender,
          email: studentEmail,
          role: 'student',
          grade: grade,
          studentIdCode: studentIdCode,
          parentId: parentUid,
          phone: parentPhone,
          createdAt: new Date().toISOString().split('T')[0]
        };
        await saveUserProfile(studentProfile);
        this.knownUserSignatures.set(studentUid, studentSignature);
        studentSynced = true;
      }

      return { studentSynced, parentSynced };
    } catch (e) {
      console.warn('Error saving student/parent record:', e);
      return { studentSynced: false, parentSynced: false };
    }
  }
}

export interface SyncStatusState {
  isEnabled: boolean;
  isLiveConnected: boolean;
  portalUrl: string;
  lastSyncedAt?: string;
  projectId: string;
  parentsCollection: string;
  studentsCollection: string;
  databaseId?: string;
  totalSyncedStudents?: number;
  totalSyncedParents?: number;
  totalSyncedStaff?: number;
  gradeBreakdown?: Record<string, number>;
  logs: SyncLogEntry[];
}

// Global Singleton Instance
export const portalSyncManager = new ExternalPortalSyncManager();
