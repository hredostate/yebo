
import React, { useState } from 'react';
import type { Student, BaseDataObject, StudentFormData } from '../types';
import { StudentStatus } from '../types';
import { STUDENT_STATUSES } from '../constants';
import Spinner from './common/Spinner';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStudent: (studentData: StudentFormData) => Promise<boolean>;
  allClasses: BaseDataObject[];
  allArms: BaseDataObject[];
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onAddStudent, allClasses, allArms }) => {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [status, setStatus] = useState<StudentStatus>(StudentStatus.DistanceLearner);
  const [parentPhoneNumber1, setParentPhoneNumber1] = useState('');
  const [parentPhoneNumber2, setParentPhoneNumber2] = useState('');
  const [classId, setClassId] = useState<string>('');
  const [armId, setArmId] = useState<string>('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !dob) {
      setError('Please fill in name and date of birth.');
      return;
    }
    setIsSaving(true);
    const success = await onAddStudent({
      name,
      date_of_birth: dob,
      status,
      reward_points: 0,
      parent_phone_number_1: parentPhoneNumber1,
      parent_phone_number_2: parentPhoneNumber2,
      class_id: classId ? Number(classId) : null,
      arm_id: armId ? Number(armId) : null,
      address,
      email,
    });
    
    if (success) {
        // Reset form on success
        setName('');
        setDob('');
        setStatus(StudentStatus.DistanceLearner);
        setParentPhoneNumber1('');
        setParentPhoneNumber2('');
        setClassId('');
        setArmId('');
        setAddress('');
        setEmail('');
    } else {
        setError('An error occurred. Please try again.');
    }
    setIsSaving(false);
  };
  
  const commonInputClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base rounded-xl border border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-md m-4">
        <form onSubmit={handleSubmit}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Add New Student Record</h2>
          {error && <p className="text-red-500 text-sm mb-4 bg-red-500/10 p-2 rounded-md">{error}</p>}
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <label htmlFor="student-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
              <input type="text" id="student-name" value={name} onChange={e => setName(e.target.value)} required className={commonInputClasses} />
            </div>
            <div>
              <label htmlFor="student-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email (Optional)</label>
              <input type="email" id="student-email" value={email} onChange={e => setEmail(e.target.value)} className={commonInputClasses} placeholder="student@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="student-class" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Class</label>
                  <select id="student-class" value={classId} onChange={e => setClassId(e.target.value)} className={commonInputClasses}>
                    <option value="">Select Class...</option>
                    {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="student-arm" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Arm</label>
                  <select id="student-arm" value={armId} onChange={e => setArmId(e.target.value)} className={commonInputClasses}>
                    <option value="">Select Arm...</option>
                    {allArms.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
            </div>
             <div>
              <label htmlFor="student-dob" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date of Birth</label>
              <input type="date" id="student-dob" value={dob} onChange={e => setDob(e.target.value)} required className={commonInputClasses} />
            </div>
             <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
              <textarea id="address" value={address} onChange={e => setAddress(e.target.value)} rows={2} className={commonInputClasses}></textarea>
            </div>
            <div>
              <label htmlFor="parent-phone-1" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Parent's Phone Number 1</label>
              <input type="tel" id="parent-phone-1" value={parentPhoneNumber1} onChange={e => setParentPhoneNumber1(e.target.value)} className={commonInputClasses} />
            </div>
             <div>
              <label htmlFor="parent-phone-2" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Parent's Phone Number 2</label>
              <input type="tel" id="parent-phone-2" value={parentPhoneNumber2} onChange={e => setParentPhoneNumber2(e.target.value)} className={commonInputClasses} />
            </div>
            <div>
              <label htmlFor="student-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <select id="student-status" value={status} onChange={e => setStatus(e.target.value as StudentStatus)} className={commonInputClasses}>
                {STUDENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center min-w-[120px] justify-center">
              {isSaving ? <Spinner size="sm" /> : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AddStudentModal;
