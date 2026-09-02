import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
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
import localFirebaseConfig from '../../firebase-applet-config.json';

export interface ReportCardSyncConfig {
  enabled: boolean;
  portalUrl: string;
  projectId: string;
  apiKey: string;
  authDomain: string;
  databaseId?: string;
  parentsCollection: string;
  studentsCollection: string;
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
  projectId: localFirebaseConfig.projectId || 'fmagoodhooschool-reportcard',
  apiKey: localFirebaseConfig.apiKey || '',
  authDomain: localFirebaseConfig.authDomain || 'reportcard-fmagoodhooschool.firebaseapp.com',
  databaseId: localFirebaseConfig.firestoreDatabaseId || '(default)',
  parentsCollection: 'parents',
  studentsCollection: 'students',
  autoLinkParentChildren: true,
  fieldMapping: {
    studentIdField: 'studentId',
    studentNameField: 'name',
    gradeField: 'grade',
    parentNameField: 'parentName',
    parentPhoneField: 'phone',
    parentEmailField: 'email',
  }
};

const STORAGE_KEY = 'oakridge_reportcard_sync_config';
const LOGS_KEY = 'oakridge_reportcard_sync_logs';

class ExternalPortalSyncManager {
  private config: ReportCardSyncConfig = DEFAULT_SYNC_CONFIG;
  private externalApp: FirebaseApp | null = null;
  private externalDb: Firestore | null = null;
  private unsubscribers: Unsubscribe[] = [];
  private isListening = false;
  private listenersCount = 0;
  private logs: SyncLogEntry[] = [];
  private subscribers: ((status: SyncStatusState) => void)[] = [];

  constructor() {
    this.loadConfig();
    this.loadLogs();
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config = { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(saved) };
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
      logs: this.logs
    };
  }

  /**
   * Initializes or returns the target Firestore instance.
   * If same project, returns libraryDb; if different credentials provided, creates named FirebaseApp.
   */
  private getTargetFirestore(): Firestore {
    const isSameProject = !this.config.projectId || this.config.projectId === localFirebaseConfig.projectId;
    
    if (isSameProject) {
      return libraryDb;
    }

    if (!this.externalDb) {
      const appName = 'reportCardSyncApp';
      const existingApps = getApps();
      const existing = existingApps.find(a => a.name === appName);
      
      this.externalApp = existing || initializeApp({
        projectId: this.config.projectId,
        apiKey: this.config.apiKey || localFirebaseConfig.apiKey,
        authDomain: this.config.authDomain || `${this.config.projectId}.firebaseapp.com`
      }, appName);

      this.externalDb = (this.config.databaseId && this.config.databaseId !== '(default)')
        ? getFirestore(this.externalApp, this.config.databaseId)
        : getFirestore(this.externalApp);
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
      this.addLog('info', 'Connecting to Cloud Firestore real-time stream...', `Project: ${this.config.projectId}`);

      // 1. Listen to Students collection
      const studentsColName = this.config.studentsCollection || 'students';
      const unsubStudents = onSnapshot(
        collection(targetDb, studentsColName),
        async (snapshot) => {
          this.isListening = true;
          let count = 0;
          
          for (const change of snapshot.docChanges()) {
            const data = change.doc.data();
            const docId = change.doc.id;
            
            if (change.type === 'added' || change.type === 'modified') {
              count++;
              await this.processStudentAndParentRecord(docId, data);
            }
          }

          if (count > 0) {
            this.config.lastSyncedAt = new Date().toISOString();
            this.saveConfig();
            this.addLog('success', `⚡ Real-time sync: Received ${count} student/parent updates from Report Card portal`);
          }
          this.notifySubscribers();
        },
        (err) => {
          console.warn('Real-time sync students listener notice:', err);
          this.isListening = false;
          this.addLog('warning', `Live listener notification: ${err.message}`, 'Note: Check if Firestore rules permit read access or use webhook mode.');
          this.notifySubscribers();
        }
      );

      // 2. Listen to Parents collection if separate
      const parentsColName = this.config.parentsCollection || 'parents';
      let unsubParents: Unsubscribe | null = null;
      
      if (parentsColName !== studentsColName) {
        unsubParents = onSnapshot(
          collection(targetDb, parentsColName),
          async (snapshot) => {
            let count = 0;
            for (const change of snapshot.docChanges()) {
              if (change.type === 'added' || change.type === 'modified') {
                count++;
                await this.processParentRecord(change.doc.id, change.doc.data());
              }
            }
            if (count > 0) {
              this.config.lastSyncedAt = new Date().toISOString();
              this.saveConfig();
              this.addLog('success', `⚡ Real-time sync: Processed ${count} parent directory updates`);
            }
            this.notifySubscribers();
          },
          (err) => {
            console.warn('Real-time sync parents listener notice:', err);
          }
        );
      }

      this.unsubscribers = [unsubStudents];
      if (unsubParents) this.unsubscribers.push(unsubParents);
      this.isListening = true;
      this.addLog('success', '🟢 Real-time Cloud Firestore synchronization active and listening for live changes.');
      this.notifySubscribers();
    } catch (err: any) {
      this.isListening = false;
      this.addLog('error', 'Failed to attach live Firestore stream', err.message);
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
   * Manual Full Sync / Test Connection
   */
  public async performManualSync(): Promise<{ success: boolean; syncedStudents: number; syncedParents: number; message: string }> {
    this.addLog('info', 'Initiating manual sync check from Report Card portal...');
    try {
      const targetDb = this.getTargetFirestore();
      
      // Fetch Students
      const studentsSnap = await getDocs(collection(targetDb, this.config.studentsCollection || 'students'));
      let syncedStudents = 0;
      let syncedParents = 0;

      for (const d of studentsSnap.docs) {
        const res = await this.processStudentAndParentRecord(d.id, d.data());
        if (res.studentSynced) syncedStudents++;
        if (res.parentSynced) syncedParents++;
      }

      // Fetch Parents if separate collection
      if (this.config.parentsCollection && this.config.parentsCollection !== this.config.studentsCollection) {
        try {
          const parentsSnap = await getDocs(collection(targetDb, this.config.parentsCollection));
          for (const d of parentsSnap.docs) {
            const pRes = await this.processParentRecord(d.id, d.data());
            if (pRes) syncedParents++;
          }
        } catch (e) {
          // Parents might be embedded in students
        }
      }

      this.config.lastSyncedAt = new Date().toISOString();
      this.saveConfig();
      const msg = `Successfully synced ${syncedStudents} students and ${syncedParents} parents from Report Card Portal!`;
      this.addLog('success', msg);
      this.notifySubscribers();
      return { success: true, syncedStudents, syncedParents, message: msg };
    } catch (err: any) {
      const errMsg = `Manual sync connection failed: ${err.message}`;
      this.addLog('error', errMsg, 'Please verify Firestore security rules or database ID.');
      this.notifySubscribers();
      return { success: false, syncedStudents: 0, syncedParents: 0, message: errMsg };
    }
  }

  /**
   * Normalizes and saves a student & associated parent into the library Firestore
   */
  private async processStudentAndParentRecord(docId: string, data: any): Promise<{ studentSynced: boolean; parentSynced: boolean }> {
    try {
      const map = this.config.fieldMapping;
      
      const studentName = data[map.studentNameField] || data.name || data.studentName || data.fullName || 'Student';
      const studentIdCode = data[map.studentIdField] || data.studentId || data.admissionNo || data.indexNo || docId;
      const grade = data[map.gradeField] || data.grade || data.class || data.gradeClass || 'General';
      const studentEmail = data.email || data.studentEmail || `${studentIdCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@fmagoodhooschool.edu.mv`;

      // Extract Parent Info
      const parentName = data[map.parentNameField] || data.parentName || data.guardianName || data.fatherName || data.motherName;
      const parentPhone = data[map.parentPhoneField] || data.phone || data.parentPhone || data.guardianPhone || data.contact;
      const parentEmail = data[map.parentEmailField] || data.parentEmail || data.guardianEmail || (parentPhone ? `parent.${parentPhone.replace(/[^0-9]/g, '')}@fmagoodhooschool.edu.mv` : undefined);

      const studentUid = `stu-${studentIdCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      let parentUid: string | undefined = undefined;

      let parentSynced = false;
      if (parentName || parentPhone) {
        parentUid = `par-${(parentPhone || parentName).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const parentProfile: UserProfile = {
          id: parentUid,
          name: parentName || `Parent of ${studentName}`,
          email: parentEmail || `${parentUid}@fmagoodhooschool.edu.mv`,
          role: 'parent',
          phone: parentPhone || '',
          childrenIds: [studentUid],
          createdAt: new Date().toISOString().split('T')[0]
        };
        await saveUserProfile(parentProfile);
        parentSynced = true;
      }

      // Save Student Profile
      const studentProfile: UserProfile = {
        id: studentUid,
        name: studentName,
        email: studentEmail,
        role: 'student',
        grade: typeof grade === 'string' && !grade.toLowerCase().includes('grade') ? `Grade ${grade}` : grade,
        studentIdCode: studentIdCode,
        parentId: parentUid,
        createdAt: new Date().toISOString().split('T')[0]
      };
      await saveUserProfile(studentProfile);

      return { studentSynced: true, parentSynced };
    } catch (e) {
      console.warn('Error processing student/parent record:', e);
      return { studentSynced: false, parentSynced: false };
    }
  }

  /**
   * Normalizes and saves a dedicated Parent document
   */
  private async processParentRecord(docId: string, data: any): Promise<boolean> {
    try {
      const parentName = data.name || data.parentName || data.guardianName || 'Parent';
      const phone = data.phone || data.mobile || data.contactNo || '';
      const email = data.email || data.parentEmail || '';
      const childrenIds = Array.isArray(data.childrenIds || data.children || data.students)
        ? data.childrenIds || data.children || data.students
        : [];

      const parentUid = `par-${(phone || docId).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const parentProfile: UserProfile = {
        id: parentUid,
        name: parentName,
        email: email || `${parentUid}@fmagoodhooschool.edu.mv`,
        role: 'parent',
        phone: phone,
        childrenIds: childrenIds,
        createdAt: new Date().toISOString().split('T')[0]
      };

      await saveUserProfile(parentProfile);
      return true;
    } catch (e) {
      return false;
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
  logs: SyncLogEntry[];
}

// Global Singleton Instance
export const portalSyncManager = new ExternalPortalSyncManager();
