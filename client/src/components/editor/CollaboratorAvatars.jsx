import React from 'react';

function hashColor(seed) {
  const s = String(seed || 'user');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 45%)`;
}

function initials(nameOrEmail) {
  const s = String(nameOrEmail || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CollaboratorAvatars({ users, selfUserId }) {
  const list = (users || []).filter((u) => u?.id);
  if (!list.length) return null;

  const max = 5;
  const shown = list.slice(0, max);
  const remaining = Math.max(0, list.length - shown.length);

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((u) => {
          const seed = u.avatarSeed || u.email || u.id;
          const bg = hashColor(seed);
          const label = u.name || u.email || 'User';
          const isSelf = selfUserId && u.id === selfUserId;
          return (
            <div
              key={u.id}
              title={label}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold text-white shadow-sm ${isSelf ? 'border-blue-400 ring-2 ring-blue-200' : 'border-white'}`}
              style={{ backgroundColor: bg }}
            >
              {initials(label)}
            </div>
          );
        })}
        {remaining > 0 && (
          <div
            title={`${remaining} more`}
            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold bg-gray-400 text-white shadow-sm"
          >
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
}
