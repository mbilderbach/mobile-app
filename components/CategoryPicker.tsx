import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Plus, Check, X, Pencil } from 'lucide-react-native';
import { fonts, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Kicker } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Group, GROUP_COLORS, GroupColorKey } from '@/lib/types';
import { errorMessage, throwIfError } from '@/lib/writeSafety';
import { useToast } from '@/components/Toast';

/**
 * Single-select category picker with inline create + edit (name + emoji).
 *
 * Categories live in the `groups` table. A prayer belongs to at most one.
 * Tapping a selected category again clears it. The pencil on the selected chip
 * opens an inline editor so a typo (e.g. on a just-created category) can be
 * fixed without leaving the form. Colour is auto-assigned and kept under the
 * hood (it tints the Pray-along glow) — there is no colour dot in the UI.
 * Rename / recolour / delete also live on the Manage Categories screen.
 */

export const CATEGORY_EMOJIS = ['🙏', '❤️', '🏡', '🤝', '🌱', '✝️', '🕊️', '⭐️', '🔥', '🌿', '💛', '🙌'];
export const CATEGORY_COLOR_KEYS = Object.keys(GROUP_COLORS) as GroupColorKey[];
export const nextCategoryColor = (count: number) => CATEGORY_COLOR_KEYS[count % CATEGORY_COLOR_KEYS.length];

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; id: string };

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  onCreated,
  onUpdated,
  userId,
}: {
  categories: Group[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreated: (g: Group) => void;
  /** Fired after an inline rename so the parent can update its local list. */
  onUpdated?: (g: Group) => void;
  userId: string;
}) {
  const { showError } = useToast();
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [draft, setDraft] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startCreate = () => { setDraft(''); setEmoji(null); setMode({ kind: 'create' }); };
  const startEdit = (g: Group) => { setDraft(g.name); setEmoji(g.emoji || null); setMode({ kind: 'edit', id: g.id }); };
  const cancel = () => { setMode({ kind: 'closed' }); setDraft(''); setEmoji(null); };

  const submit = async () => {
    const name = draft.trim();
    if (!name || busy || mode.kind === 'closed') return;
    setBusy(true);
    try {
      if (mode.kind === 'create') {
        const result = await supabase
          .from('groups')
          .insert({ user_id: userId, name, color: nextCategoryColor(categories.length), emoji: emoji || null })
          .select('*')
          .maybeSingle();
        throwIfError(result, 'Could not create this category. Please try again.');
        if (result.data) onCreated(result.data as Group);
      } else {
        const result = await supabase
          .from('groups')
          .update({ name, emoji: emoji || null })
          .eq('id', mode.id)
          .select('*')
          .maybeSingle();
        throwIfError(result, 'Could not save this category. Please try again.');
        if (result.data) onUpdated?.(result.data as Group);
      }
      cancel();
    } catch (error) {
      showError(errorMessage(error, 'Could not save this category. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const editing = mode.kind !== 'closed';

  return (
    <View style={styles.wrap}>
      <Kicker>Category</Kicker>
      {editing ? (
        <View style={styles.createWrap}>
          <View style={styles.createRow}>
            {emoji ? <Text style={styles.emojiPreview}>{emoji}</Text> : null}
            <TextInput
              style={styles.createInput}
              placeholder={mode.kind === 'edit' ? 'Rename category' : 'New category'}
              placeholderTextColor={colors.quiet}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              maxLength={30}
            />
            <Pressable onPress={cancel} hitSlop={8} style={styles.cancelBtn} accessibilityRole="button" accessibilityLabel="Cancel">
              <X size={18} color={colors.quiet} />
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!draft.trim() || busy}
              style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={mode.kind === 'edit' ? 'Save category' : 'Add category'}
            >
              <Check size={18} color={colors.white} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palette} keyboardShouldPersistTaps="handled">
            {CATEGORY_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(emoji === e ? null : e)}
                style={[styles.emojiBtn, emoji === e && styles.emojiBtnSel]}
              >
                <Text style={styles.emojiGlyph}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          keyboardShouldPersistTaps="handled"
        >
          {categories.map((c) => {
            const sel = c.id === selectedId;
            return (
              <Pressable
                key={c.id}
                onPress={() => onSelect(sel ? null : c.id)}
                style={[styles.chip, sel ? styles.chipSel : styles.chipUnsel]}
              >
                <Text style={[styles.chipText, sel ? styles.chipTextSel : styles.chipTextUnsel]} numberOfLines={1}>
                  {c.emoji ? `${c.emoji} ` : ''}{c.name}
                </Text>
                {/* Pencil affordance on the selected chip — fix a typo in place. */}
                {sel && onUpdated ? (
                  <Pressable onPress={() => startEdit(c)} hitSlop={8} style={styles.chipEdit} accessibilityRole="button" accessibilityLabel={`Edit ${c.name}`}>
                    <Pencil size={13} color={colors.selectedText} />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
          <Pressable onPress={startCreate} style={[styles.chip, styles.newChip]}>
            <Plus size={14} color={colors.muted} />
            <Text style={styles.newChipText}>New</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: 10 },
  row: { gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  chipUnsel: { backgroundColor: colors.fill },
  chipSel: { backgroundColor: colors.selectedBg },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13.5, letterSpacing: -0.1, maxWidth: 180 },
  chipTextUnsel: { color: colors.muted },
  chipTextSel: { color: colors.selectedText, fontFamily: fonts.sansSemiBold },
  chipEdit: { marginLeft: 2, paddingLeft: 4, borderLeftWidth: 1, borderLeftColor: 'rgba(124,92,252,0.25)' },
  newChip: { backgroundColor: colors.fill },
  newChipText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.muted, letterSpacing: -0.1 },

  createWrap: { gap: 10 },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  emojiPreview: { fontSize: 16 },
  createInput: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink, padding: 0 },
  cancelBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.4 },

  palette: { gap: 6, paddingRight: 4 },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiBtnSel: { backgroundColor: colors.selectedBg, borderColor: colors.selectedText },
  emojiGlyph: { fontSize: 18 },
});
