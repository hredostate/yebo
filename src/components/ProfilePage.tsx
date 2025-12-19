


import React, { useState, useRef, useMemo } from 'react';
import type { UserProfile, Order, StaffCertification } from '../types';
import Spinner from './common/Spinner';
import { LockClosedIcon, ShoppingCartIcon } from './common/icons';
import { NIGERIAN_BANKS } from '../constants/banks';


interface ProfilePageProps {
  userProfile: UserProfile;
  onUpdateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  onUpdateAvatar: (file: File) => Promise<string | null>;
  onResetPassword: () => Promise<void>;
  onUpdateEmail: (newEmail: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  certifications: StaffCertification[];
  onUploadCertification: (file: File, metadata?: { certification_type?: string; certification_number?: string; expiry_date?: string }) => Promise<boolean>;
  onDeleteCertification: (id: number) => Promise<boolean>;
  onGetCertificationUrl: (certification: StaffCertification) => Promise<string | null>;
  orders?: Order[]; // Optional to maintain backward compatibility if passed from App
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userProfile, onUpdateProfile, onUpdateAvatar, onResetPassword, onUpdateEmail, onUpdatePassword, certifications, onUploadCertification, onDeleteCertification, onGetCertificationUrl, orders = [] }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'orders'>('details');

  const [formData, setFormData] = useState({
      name: userProfile.name,
      phone_number: userProfile.phone_number || '',
      description: userProfile.description || '',
      bank_code: userProfile.bank_code || '',
      account_number: userProfile.account_number || '',
      account_name: userProfile.account_name || '',
      base_pay: userProfile.base_pay || '',
      commission: userProfile.commission || '',
  });
  const [newEmail, setNewEmail] = useState('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [certForm, setCertForm] = useState({ certification_type: '', certification_number: '', expiry_date: '' });
  const [activeLinkRequest, setActiveLinkRequest] = useState<number | null>(null);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  
  const getInitials = (userName: string) => (userName || '').split(' ').map(n => n[0]).join('').toUpperCase();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const bankName = NIGERIAN_BANKS.find(b => b.code === formData.bank_code)?.name || null;
    const success = await onUpdateProfile({
        name: formData.name,
        phone_number: formData.phone_number,
        description: formData.description,
        bank_code: formData.bank_code,
        bank_name: bankName,
        account_number: formData.account_number,
        account_name: formData.account_name,
    });
    if (success) {
        setIsEditing(false);
    }
    setIsSaving(false);
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
        name: userProfile.name,
        phone_number: userProfile.phone_number || '',
        description: userProfile.description || '',
        bank_code: userProfile.bank_code || '',
        account_number: userProfile.account_number || '',
        account_name: userProfile.account_name || '',
        base_pay: userProfile.base_pay || '',
        commission: userProfile.commission || '',
    });
  };

  const handleAvatarClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsUploading(true);
        await onUpdateAvatar(file);
        setIsUploading(false);
    }
  };
  
  const handleUpdateEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newEmail.trim()) return;
    await onUpdateEmail(newEmail);
    setIsEmailModalOpen(false);
    setNewEmail('');
  }

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newPassword.trim()) return;
      await onUpdatePassword(newPassword);
      setIsPasswordModalOpen(false);
      setNewPassword('');
  }

  const myCertifications = useMemo(
      () => certifications.filter(cert => cert.staff_id === userProfile.id),
      [certifications, userProfile.id]
  );

  const canDeleteCertification = (cert: StaffCertification) =>
      cert.staff_id === userProfile.id || ['Admin', 'Principal', 'Team Lead'].includes(userProfile.role);

  const handleCertificationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setCertForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCertificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingCert(true);
      const success = await onUploadCertification(file, {
          certification_type: certForm.certification_type || undefined,
          certification_number: certForm.certification_number || undefined,
          expiry_date: certForm.expiry_date || undefined,
      });
      setIsUploadingCert(false);
      e.target.value = '';

      if (success) {
          setCertForm({ certification_type: '', certification_number: '', expiry_date: '' });
      }
  };

  const handleViewCertification = async (cert: StaffCertification) => {
      setActiveLinkRequest(cert.id);
      const url = await onGetCertificationUrl(cert);
      setActiveLinkRequest(null);
      if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
      }
  };
  
  const myOrders = useMemo(() => {
      return orders.filter(o => o.user_id === userProfile.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, userProfile.id]);

  const inputClasses = "w-full p-2 bg-transparent border-b disabled:border-transparent enabled:border-slate-300 focus:outline-none focus:border-blue-500";
  const selectClasses = "w-full p-2 bg-transparent border-b disabled:bg-transparent enabled:border-slate-300 focus:outline-none focus:border-blue-500 disabled:appearance-none";
  const lockedInputClasses = "w-full p-2 bg-slate-100 dark:bg-slate-800 border-b border-transparent text-slate-500 cursor-not-allowed rounded-md";

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Profile</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">View and manage your account details.</p>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <div onClick={handleAvatarClick} className="w-24 h-24 bg-blue-200 rounded-full flex items-center justify-center text-4xl font-bold text-blue-700 ring-4 ring-blue-300/50 flex-shrink-0 cursor-pointer overflow-hidden">
                {isUploading ? <Spinner/> : userProfile.avatar_url ? <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : getInitials(userProfile.name)}
            </div>
             <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handleAvatarClick}>
                Upload
            </div>
          </div>
          {/* Info */}
          <div className="flex-grow text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{userProfile.name}</h2>
              <p className="text-slate-500 dark:text-slate-400">{userProfile.email}</p>
              <div className="mt-2 flex items-center justify-center md:justify-start gap-4">
                <span className="inline-block px-3 py-1 text-sm font-semibold rounded-full bg-slate-500/20 text-slate-700 dark:text-slate-200">
                    {userProfile.role}
                </span>
                {userProfile.staff_code && (
                    <span className="inline-block px-3 py-1 text-sm font-mono rounded-full bg-slate-500/20 text-slate-700 dark:text-slate-200">
                        {userProfile.staff_code}
                    </span>
                )}
              </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mt-8 border-b border-slate-200 dark:border-slate-700 flex space-x-6">
             <button 
                onClick={() => setActiveTab('details')}
                className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'details' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 Personal Details
             </button>
             <button 
                onClick={() => setActiveTab('orders')}
                className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <ShoppingCartIcon className="w-4 h-4" />
                 Order History
             </button>
        </div>

        {activeTab === 'details' && (
            <div className="mt-6 space-y-4 animate-fade-in">
                <div className="flex justify-end">
                     {!isEditing && <button onClick={() => setIsEditing(true)} className="text-sm px-4 py-2 bg-blue-600/10 text-blue-700 dark:text-blue-200 dark:bg-blue-500/20 font-semibold rounded-lg">Edit</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Personal Info */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Full Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} disabled={!isEditing} className={inputClasses} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phone Number</label>
                        <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleInputChange} disabled={!isEditing} placeholder={isEditing ? 'Enter phone number' : 'Not set'} className={inputClasses} />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">About Me / Role Description</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} disabled={!isEditing} placeholder={isEditing ? 'Describe your role or teaching philosophy...' : 'Not set'} rows={3} className="w-full p-2 bg-transparent border-b disabled:border-transparent enabled:border-slate-300 focus:outline-none focus:border-blue-500"></textarea>
                </div>
                
                {/* Bank Details */}
                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Payroll Information</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Base Pay (NGN)</label>
                                <LockClosedIcon className="w-3 h-3 text-slate-400"/>
                            </div>
                            <input type="number" name="base_pay" value={formData.base_pay} disabled className={lockedInputClasses} title="Contact Administrator to modify" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Commission (NGN)</label>
                                <LockClosedIcon className="w-3 h-3 text-slate-400"/>
                            </div>
                            <input type="number" name="commission" value={formData.commission} disabled className={lockedInputClasses} title="Contact Administrator to modify" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bank Name</label>
                            <select name="bank_code" value={formData.bank_code} onChange={handleInputChange} disabled={!isEditing} className={selectClasses}>
                                <option value="">Select Bank</option>
                                {NIGERIAN_BANKS.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Account Number</label>
                            <input type="text" name="account_number" value={formData.account_number} onChange={handleInputChange} disabled={!isEditing} placeholder={isEditing ? '10-digit NUBAN' : 'Not set'} className={inputClasses} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Account Name</label>
                            <input type="text" name="account_name" value={formData.account_name} onChange={handleInputChange} disabled={!isEditing} placeholder={isEditing ? 'Full name as on account' : 'Not set'} className={inputClasses} />
                        </div>
                    </div>
                    {isEditing && <p className="text-xs text-amber-600 mt-2 italic flex items-center gap-1"><LockClosedIcon className="w-3 h-3"/> Base Pay and Commission are managed by the Administrator.</p>}
                </div>

                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Teacher Certification</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Upload TRCN, NCE, B.Ed, or other Nigerian teaching credentials. Files stay private and use signed links.</p>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${myCertifications.length ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                            {myCertifications.length ? 'Uploaded' : 'Missing'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Certification Type</label>
                            <input
                                type="text"
                                name="certification_type"
                                value={certForm.certification_type}
                                onChange={handleCertificationInputChange}
                                placeholder="e.g. TRCN, NCE"
                                className="w-full p-2 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Certificate Number</label>
                            <input
                                type="text"
                                name="certification_number"
                                value={certForm.certification_number}
                                onChange={handleCertificationInputChange}
                                placeholder="Optional"
                                className="w-full p-2 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Expiry Date</label>
                            <input
                                type="date"
                                name="expiry_date"
                                value={certForm.expiry_date}
                                onChange={handleCertificationInputChange}
                                className="w-full p-2 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center mt-4">
                        <input ref={certFileInputRef} type="file" className="hidden" accept="application/pdf,image/png,image/jpeg" onChange={handleCertificationUpload} />
                        <button
                            type="button"
                            onClick={() => certFileInputRef.current?.click()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
                            disabled={isUploadingCert}
                        >
                            {isUploadingCert && <Spinner size="sm" />}
                            Upload Certification
                        </button>
                        <p className="text-xs text-slate-500 dark:text-slate-400">PDF/JPG/PNG, max 10MB. Filenames are sanitized automatically.</p>
                    </div>

                    <div className="mt-4 space-y-3">
                        {myCertifications.length === 0 && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">No certifications uploaded yet.</p>
                        )}

                        {myCertifications.map(cert => (
                            <div key={cert.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-white">{cert.certification_type || 'Certification'}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 flex flex-wrap gap-2 mt-1">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 text-xs font-semibold">{cert.file_name}</span>
                                        {cert.certification_number && <span className="text-xs">Number: {cert.certification_number}</span>}
                                        {cert.expiry_date && <span className="text-xs">Expires: {new Date(cert.expiry_date).toLocaleDateString()}</span>}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Uploaded {new Date(cert.uploaded_at).toLocaleString()} {cert.uploader?.name ? `by ${cert.uploader.name}` : ''}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleViewCertification(cert)}
                                        className="px-3 py-2 rounded-lg bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center gap-2"
                                    >
                                        {activeLinkRequest === cert.id ? <Spinner size="sm" /> : 'View'}
                                    </button>
                                    {canDeleteCertification(cert) && (
                                        <button
                                            type="button"
                                            onClick={() => onDeleteCertification(cert.id)}
                                            className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {isEditing && (
                    <div className="flex justify-end space-x-2">
                        <button onClick={handleCancel} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center">{isSaving && <Spinner size="sm" />}<span className={isSaving ? 'ml-2' : ''}>Save Changes</span></button>
                    </div>
                )}
                
                <div className="pt-6 mt-6 border-t border-slate-200/60 dark:border-slate-700/60">
                     <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Account Security</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-500/10 rounded-lg flex justify-between items-center">
                            <span className="text-sm">Update your login email.</span>
                            <button onClick={() => setIsEmailModalOpen(true)} className="font-semibold text-blue-600 hover:underline text-sm">Update Email</button>
                        </div>
                        <div className="p-4 bg-slate-500/10 rounded-lg flex justify-between items-center">
                            <span className="text-sm">Change your password.</span>
                            <button onClick={() => setIsPasswordModalOpen(true)} className="font-semibold text-blue-600 hover:underline text-sm">Change Password</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'orders' && (
            <div className="mt-6 animate-fade-in">
                {myOrders.length > 0 ? (
                    <div className="space-y-4">
                        {myOrders.map(order => (
                            <div key={order.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white">Order #{order.id}</p>
                                        <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                            order.status === 'Paid' ? 'bg-blue-100 text-blue-800' : 
                                            order.status === 'Delivered' ? 'bg-green-100 text-green-800' : 
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>{order.status}</span>
                                        <p className="font-bold mt-1">₦{Number(order.total_amount).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    {order.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-slate-700 dark:text-slate-300">{item.quantity}x {item.inventory_item?.name || 'Item'}</span>
                                            <span className="text-slate-500">₦{(item.quantity * Number(item.unit_price)).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <p className="text-slate-500">No recent orders found.</p>
                        <p className="text-sm text-slate-400">Visit the School Store to make a purchase.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
             <form onSubmit={handleUpdateEmailSubmit} className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-lg max-w-sm w-full space-y-4">
                <h3 className="font-bold">Update Email Address</h3>
                <p className="text-sm text-slate-500">A confirmation will be sent to both your old and new email addresses.</p>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="Enter new email" className="w-full p-2 border rounded-md" />
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsEmailModalOpen(false)} className="px-3 py-1 bg-slate-200 rounded-md">Cancel</button>
                    <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded-md">Submit</button>
                </div>
             </form>
        </div>
      )}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
             <form onSubmit={handleUpdatePasswordSubmit} className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-lg max-w-sm w-full space-y-4">
                <h3 className="font-bold">Update Password</h3>
                <p className="text-sm text-slate-500">Enter your new password below.</p>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="New password" className="w-full p-2 border rounded-md" />
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-3 py-1 bg-slate-200 rounded-md">Cancel</button>
                    <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded-md">Update</button>
                </div>
             </form>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
