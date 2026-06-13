import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { groupsAPI } from '../services/api';
import { Plus, Users, Receipt, ChevronRight, FolderOpen } from 'lucide-react';

function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const res = await groupsAPI.list();
      setGroups(res.data.groups);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!newGroup.name.trim()) return;
    setCreating(true);

    try {
      await groupsAPI.create(newGroup);
      setNewGroup({ name: '', description: '' });
      setShowCreate(false);
      loadGroups();
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-5 bg-dark-600 rounded w-1/3 mb-3" />
              <div className="h-4 bg-dark-600 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Groups</h1>
          <p className="text-dark-300 mt-1">Manage shared expenses with your flatmates</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          New Group
        </button>
      </div>

      {/* Create Group Form */}
      {showCreate && (
        <div className="glass-card p-6 mb-6 animate-fade-in">
          <h3 className="text-lg font-semibold text-white mb-4">Create New Group</h3>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Group Name</label>
              <input
                type="text"
                placeholder="e.g., Flat 4B Expenses"
                className="input-field"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Description (optional)</label>
              <input
                type="text"
                placeholder="Brief description"
                className="input-field"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Creating...' : 'Create Group'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FolderOpen size={48} className="text-dark-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-dark-200 mb-2">No groups yet</h3>
          <p className="text-dark-400 mb-6">Create your first expense group to get started</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={18} className="inline mr-2" />
            Create Group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, index) => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="glass-card p-5 block hover:bg-dark-600/50 transition-all group animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white group-hover:text-accent-300 transition-colors">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-dark-300 text-sm mt-0.5">{group.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-sm text-dark-300">
                      <Users size={14} />
                      {group.member_count} members
                    </span>
                    <span className="flex items-center gap-1 text-sm text-dark-300">
                      <Receipt size={14} />
                      {group.expense_count} expenses
                    </span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-dark-400 group-hover:text-accent-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
