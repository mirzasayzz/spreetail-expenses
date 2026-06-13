import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { balancesAPI } from '../services/api';
import { ArrowLeft, TrendingUp, TrendingDown, ArrowRight, ChevronDown, ChevronUp, IndianRupee } from 'lucide-react';

function Balances() {
  const { id: groupId } = useParams();
  const [balances, setBalances] = useState([]);
  const [settlementPlan, setSettlementPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    loadBalances();
  }, [groupId]);

  async function loadBalances() {
    try {
      const res = await balancesAPI.getGroupBalances(groupId);
      setBalances(res.data.balances);
      setSettlementPlan(res.data.settlement_plan || []);
    } catch (err) {
      console.error('Failed to load balances:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatINR(amount) {
    const num = Math.abs(amount);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-5 bg-dark-600 rounded w-1/3 mb-2" />
              <div className="h-8 bg-dark-600 rounded w-1/4" />
            </div>
          ))}
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
        <div>
          <h1 className="text-2xl font-bold text-white">Group Balances</h1>
          <p className="text-dark-400 text-sm">All amounts in INR (USD converted at fixed rate)</p>
        </div>
      </div>

      {/* Individual Balances */}
      <div className="space-y-3 mb-8">
        {balances.map((balance, index) => (
          <div
            key={balance.user_id}
            className="glass-card overflow-hidden animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className="p-5 cursor-pointer hover:bg-dark-600/30 transition-all"
              onClick={() => setExpandedUser(expandedUser === balance.user_id ? null : balance.user_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                    balance.net_balance > 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : balance.net_balance < 0
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-dark-600 text-dark-300'
                  }`}>
                    {balance.user_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{balance.user_name}</p>
                    <div className="flex items-center gap-3 text-xs text-dark-400">
                      <span>Paid: {formatINR(balance.total_paid)}</span>
                      <span>Owes: {formatINR(balance.total_owed)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-xl font-bold ${
                      balance.net_balance > 0 ? 'text-emerald-400' :
                      balance.net_balance < 0 ? 'text-red-400' : 'text-dark-300'
                    }`}>
                      {balance.net_balance > 0 ? '+' : ''}{formatINR(balance.net_balance)}
                    </p>
                    <p className="text-xs text-dark-400">
                      {balance.net_balance > 0 ? 'gets back' : balance.net_balance < 0 ? 'owes' : 'settled'}
                    </p>
                  </div>
                  {balance.net_balance > 0
                    ? <TrendingUp size={18} className="text-emerald-400" />
                    : balance.net_balance < 0
                    ? <TrendingDown size={18} className="text-red-400" />
                    : null
                  }
                  {expandedUser === balance.user_id ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                </div>
              </div>
            </div>

            {/* Expanded breakdown (Rohan's request) */}
            {expandedUser === balance.user_id && (
              <div className="px-5 pb-5 border-t border-dark-600/30 pt-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Expenses Paid */}
                  <div>
                    <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-1">
                      <TrendingUp size={14} /> Paid ({balance.expenses_paid?.length || 0})
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {balance.expenses_paid?.map((exp, i) => (
                        <div key={i} className="text-sm flex justify-between p-1.5 rounded bg-dark-800/50">
                          <span className="text-dark-300 truncate flex-1 mr-2">{exp.description}</span>
                          <span className="text-emerald-300 font-medium whitespace-nowrap">{formatINR(exp.amount)}</span>
                        </div>
                      ))}
                      {(!balance.expenses_paid || balance.expenses_paid.length === 0) && (
                        <p className="text-dark-500 text-sm">No payments</p>
                      )}
                    </div>
                  </div>

                  {/* Expenses Owed */}
                  <div>
                    <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                      <TrendingDown size={14} /> Share Owed ({balance.expenses_owed?.length || 0})
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {balance.expenses_owed?.map((exp, i) => (
                        <div key={i} className="text-sm flex justify-between p-1.5 rounded bg-dark-800/50">
                          <span className="text-dark-300 truncate flex-1 mr-2">{exp.description}</span>
                          <span className="text-red-300 font-medium whitespace-nowrap">{formatINR(exp.amount)}</span>
                        </div>
                      ))}
                      {(!balance.expenses_owed || balance.expenses_owed.length === 0) && (
                        <p className="text-dark-500 text-sm">No shares owed</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Settlement Plan (Aisha's request) */}
      {settlementPlan.length > 0 && (
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="text-lg font-semibold text-white mb-1">Simplified Settlements</h3>
          <p className="text-dark-400 text-sm mb-4">Minimum transactions needed to settle all debts</p>

          <div className="space-y-3">
            {settlementPlan.map((settlement, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-dark-800/50 animate-slide-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center text-red-300 font-semibold text-sm">
                  {settlement.from.name.charAt(0)}
                </div>
                <div className="text-center flex-1">
                  <p className="text-sm text-dark-300">
                    <span className="text-white font-medium">{settlement.from.name}</span>
                    {' '}pays{' '}
                    <span className="text-white font-medium">{settlement.to.name}</span>
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <ArrowRight size={14} className="text-accent-400" />
                    <span className="text-lg font-bold text-accent-400">{formatINR(settlement.amount)}</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-semibold text-sm">
                  {settlement.to.name.charAt(0)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <Link to={`/groups/${groupId}/settle`} className="btn-primary inline-flex items-center gap-2">
              <IndianRupee size={16} />
              Record Settlement
            </Link>
          </div>
        </div>
      )}

      {balances.length === 0 && (
        <div className="glass-card p-10 text-center">
          <p className="text-dark-300">No expenses yet. Add expenses or import CSV to see balances.</p>
        </div>
      )}
    </div>
  );
}

export default Balances;
