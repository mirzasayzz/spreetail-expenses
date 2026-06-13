import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupsAPI, expensesAPI } from '../services/api';
import { ArrowLeft, Plus } from 'lucide-react';

function AddExpense() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    paid_by: '',
    split_type: 'equal',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    participants: [],
    split_details: {}
  });

  useEffect(() => {
    loadMembers();
  }, [groupId]);

  async function loadMembers() {
    try {
      const res = await groupsAPI.get(groupId);
      const activeMembers = res.data.members.filter(m => !m.left_at);
      setMembers(activeMembers);
      // Select all active members as participants by default
      setForm(prev => ({
        ...prev,
        participants: activeMembers.map(m => m.id),
        paid_by: activeMembers[0]?.id || ''
      }));
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }

  function toggleParticipant(memberId) {
    setForm(prev => {
      const isSelected = prev.participants.includes(memberId);
      const newParticipants = isSelected
        ? prev.participants.filter(id => id !== memberId)
        : [...prev.participants, memberId];
      return { ...prev, participants: newParticipants };
    });
  }

  function updateSplitDetail(memberId, value) {
    setForm(prev => ({
      ...prev,
      split_details: { ...prev.split_details, [memberId]: parseFloat(value) || 0 }
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description || !form.amount || !form.paid_by || form.participants.length === 0) return;
    setLoading(true);

    try {
      await expensesAPI.create(groupId, {
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        paid_by: form.paid_by,
        split_type: form.split_type,
        date: form.date,
        notes: form.notes,
        participants: form.participants,
        split_details: form.split_type !== 'equal' ? form.split_details : undefined
      });
      navigate(`/groups/${groupId}`);
    } catch (err) {
      console.error('Failed to create expense:', err);
      alert(err.response?.data?.error || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  }

  function getMemberName(memberId) {
    return members.find(m => m.id === memberId)?.name || 'Unknown';
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-white">Add Expense</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Description & Amount */}
        <div className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Description</label>
            <input
              type="text"
              placeholder="What was this expense for?"
              className="input-field"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input-field"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Currency</label>
              <select
                className="input-field"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Paid By</label>
              <select
                className="input-field"
                value={form.paid_by}
                onChange={(e) => setForm({ ...form, paid_by: e.target.value })}
                required
              >
                <option value="">Select payer</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Date</label>
              <input
                type="date"
                className="input-field"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              placeholder="Any additional notes"
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        {/* Split Section */}
        <div className="glass-card p-6">
          <label className="block text-sm font-medium text-dark-200 mb-3">Split Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {['equal', 'unequal', 'percentage', 'share'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, split_type: type })}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize ${
                  form.split_type === type
                    ? 'bg-accent-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Participants */}
          <label className="block text-sm font-medium text-dark-200 mb-2">Split With</label>
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50">
                <input
                  type="checkbox"
                  checked={form.participants.includes(member.id)}
                  onChange={() => toggleParticipant(member.id)}
                  className="w-4 h-4 rounded border-dark-500 text-accent-500 focus:ring-accent-500 bg-dark-700"
                />
                <span className="text-dark-100 flex-1">{member.name}</span>

                {/* Show detail input for non-equal splits */}
                {form.split_type !== 'equal' && form.participants.includes(member.id) && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={form.split_type === 'percentage' ? '%' : form.split_type === 'share' ? 'shares' : '₹'}
                      className="input-field w-24 text-sm py-1.5"
                      value={form.split_details[member.id] || ''}
                      onChange={(e) => updateSplitDetail(member.id, e.target.value)}
                    />
                    <span className="text-xs text-dark-400">
                      {form.split_type === 'percentage' ? '%' : form.split_type === 'share' ? 'shares' : form.currency}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit - Sticky Bottom Bar */}
        <div className="sticky bottom-0 bg-[#080b10]/95 backdrop-blur-md border-t border-dark-500/30 py-4 z-30 shadow-lg -mx-4 px-4 sm:-mx-6 sm:px-6">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Plus size={18} />
                Add Expense
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddExpense;
