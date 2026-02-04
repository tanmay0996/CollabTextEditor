import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Plugin, PluginKey } from 'prosemirror-state';

function hashColor(seed) {
  const s = String(seed || 'user');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 45%)`;
}

export function RemoteCursorsExtension({ getPresence, selfUserId }) {
  return Extension.create({
    name: 'remoteCursors',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('remote-cursors'),
          props: {
            decorations: (state) => {
              const presence = typeof getPresence === 'function' ? getPresence() : { users: [], cursors: {} };
              const users = presence?.users || [];
              const cursors = presence?.cursors || {};

              const decos = [];
              for (const u of users) {
                if (!u?.id) continue;
                if (selfUserId && u.id === selfUserId) continue;

                const cursor = cursors[u.id] || u.cursorPos;
                if (!cursor || typeof cursor.from !== 'number' || typeof cursor.to !== 'number') continue;

                const from = Math.max(0, Math.min(cursor.from, state.doc.content.size));
                const to = Math.max(0, Math.min(cursor.to, state.doc.content.size));
                const seed = u.avatarSeed || u.email || u.id;
                const color = hashColor(seed);

                // caret at `from`
                const caret = document.createElement('span');
                caret.className = 'remote-caret';
                caret.style.borderLeft = `2px solid ${color}`;
                caret.style.marginLeft = '-1px';
                caret.style.marginRight = '-1px';
                caret.style.height = '1em';
                caret.style.position = 'relative';

                const label = document.createElement('span');
                label.textContent = u.name || u.email || 'User';
                label.style.position = 'absolute';
                label.style.top = '-1.25em';
                label.style.left = '0';
                label.style.background = color;
                label.style.color = 'white';
                label.style.fontSize = '10px';
                label.style.padding = '1px 4px';
                label.style.borderRadius = '6px';
                label.style.whiteSpace = 'nowrap';
                caret.appendChild(label);

                decos.push(Decoration.widget(from, caret, { key: `caret:${u.id}` }));

                // selection highlight
                if (to > from) {
                  decos.push(
                    Decoration.inline(from, to, {
                      style: `background-color: ${color}; opacity: 0.18; border-radius: 2px;`,
                    }, { key: `sel:${u.id}` })
                  );
                }
              }

              return DecorationSet.create(state.doc, decos);
            },
          },
        }),
      ];
    },
  });
}
