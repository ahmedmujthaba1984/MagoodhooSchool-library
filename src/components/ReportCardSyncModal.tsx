import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Database,
  Globe,
  Sliders,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Users,
  Radio,
  ArrowRight
} from 'lucide-react';
import {
  portalSyncManager,
  ReportCardSyncConfig,
  SyncStatusState,
  SyncLogEntry
} from '../lib/externalPortalSync';
import { useLanguage } from '../lib/i18n';

interface ReportCardSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportCardSyncModal: React.FC<ReportCardSyncModalProps> = ({ isOpen, onClose }) => {
  const { t, language, isRtl } = useLanguage();
  const [activeTab, setActiveTab] = useState<'realtime' | 'webhook' | 'mapping' | 'logs'>('realtime');
  const [config, setConfig] = useState<ReportCardSyncConfig>(portalSyncManager.getConfig());
  const [status, setStatus] = useState<SyncStatusState>(portalSyncManager.getStatus());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);

  useEffect(() => {
    const unsub = portalSyncManager.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const webhookUrl = `${window.location.origin}/api/sync/reportcard-directory`;

  const handleSaveConfig = () => {
    portalSyncManager.updateConfig(config);
    setTestResult({
      success: true,
      message: language === 'dv' ? 'ކަނޑައެޅުންތައް ރައްކާކުރެވި، ލައިވް ސިންކް އަޕްޑޭޓް ކުރެވިއްޖެ!' : 'Configuration saved & Real-time Live Sync active!'
    });
  };

  const handleManualSyncNow = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await portalSyncManager.performManualSync();
      setTestResult({
        success: res.success,
        message: res.message,
        count: res.syncedStudents + res.syncedParents
      });
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Failed to sync'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleSimulateWebhook = async () => {
    setIsSimulatingWebhook(true);
    try {
      const mockPayload = {
        event: 'parent_student_sync',
        timestamp: new Date().toISOString(),
        data: [
          {
            studentId: 'STU-9901',
            name: 'Hussain Shifaz',
            grade: 'Grade 8A',
            parentName: 'Ibrahim Rasheed',
            phone: '+960 7789012',
            email: 'ibrahim.rasheed@example.com'
          },
          {
            studentId: 'STU-9902',
            name: 'Mariyam Fazna',
            grade: 'Grade 9B',
            parentName: 'Aishath Zareena',
            phone: '+960 7901234',
            email: 'aishath.zareena@example.com'
          }
        ]
      };

      const res = await fetch('/api/sync/reportcard-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: language === 'dv'
            ? 'ވެބްހުކް ޓެސްޓް ކާމިޔާބު: ރިޕޯޓް ކާޑު ޕޯޓަލުން 2 ދަރިވަރުން އަދި ބެލެނިވެރިން ސިންކް ކުރެވިއްޖެ!'
            : `Webhook Test Successful: Synced ${data.syncedCount || 2} records from Report Card portal!`
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Webhook test failed'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Webhook simulation failed: ${err.message}`
      });
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް ލައިވް ސިންކް' : 'Report Card Portal Real-Time Live Sync'}
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Cloud Firestore
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Target: </span>
                <span className="text-indigo-200 font-bold underline underline-offset-2">https://reportcard-fmagoodhooschool.vercel.app/</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Ribbon */}
        <div className="bg-indigo-50/80 px-5 sm:px-6 py-2.5 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${status.isLiveConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
            <span className="font-bold text-slate-800">
              {language === 'dv' ? 'ސިންކް ޙާލަތު:' : 'Live Stream Status:'}
            </span>
            {status.isLiveConnected ? (
              <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {language === 'dv' ? 'ގުޅިފައި (ހުރިހާ ބަދަލެއް ވަގުތުން ސިންކް ވާނެ)' : 'Live Connected (Instant onSnapshot stream)'}
              </span>
            ) : (
              <span className="text-amber-700 font-extrabold">
                {language === 'dv' ? 'ވަގުތީގޮތުން މެދުކެނޑިފައި' : 'Ready / Standing By'}
              </span>
            )}
          </div>

          {status.lastSyncedAt && (
            <div className="text-[11px] text-slate-500 font-medium">
              {language === 'dv' ? 'އެންމެ ފަހުން ސިންކްވީ:' : 'Last Synced:'}{' '}
              <span className="font-bold text-slate-700">{new Date(status.lastSyncedAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 px-5 sm:px-6 gap-2 overflow-x-auto bg-white pt-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('realtime')}
            className={`pb-3 px-3 text-xs font-black transition cursor-pointer flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'realtime'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            {language === 'dv' ? 'ކްލައުޑް ފަޔަރސްޓޯރ ލައިވް ސްޓްރީމް' : 'Cloud Firestore Live Stream'}
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`pb-3 px-3 text-xs font-black transition cursor-pointer flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'webhook'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            {language === 'dv' ? 'އޮޓޯ ވެބްހުކް / API' : 'Auto Webhook / API Push'}
          </button>

          <button
            onClick={() => setActiveTab('mapping')}
            className={`pb-3 px-3 text-xs font-black transition cursor-pointer flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'mapping'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            {language === 'dv' ? 'ފީލްޑް މެޕިންގ' : 'Field Schema Mapping'}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-3 text-xs font-black transition cursor-pointer flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            {language === 'dv' ? 'ލައިވް ލޮގްތައް' : 'Live Sync Logs'}
            {status.logs.length > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {status.logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 max-h-[60vh] overflow-y-auto space-y-5">
          
          {/* Result Banner */}
          {testResult && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs animate-in fade-in duration-200 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-extrabold">{testResult.message}</div>
                {testResult.success && testResult.count !== undefined && (
                  <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                    {language === 'dv'
                      ? 'މެންބަރުންގެ ޑައިރެކްޓަރީ އަދި ބެލެނިވެރިންގެ ޕޯޓަލް ވަނީ ފުރިހަމައަށް އަޕްޑޭޓްވެފައެވެ.'
                      : 'Member Directory and Parent Portals are now synced with latest records.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: REAL-TIME FIRESTORE LISTENER */}
          {activeTab === 'realtime' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-black text-sm text-slate-900">
                    {language === 'dv' ? 'އޮޓޮމެޓިކް ލައިވް ސިންކް އެކްޓިވް ކުރައްވާ' : 'Enable Real-Time Cloud Firestore Sync'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {language === 'dv'
                      ? 'ރިޕޯޓް ކާޑު ޕޯޓަލްގައި ކޮންމެ ބަދަލެއް ގެނައުމުން މި ލައިބްރަރީއަށް ވަގުތުން ސިންކް ވާނެ'
                      : 'Automatically reflects student/parent updates made on reportcard-fmagoodhooschool.vercel.app'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ޓާގެޓް ޕޯޓަލް ޔޫ.އާރު.އެލް' : 'Target Portal URL'}
                  </label>
                  <input
                    type="text"
                    value={config.portalUrl}
                    onChange={(e) => setConfig({ ...config, portalUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ފަޔަރބޭސް ޕްރޮޖެކްޓް އައިޑީ' : 'Firebase Project ID'}
                  </label>
                  <input
                    type="text"
                    value={config.projectId}
                    onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ދަރިވަރުންގެ ކަލެކްޝަން ނަން' : 'Students Collection Name in Firestore'}
                  </label>
                  <input
                    type="text"
                    value={config.studentsCollection}
                    onChange={(e) => setConfig({ ...config, studentsCollection: e.target.value })}
                    placeholder="students"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ބެލެނިވެރިންގެ ކަލެކްޝަން ނަން' : 'Parents Collection Name in Firestore'}
                  </label>
                  <input
                    type="text"
                    value={config.parentsCollection}
                    onChange={(e) => setConfig({ ...config, parentsCollection: e.target.value })}
                    placeholder="parents"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-hidden"
                  />
                </div>
              </div>

              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div className="text-xs text-indigo-900 font-medium">
                    <span className="font-extrabold">{language === 'dv' ? 'އޮޓޯ ލިންކިންގ:' : 'Auto Parent-Child Linking:'} </span>
                    {language === 'dv'
                      ? 'ދަރިވަރުންގެ ޕްރޮފައިލާއި ބެލެނިވެރިޔާގެ ފޯނު ނަންބަރު ވަގުތުން ގުޅުވައިދޭނެއެވެ.'
                      : 'Automatically attaches parent contacts to their children student profiles.'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSyncNow}
                    disabled={isTesting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? (language === 'dv' ? 'ސިންކް ވަނީ...' : 'Syncing...') : (language === 'dv' ? 'ޓެސްޓް / މިހާރު ސިންކްކުރައްވާ' : 'Test & Sync Now')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WEBHOOK / DIRECT API PUSH */}
          {activeTab === 'webhook' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  {language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލްގެ ވެބްހުކް ޔޫ.އާރު.އެލް' : 'Instant Webhook Receiver URL for Report Card Portal'}
                </div>
                <p className="text-xs text-slate-600">
                  {language === 'dv'
                    ? 'ރިޕޯޓް ކާޑު ޕޯޓަލްގެ ސާވަރ އެކްޝަން ނުވަތަ ޑޭޓާބޭސް އިވެންޓުގައި މި ޔޫ.އާރު.އެލް އަށް POST ރިކުއެސްޓެއް ފޮނުވާލުމުން ވަގުތުން ލައިބްރަރީއަށް ސިންކް ވާނެއެވެ.'
                    : 'Configure this webhook endpoint in the Report Card portal to trigger an immediate push update whenever a student/parent is registered or edited.'}
                </p>

                <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl p-2 font-mono text-xs text-slate-800 break-all">
                  <span className="flex-1 font-bold">{webhookUrl}</span>
                  <button
                    onClick={handleCopyWebhook}
                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Sample Webhook JSON format */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {language === 'dv' ? 'ފޮނުވަންވީ ސާމްޕަލް JSON ފޯމެޓް:' : 'Sample JSON Payload Format:'}
                </label>
                <div className="bg-slate-950 text-indigo-200 rounded-2xl p-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto">
{`// POST ${webhookUrl}
{
  "event": "student_updated",
  "data": [
    {
      "studentId": "STU-1029",
      "name": "Fathimath Rishfa",
      "grade": "Grade 8A",
      "parentName": "Ahmed Zaki",
      "phone": "+960 7712345",
      "email": "ahmed.zaki@example.com"
    }
  ]
}`}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSimulateWebhook}
                  disabled={isSimulatingWebhook}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${isSimulatingWebhook ? 'animate-bounce' : ''}`} />
                  <span>{isSimulatingWebhook ? (language === 'dv' ? 'ޓެސްޓް ވަނީ...' : 'Simulating...') : (language === 'dv' ? 'ސާމްޕަލް ވެބްހުކް ޓެސްޓްކުރައްވާ' : 'Simulate Sample Webhook Push')}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SCHEMA MAPPING */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                {language === 'dv'
                  ? 'ރިޕޯޓް ކާޑު ޕޯޓަލްގެ ފަޔަރސްޓޯރ ޑޮކިއުމަންޓުގައި ހުރި ފީލްޑްތައް މި ލައިބްރަރީއާ ގުޅުވައިދޭށެވެ.'
                  : 'Map the document field names from reportcard-fmagoodhooschool.vercel.app to the Library System schema:'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student ID Field Key
                  </label>
                  <input
                    type="text"
                    value={config.fieldMapping.studentIdField}
                    onChange={(e) => setConfig({
                      ...config,
                      fieldMapping: { ...config.fieldMapping, studentIdField: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student Name Field Key
                  </label>
                  <input
                    type="text"
                    value={config.fieldMapping.studentNameField}
                    onChange={(e) => setConfig({
                      ...config,
                      fieldMapping: { ...config.fieldMapping, studentNameField: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Grade / Class Field Key
                  </label>
                  <input
                    type="text"
                    value={config.fieldMapping.gradeField}
                    onChange={(e) => setConfig({
                      ...config,
                      fieldMapping: { ...config.fieldMapping, gradeField: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent / Guardian Name Key
                  </label>
                  <input
                    type="text"
                    value={config.fieldMapping.parentNameField}
                    onChange={(e) => setConfig({
                      ...config,
                      fieldMapping: { ...config.fieldMapping, parentNameField: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent Phone / Mobile Key
                  </label>
                  <input
                    type="text"
                    value={config.fieldMapping.parentPhoneField}
                    onChange={(e) => setConfig({
                      ...config,
                      fieldMapping: { ...config.fieldMapping, parentPhoneField: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent Email Key
                  </label>
                  <input
                    type="text"
                    value={config.fieldMapping.parentEmailField}
                    onChange={(e) => setConfig({
                      ...config,
                      fieldMapping: { ...config.fieldMapping, parentEmailField: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE SYNC LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{language === 'dv' ? 'ހިނގަމުންދާ ސިންކް ހަރަކާތްތަކުގެ ލޮގް:' : 'Real-time Sync Stream Activity Log:'}</span>
                <span className="text-slate-400 font-mono text-[11px]">{status.logs.length} entries</span>
              </div>

              {status.logs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
                  {language === 'dv' ? 'އަދި އެއްވެސް ލޮގެއް ނެތެވެ.' : 'No sync activities recorded yet. Click "Test & Sync Now" to run.'}
                </div>
              ) : (
                <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-xs space-y-2 max-h-72 overflow-y-auto">
                  {status.logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-[11px] border-b border-slate-900/60 pb-1.5 last:border-0">
                      <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                      <span className={`font-bold shrink-0 ${
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'error' ? 'text-rose-400' :
                        log.type === 'warning' ? 'text-amber-400' : 'text-indigo-400'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                      <span className="text-slate-300 flex-1">{log.message}</span>
                      {log.details && <span className="text-slate-500 text-[10px] truncate max-w-[150px]">{log.details}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {language === 'dv' ? 'ބަންދުކުރައްވާ' : 'Close'}
          </button>

          <button
            onClick={handleSaveConfig}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{language === 'dv' ? 'ކަނޑައެޅުންތައް ރައްކާކުރައްވާ' : 'Save & Activate Live Sync'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
