import React, { useState } from 'react';
import { Users, UserPlus, Sparkles, Check, X, Shield, BookOpen, Search } from 'lucide-react';
import { UserProfile } from '../types';

interface AddParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: UserProfile[];
  onCreateParentAccount: (
    name: string,
    email: string,
    phone: string,
    linkedChildrenIds: string[],
    newChildData?: { name: string; grade: string; studentIdCode: string }
  ) => Promise<void>;
}

export const AddParentModal: React.FC<AddParentModalProps> = ({
  isOpen,
  onClose,
  allUsers,
  onCreateParentAccount
}) => {
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [phone, setPhone] = useState('(555) 392-1049');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Option to also register a new student child simultaneously
  const [createChildNow, setCreateChildNow] = useState(false);
  const [childName, setChildName] = useState('');
  const [childGrade, setChildGrade] = useState('Grade 6');
  const [childStudentIdCode, setChildStudentIdCode] = useState(`STU-${Math.floor(1000 + Math.random() * 9000)}`);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Filter only student accounts
  const studentUsers = allUsers.filter(u => u.role === 'student');

  const toggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !parentEmail.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateParentAccount(
        parentName.trim(),
        parentEmail.trim(),
        phone.trim(),
        selectedStudentIds,
        createChildNow && childName.trim() ? {
          name: childName.trim(),
          grade: childGrade,
          studentIdCode: childStudentIdCode.trim() || `STU-${Math.floor(1000 + Math.random() * 9000)}`
        } : undefined
      );

      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error('Error creating parent account:', err);
      setIsSubmitting(false);
    }
  };

  // Quick Preset Sample
  const handleApplyPreset = () => {
    const randomId = Math.floor(100 + Math.random() * 900);
    setParentName(`Parent User (${randomId})`);
    setParentEmail(`parent${randomId}@oakridge.edu`);
    setPhone('(555) 893-2041');
    if (studentUsers.length > 0) {
      setSelectedStudentIds([studentUsers[0].id]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-white/15 max-h-[90vh] overflow-y-auto space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Register New Parent Account</h3>
              <p className="text-xs text-slate-400">Create parent credentials and link student children for library oversight</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Sample Button */}
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between">
          <span className="text-xs text-purple-300 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" /> Fast Registration Demo
          </span>
          <button
            type="button"
            onClick={handleApplyPreset}
            className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1 rounded-xl transition shadow"
          >
            Fill Demo Parent Data
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Parent Name & Email */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Parent / Guardian Full Name *</label>
              <input
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                id="add-parent-name-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="e.g. s.jenkins@oakridge.edu"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  id="add-parent-email-input"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none"
                  id="add-parent-phone-input"
                />
              </div>
            </div>
          </div>

          {/* Link Existing Student Accounts */}
          <div className="space-y-2 bg-white/5 p-3.5 rounded-2xl border border-white/10">
            <label className="font-bold text-slate-300 flex items-center justify-between">
              <span>Link Existing Student Accounts ({selectedStudentIds.length} selected)</span>
              <span className="text-[10px] text-slate-400 font-normal">Click to select children</span>
            </label>

            {studentUsers.length === 0 ? (
              <p className="text-slate-400 text-[11px]">No student accounts currently in database.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {studentUsers.map(student => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleSelectStudent(student.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-400 text-white font-bold'
                          : 'bg-black/20 border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-white">{student.name} ({student.grade})</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {student.studentIdCode}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                        isSelected ? 'bg-purple-500 border-purple-400 text-white' : 'border-white/20'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Option: Create a New Child Account Right Now */}
          <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="create-child-checkbox" className="font-bold text-purple-300 text-xs flex items-center gap-1.5 cursor-pointer">
                <UserPlus className="w-4 h-4 text-purple-400" /> Also Register a New Student Child Profile Now
              </label>
              <input
                type="checkbox"
                id="create-child-checkbox"
                checked={createChildNow}
                onChange={(e) => setCreateChildNow(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 bg-black/40 border-purple-500/50"
              />
            </div>

            {createChildNow && (
              <div className="space-y-2 pt-2 border-t border-purple-500/20 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Child Name</label>
                    <input
                      type="text"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="e.g. Lucas Jenkins"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Grade</label>
                    <select
                      value={childGrade}
                      onChange={(e) => setChildGrade(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none"
                    >
                      <option value="Kindergarten">Kindergarten</option>
                      <option value="Grade 1">Grade 1</option>
                      <option value="Grade 2">Grade 2</option>
                      <option value="Grade 3">Grade 3</option>
                      <option value="Grade 4">Grade 4</option>
                      <option value="Grade 5">Grade 5</option>
                      <option value="Grade 6">Grade 6</option>
                      <option value="Grade 7">Grade 7</option>
                      <option value="Grade 8">Grade 8</option>
                      <option value="High School">High School</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Student Barcode / ID Code</label>
                  <input
                    type="text"
                    value={childStudentIdCode}
                    onChange={(e) => setChildStudentIdCode(e.target.value)}
                    placeholder="e.g. STU-2099"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-3 flex justify-end gap-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/10 text-slate-200 rounded-xl font-semibold hover:bg-white/20 transition border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center gap-2"
              id="submit-add-parent-btn"
            >
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? 'Creating Account...' : 'Register Parent Account'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
