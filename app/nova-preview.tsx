/**
 * Dev-only preview of the Nova Assist sidebar. Renders the 288px panel on a
 * neutral backdrop (mirroring the Figma artboard) so it can be eyeballed in
 * isolation. Reachable at /nova-preview; bypasses the auth gate.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NovaSidebar, type NovaAccountScope, type NovaChat } from '@/components/nova/NovaSidebar';

export default function NovaPreview() {
  const [scope, setScope] = useState<NovaAccountScope>('current');
  const [selected, setSelected] = useState('1');

  const onSelect = (c: NovaChat) => setSelected(c.id);

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <NovaSidebar
          selectedChatId={selected}
          accountScope={scope}
          onAccountScopeChange={setScope}
          onSelectChat={onSelect}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#ECEDEF', alignItems: 'center', justifyContent: 'center' },
  panel: {
    width: 288,
    height: '100%',
    maxHeight: 760,
    overflow: 'hidden',
    backgroundColor: '#FAFBFC',
    shadowColor: '#1B2733',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
});
