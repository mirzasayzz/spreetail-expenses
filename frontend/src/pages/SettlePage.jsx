import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groupsAPI, settlementsAPI, balancesAPI } from '../services/api';
import { ArrowLeft, CheckCircle, ArrowRight } from 'lucide-react';

function SettlePage() {
  const { id: groupId } = useParams();
  const [members, setMembers] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [settlementPlan, setSettlementPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    from_user: '',
    to_user: '',
    amount: '',
    currency: 'INR',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [groupId]);

  async function loadData() {
    try {
      const [groupRes, settlementsRes, balanceRes] = await Promise.all([
        groupsAPI.get(groupId),
        settlementsAPI.list(groupId),
        balancesAPI.getGroupBalances(groupId)
      ]);
      setMembers(groupRes.data.members);
      setSettlements(settlementsRes.data.settlements);
      setSettlementPlan(balanceRes.data.settlement_plan || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.from_user || !form.to_user || !form.amount) return;
    setSubmitting(true);
    setSuccess('');

    try {
      await settlementsAPI.create(groupId, {
        from_user: form.from_user,
        to_user: form.to_user,
        amount: parseFloat(form.amount),
        currency: form.currency,
        notes: form.notes
      });
      setForm({ from_user: '', to_user: '', amount: '', currency: 'INR', notes: '' });
      setSuccess('Settlement recorded!');
      loadData();
    } catch (err) {
      console.error('Failed to record settlement:', err);
      alert(err.response?.data?.error || 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  }

  function quickSettle(settlement) {
    setForm({
      from_user: settlement.from.id,
      to_user: settlement.to.id,
      amount: settlement.amount.toString(),
      currency: settlement.currency || 'INR',
      notes: `Settlement: ${settlement.from.name} → ${settlement.to.name}`
    });
  }

  function formatINR(amount) {
    return `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-600 rounded w-1/3" />
          <div className="glass-card p-8"><div className="h-40 bg-dark-600 rounded" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link to={`/groups/${groupId}`} className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700 transition-all">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-white">Settle Up</h1>
      </div>

      {/* Suggested Settlements */}
      {settlementPlan.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h3 className="font-semibold text-white mb-3">Suggested Settlements</h3>
          <p className="text-dark-400 text-sm mb-4">Click to auto-fill the form</p>
          <div className="space-y-2">
            {settlementPlan.map((s, i) => (
              <button
                key={i}
                onClick={() => quickSettle(s)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 hover:bg-dark-700/50 transition-all text-left"
              >
                <span className="text-dark-100">{s.from.name}</span>
                <ArrowRight size={14} className="text-accent-400" />
                <span className="text-dark-100">{s.to.name}</span>
                <span className="ml-auto font-bold text-accent-400">{formatINR(s.amount)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Record Settlement Form */}
      <div className="glass-card p-6 mb-6">
        <h3 className="font-semibold text-white mb-4">Record Payment</h3>

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">From (Payer)</label>
              <select
                className="input-field"
                value={form.from_user}
                onChange={(e) => setForm({ ...form, from_user: e.target.value })}
                required
              >
                <option value="">Who paid?</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">To (Receiver)</label>
              <select
                className="input-field"
                value={form.to_user}
                onChange={(e) => setForm({ ...form, to_user: e.target.value })}
                required
              >
                <option value="">Who received?</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="input-field"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Currency</label>
              <select className="input-field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Notes (optional)</label>
            <input type="text" placeholder="Any notes" className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? 'Recording...' : 'Record Settlement'}
          </button>
        </form>
      </div>

      {/* Settlement History */}
      {settlements.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold text-white mb-4">Settlement History</h3>
          <div className="space-y-2">
            {settlements.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 text-sm animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <span className="text-dark-100">{s.from_name}</span>
                <ArrowRight size={14} className="text-emerald-400" />
                <span className="text-dark-100">{s.to_name}</span>
                <span className="ml-auto font-bold text-emerald-400">{s.currency === 'USD' ? '$' : '₹'}{parseFloat(s.amount).toFixed(2)}</span>
                <span className="text-dark-500 text-xs">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SettlePage;
