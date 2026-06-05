/**
 * NovaSidebar — the Nova Assist navigation panel.
 *
 * Composes, top to bottom (per the Figma spec, 288px wide on the Nova canvas):
 *   • NovaAssistHeader (wordmark + menu)
 *   • action block — "New chat" (gradient mark) and "Settings"
 *   • account scope toggle — Current account / All accounts
 *   • a section kicker ("TODAY") with a search affordance
 *   • the scrollable chat history list, one row selectable
 *
 * Brand colours come from ./tokens, not the app theme — Nova Assist is its own
 * surface. Default `sections` mirror the mockup so it renders faithfully with
 * no props; wire the callbacks to make it live.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Settings, Search } from 'lucide-react-native';
import { NovaAssistHeader } from './NovaAssistHeader';
import { nova, NOVA_FONT, NOVA_SIDEBAR_WIDTH } from './tokens';

export type NovaChat = { id: string; title: string };
export type NovaSection = { label: string; chats: NovaChat[] };
export type NovaAccountScope = 'current' | 'all';

const DEFAULT_SECTIONS: NovaSection[] = [
  {
    label: 'TODAY',
    chats: [
      { id: '1', title: 'Accounts Coverage Data Table' },
      { id: '2', title: 'Search Data Explorer Policies' },
      { id: '3', title: 'Compare Attached Documents' },
      { id: '4', title: 'Draft Submission Command' },
      { id: '5', title: 'Compare Policies Command' },
      { id: '6', title: 'Client Document Summary Request' },
      { id: '7', title: 'Surplus Line Handoff Request' },
      { id: '8', title: 'SL-1/SL-2 Policy Form Completion' },
      { id: '9', title: 'Compare Policies Command' },
      { id: '10', title: 'Client Document Summary' },
      { id: '11', title: 'Surplus Line Handoff Request' },
    ],
  },
];

export function NovaSidebar({
  title = 'Nova Assist',
  sections = DEFAULT_SECTIONS,
  selectedChatId = '1',
  accountScope = 'current',
  onAccountScopeChange,
  onNewChat,
  onOpenSettings,
  onMenuPress,
  onSearch,
  onSelectChat,
  style,
}: {
  title?: string;
  sections?: NovaSection[];
  selectedChatId?: string;
  accountScope?: NovaAccountScope;
  onAccountScopeChange?: (scope: NovaAccountScope) => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  onMenuPress?: () => void;
  onSearch?: () => void;
  onSelectChat?: (chat: NovaChat) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.panel, style]}>
      <NovaAssistHeader title={title} onMenuPress={onMenuPress} />

      {/* Action block */}
      <View style={styles.actions}>
        <Pressable
          onPress={onNewChat}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={nova.newChatGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.15 }}
            style={styles.newChatMark}
          >
            <Plus size={16} color={nova.newChatInk} strokeWidth={2.5} />
          </LinearGradient>
          <Text style={styles.actionLabelHeavy}>New chat</Text>
        </Pressable>

        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
        >
          <View style={styles.actionIcon}>
            <Settings size={22} color={nova.slate} strokeWidth={1.75} />
          </View>
          <Text style={styles.actionLabel}>Settings</Text>
        </Pressable>
      </View>

      {/* Account scope toggle */}
      <View style={styles.toggleWrap}>
        <AccountToggle scope={accountScope} onChange={onAccountScopeChange} />
      </View>

      {/* History */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => (
          <View key={section.label}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>{section.label}</Text>
              <Pressable
                onPress={onSearch}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Search chats"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Search size={20} color={nova.slate} strokeWidth={2} />
              </Pressable>
            </View>

            {section.chats.map((chat, i) => {
              const selected = chat.id === selectedChatId;
              return (
                <Pressable
                  key={`${chat.id}-${i}`}
                  onPress={() => onSelectChat?.(chat)}
                  accessibilityRole="button"
                  accessibilityLabel={chat.title}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.chatRow,
                    selected && styles.chatRowSelected,
                    pressed && !selected && styles.chatRowPressed,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.chatLabel, selected && styles.chatLabelSelected]}
                  >
                    {chat.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ── Account scope toggle ─────────────────────────────────────────────────── */
function AccountToggle({
  scope,
  onChange,
}: {
  scope: NovaAccountScope;
  onChange?: (scope: NovaAccountScope) => void;
}) {
  const options: { key: NovaAccountScope; label: string }[] = [
    { key: 'current', label: 'Current account' },
    { key: 'all', label: 'All accounts' },
  ];
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map(({ key, label }) => {
        const active = scope === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange?.(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: NOVA_SIDEBAR_WIDTH,
    flex: 1,
    backgroundColor: nova.canvas,
  },

  // Action block
  actions: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.6 },
  newChatMark: {
    width: 24,
    height: 24,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  actionLabelHeavy: {
    fontFamily: NOVA_FONT.heavy,
    fontSize: 14,
    lineHeight: 20,
    color: nova.slate,
  },
  actionLabel: {
    fontFamily: NOVA_FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: nova.slate,
  },

  // Account toggle
  toggleWrap: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: nova.line,
    backgroundColor: nova.segmentTrack,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  segmentItemActive: {
    backgroundColor: nova.segmentActive,
    borderWidth: 1,
    borderColor: nova.line,
    shadowColor: '#1B2733',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontFamily: NOVA_FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: nova.slate,
  },
  segmentTextActive: { fontFamily: NOVA_FONT.heavy, color: nova.slateBold },

  // History list
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionKicker: {
    fontFamily: NOVA_FONT.heavy,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: nova.slateQuiet,
  },
  chatRow: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8 },
  chatRowSelected: { backgroundColor: nova.rowSelected },
  chatRowPressed: { backgroundColor: nova.rowSelected, opacity: 0.7 },
  chatLabel: {
    fontFamily: NOVA_FONT.regular,
    fontSize: 15,
    lineHeight: 20,
    color: nova.slate,
  },
  chatLabelSelected: { fontFamily: NOVA_FONT.heavy, color: nova.slateBold },
});
