import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groupsAPI, expensesAPI } from '../services/api';
import { Plus, Upload, BarChart3, ArrowLeftRight, UserPlus, Calendar, IndianRupee, DollarSign, Trash2, Users } from 'lucide-react';

function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');

  useEffect(() => {
    loadGroupData();
  }, [id]);

  async function loadGroupData() {
    try {
      const [groupRes, expensesRes] = await Promise.all([
        groupsAPI.get(id),
        expensesAPI.list(id)
      ]);
      setGroup(groupRes.data.group);
      setMembers(groupRes.data.members);
      setExpenses(expensesRes.data.expenses);
    } catch (err) {
      console.error('Failed to load group:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    setMemberError('');
    setAddingMember(true);
    try {
      await groupsAPI.addMember(id, { email: newMemberEmail });
      setNewMemberEmail('');
      setShowAddMember(false);
      loadGroupData();
    } catch (err) {
      setMemberError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleDeleteExpense(expenseId) {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesAPI.delete(id, expenseId);
      loadGroupData();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  }

  function getCurrencyIcon(currency) {
    return currency === 'USD' ? <DollarSign size={14} /> : <IndianRupee size={14} />;
  }

  function formatAmount(amount, currency) {
    const num = parseFloat(amount);
    if (currency === 'USD') return `$${num.toFixed(2)}`;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-600 rounded w-1/3" />
          <div className="h-4 bg-dark-600 rounded w-1/2" />
          <div className="glass-card p-6">
            <div className="h-5 bg-dark-600 rounded w-1/4 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-dark-600 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!group) return <div className="text-center py-12 text-dark-300">Group not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{group.name}</h1>
        {group.description && <p className="text-dark-300 mt-1">{group.description}</p>}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Link to={`/groups/${id}/add-expense`} className="glass-card p-4 text-center hover:bg-dark-600/50 transition-all group">
          <Plus size={22} className="text-accent-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
          <span className="text-sm text-dark-200">Add Expense</span>
        </Link>
        <Link to={`/groups/${id}/import`} className="glass-card p-4 text-center hover:bg-dark-600/50 transition-all group">
          <Upload size={22} className="text-emerald-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
          <span className="text-sm text-dark-200">Import CSV</span>
        </Link>
        <Link to={`/groups/${id}/balances`} className="glass-card p-4 text-center hover:bg-dark-600/50 transition-all group">
          <BarChart3 size={22} className="text-amber-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
          <span className="text-sm text-dark-200">Balances</span>
        </Link>
        <Link to={`/groups/${id}/settle`} className="glass-card p-4 text-center hover:bg-dark-600/50 transition-all group">
          <ArrowLeftRight size={22} className="text-purple-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
          <span className="text-sm text-dark-200">Settle Up</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'expenses' ? 'bg-accent-600 text-white' : 'text-dark-300 hover:text-white'
          }`}
        >
          Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'members' ? 'bg-accent-600 text-white' : 'text-dark-300 hover:text-white'
          }`}
        >
          Members ({members.length})
        </button>
      </div>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Receipt size={40} className="text-dark-400 mx-auto mb-3" />
              <p className="text-dark-300 mb-4">No expenses yet</p>
              <Link to={`/groups/${id}/add-expense`} className="btn-primary inline-flex items-center gap-2">
                <Plus size={16} /> Add First Expense
              </Link>
            </div>
          ) : (
            expenses.map((expense, index) => (
              <div
                key={expense.id}
                className="glass-card p-4 animate-fade-in hover:bg-dark-600/30 transition-all"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{expense.description}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        expense.split_type === 'equal' ? 'bg-blue-500/20 text-blue-300' :
                        expense.split_type === 'percentage' ? 'bg-purple-500/20 text-purple-300' :
                        expense.split_type === 'share' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {expense.split_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-dark-300">
                      <span>Paid by <span className="text-dark-100">{expense.paid_by_name || 'Unknown'}</span></span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {expense.notes && (
                      <p className="text-xs text-dark-400 mt-1 italic">"{expense.notes}"</p>
                    )}
                    {/* Split details */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {expense.splits?.map((split, i) => (
                        <span key={i} className="text-xs bg-dark-700 px-2 py-0.5 rounded text-dark-200">
                          {split.user_name}: {formatAmount(split.amount_owed, expense.currency)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">
                        {formatAmount(expense.amount, expense.currency)}
                      </p>
                      <p className="text-xs text-dark-400">{expense.currency}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowAddMember(!showAddMember)} className="btn-secondary flex items-center gap-2 text-sm">
              <UserPlus size={16} /> Add Member
            </button>
          </div>

          {showAddMember && (
            <div className="glass-card p-4 mb-4 animate-fade-in">
              <form onSubmit={handleAddMember} className="flex gap-3">
                <input
                  type="email"
                  placeholder="Member's email address"
                  className="input-field flex-1"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  required
                />
                <button type="submit" disabled={addingMember} className="btn-primary whitespace-nowrap">
                  {addingMember ? 'Adding...' : 'Add'}
                </button>
              </form>
              {memberError && <p className="text-red-400 text-sm mt-2">{memberError}</p>}
            </div>
          )}

          <div className="space-y-2">
            {members.map((member, index) => (
              <div
                key={member.id}
                className="glass-card p-4 flex items-center justify-between animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                    {member.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{member.name}</p>
                    <p className="text-xs text-dark-400">{member.email}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-dark-300">Joined {new Date(member.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  {member.left_at && (
                    <p className="text-amber-400 text-xs">Left {new Date(member.left_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Receipt icon component for empty state
function Receipt({ size, className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
      <path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>
    </svg>
  );
}

export default GroupDetail;
