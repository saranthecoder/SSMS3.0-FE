import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { UserCheck, Plus, Search, Edit2, Trash2, Mail, Phone, BookOpen, Shield, MessageSquare, X, Eye } from 'lucide-react';

export default function MentorManagement() {
  const navigate = useNavigate();
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMentor, setEditingMentor] = useState(null);
  const [viewingMentor, setViewingMentor] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });

  const fetchMentors = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/mentors');
      setMentors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching mentors:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to fetch mentors', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMentors();
  }, []);

  const handleOpenModal = (mentor = null) => {
    if (mentor) {
      setEditingMentor(mentor);
      setFormData({
        name: mentor.name || '',
        email: mentor.email || '',
        phone: mentor.phone || '',
        password: '' // optional when editing
      });
    } else {
      setEditingMentor(null);
      setFormData({ name: '', email: '', phone: '', password: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMentor(null);
    setFormData({ name: '', email: '', phone: '', password: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMentor) {
        await axios.put(`/mentors/${editingMentor._id}`, formData);
        Swal.fire('Updated!', 'Mentor updated successfully.', 'success');
      } else {
        if (!formData.password || formData.password.length < 6) {
          return Swal.fire('Error', 'Password must be at least 6 characters', 'warning');
        }
        await axios.post('/mentors', formData);
        Swal.fire('Created!', 'Mentor created successfully.', 'success');
      }
      handleCloseModal();
      fetchMentors();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: `Delete ${name}?`,
      text: "This mentor will be unassigned from all batches and removed.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete mentor'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/mentors/${id}`);
        Swal.fire('Deleted!', 'Mentor removed successfully.', 'success');
        fetchMentors();
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Failed to delete mentor', 'error');
      }
    }
  };

  const filteredMentors = mentors.filter(m =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-left">
      {/* Header Banner - Responsive Light/Dark */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/25">
            <UserCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Mentor Management</h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-medium mt-0.5">Create, inspect profiles, and assign mentor accounts for batch access control</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-105 cursor-pointer text-xs uppercase tracking-wider"
        >
          <Plus size={18} />
          Add New Mentor
        </button>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search mentors by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium shadow-sm"
          />
        </div>
        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          Total Mentors: <span className="font-black text-indigo-600 dark:text-indigo-400">{mentors.length}</span>
        </div>
      </div>

      {/* Mentors Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-52 bg-slate-200/50 dark:bg-slate-800/40 animate-pulse rounded-3xl border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : filteredMentors.length === 0 ? (
        <div className="text-center py-16 bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-slate-200 dark:border-slate-800">
          <UserCheck size={48} className="mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No Mentors Found</h3>
          <p className="text-slate-500 text-xs mt-1">Add your first mentor account to assign batches.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMentors.map((mentor) => {
            const avatar = mentor.equippedAvatar || mentor.profileImage;
            return (
              <div
                key={mentor._id}
                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between hover:border-indigo-500/50 transition-all group hover:shadow-2xl"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div 
                      onClick={() => setViewingMentor(mentor)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {avatar ? (
                          <img src={avatar.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${avatar}` : avatar} alt="Mentor Avatar" className="w-full h-full object-cover" />
                        ) : (
                          mentor.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {mentor.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-500/20 mt-0.5">
                          <Shield size={11} /> Mentor
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingMentor(mentor)}
                        className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="View Full Profile"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenModal(mentor)}
                        className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Edit Mentor"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(mentor._id, mentor.name)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Delete Mentor"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4 font-medium">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{mentor.email}</span>
                    </div>
                    {mentor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-emerald-500 shrink-0" />
                        <span>{mentor.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Assigned Batches */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1 font-extrabold uppercase tracking-wider">
                      <BookOpen size={13} className="text-amber-500" />
                      Assigned Batches ({mentor.assignedBatches?.length || 0}):
                    </div>
                    {mentor.assignedBatches && mentor.assignedBatches.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {mentor.assignedBatches.map((b) => (
                          <span
                            key={b._id}
                            className="text-[11px] px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                          >
                            {b.batchName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No batches assigned yet</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => navigate('/batch-chat')}
                    className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black flex items-center justify-center gap-2 border border-indigo-500/20 transition-all"
                  >
                    <MessageSquare size={14} /> Open Direct WhatsApp Chat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MENTOR PROFILE MODAL */}
      {viewingMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <button onClick={() => setViewingMentor(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 border-2 border-indigo-500 text-indigo-500 font-black text-2xl flex items-center justify-center overflow-hidden shrink-0">
                {viewingMentor.equippedAvatar || viewingMentor.profileImage ? (
                  <img 
                    src={
                      (viewingMentor.equippedAvatar || viewingMentor.profileImage).startsWith('/uploads')
                        ? `${import.meta.env.VITE_API_URL || ''}${viewingMentor.equippedAvatar || viewingMentor.profileImage}`
                        : (viewingMentor.equippedAvatar || viewingMentor.profileImage)
                    } 
                    alt="Mentor Avatar" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  viewingMentor.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  MENTOR PROFILE
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">{viewingMentor.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{viewingMentor.email}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <Mail size={16} className="text-indigo-500" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Email Address</span>
                  <span>{viewingMentor.email}</span>
                </div>
              </div>

              {viewingMentor.phone && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <Phone size={16} className="text-emerald-500" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Contact Phone</span>
                    <span>{viewingMentor.phone}</span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-black block flex items-center gap-1">
                  <BookOpen size={12} className="text-amber-500" /> Assigned Batches
                </span>
                {viewingMentor.assignedBatches && viewingMentor.assignedBatches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingMentor.assignedBatches.map(b => (
                      <span key={b._id} className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-extrabold text-[11px] border border-indigo-500/20">
                        {b.batchName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">No assigned batches.</span>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => { setViewingMentor(null); navigate('/batch-chat'); }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <MessageSquare size={16} /> Open Direct WhatsApp Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck size={20} className="text-indigo-500" />
                {editingMentor ? 'Edit Mentor Account' : 'Create Mentor Account'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saran Velmurugan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="mentor@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {editingMentor ? 'Password (leave blank to keep unchanged)' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingMentor}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl text-xs font-extrabold hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25"
                >
                  {editingMentor ? 'Save Changes' : 'Create Mentor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
