// client/src/components/editor/PresenceIndicator.jsx
// Shows connected collaborators' avatars/initials in the toolbar
import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

/** Extract initials from a name, e.g. "John Doe" → "JD" */
function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * PresenceIndicator — shows connected users from Y.js awareness.
 */
export default function PresenceIndicator({ provider, currentUserId }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!provider) return;

    const updateUsers = () => {
      const states = provider.awareness.getStates();
      const uniqueUsers = new Map();
      
      states.forEach((state, clientId) => {
        if (!state?.user) return;
        const uid = state.user.id || state.user._id;
        
        // Skip current user and ensure we have a valid ID
        if (!uid || uid === currentUserId) return;
        
        // Keep the latest state for this user ID (last one to update wins)
        uniqueUsers.set(uid, { clientId, ...state.user });
      });
      
      setUsers(Array.from(uniqueUsers.values()));
    };

    provider.awareness.on('change', updateUsers);
    updateUsers();

    return () => {
      provider.awareness.off('change', updateUsers);
    };
  }, [provider, currentUserId]);

  if (users.length === 0) return null;

  const MAX_VISIBLE = 4;
  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1.5" aria-label={`${users.length} collaborator${users.length > 1 ? 's' : ''} online`}>
      <div className="flex items-center gap-1 text-xs text-gray-500 mr-1">
        <Users className="w-3.5 h-3.5" />
        <span>{users.length + 1}</span>
      </div>

      <div className="flex -space-x-2">
        {visible.map((u) => (
          <div key={u.clientId} className="relative group">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white shadow-sm transition-transform hover:scale-110 hover:z-10 cursor-default"
              style={{ backgroundColor: u.color || '#6b7280' }}
              title={u.name}
            >
              {getInitials(u.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white" />
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                {u.name}
              </div>
            </div>
          </div>
        ))}

        {overflow > 0 && (
          <div
            className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold ring-2 ring-white"
            title={`${overflow} more`}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
