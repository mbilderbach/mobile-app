import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Check, X, Pencil, Trash2 } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Group } from '@/lib/types';
import { ScreenTitle, Card } from '@/components/ui';
import { CATEGORY_EMOJIS, nextCategoryColor } from '@/components/CategoryPicker';
import { errorMessage, throwIfError } from '@/lib/writeSafety';
import { useToast } from '@/components/Toast';

export default function CategoriesScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useToast();
  const [categories, setCategories] = useState<Group[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmoji, setCreateEmoji] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: cats } = await supabase.from('groups').select('*').eq('user_id', user.id).order('name');
    const { data: pg } = await supabase.from('prayer_groups').select('group_id');
    setCategories(cats || []);
    const c: Record<string, number> = {};
    (pg || []).forEach((r: any) => { c[r.group_id] = (c[r.group_id] || 0) + 1; });
    setCounts(c);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const startCreate = () => { setCreateName(''); setCreateEmoji(null); setCreating(true); };
  const cancelCreate = () => { setCreating(false); setCreateName(''); setCreateEmoji(null); };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name || !user || busy) return;
    setBusy(true);
    try {
      throwIfError(
        await supabase.from('groups').insert({ user_id: user.id, name, color: nextCategoryColor(categories.length), emoji: createEmoji || null }),
        'Could not create this category. Please try again.'
      );
      cancelCreate();
      fetchData();
    } catch (error) {
      showError(errorMessage(error, 'Could not create this category. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (g: Group) => { setEditingId(g.id); setEditName(g.name); setEditEmoji(g.emoji || null); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditEmoji(null); };

  const submitEdit = async (id: string) => {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      throwIfError(
        await supabase.from('groups').update({ name, emoji: editEmoji || null }).eq('id', id),
        'Could not save this category. Your changes are still here.'
      );
      cancelEdit();
      fetchData();
    } catch (error) {
      showError(errorMessage(error, 'Could not save this category. Your changes are still here.'));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete || busy) return;
    setBusy(true);
    try {
      throwIfError(await supabase.from('prayer_groups').delete().eq('group_id', confirmDelete.id), 'Could not delete this category. Please try again.');
      throwIfError(await supabase.from('groups').delete().eq('id', confirmDelete.id), 'Could not delete this category. Please try again.');
      setConfirmDelete(null);
      fetchData();
    } catch (error) {
      showError(errorMessage(error, 'Could not delete this category. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const EmojiPalette = ({ value, onPick }: { value: string | null; onPick: (e: string | null) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palette} keyboardShouldPersistTaps="handled">
      {CATEGORY_EMOJIS.map((e) => (
        <Pressable key={e} onPress={() => onPick(value === e ? null : e)} style={[styles.emojiBtn, value === e && styles.emojiBtnSel]}>
          <Text style={styles.emojiGlyph}>{e}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenTitle title="Categories" size="page" style={styles.title} />

        {/* Create */}
        {creating ? (
          <Card style={styles.editorCard}>
            <View style={styles.editorRow}>
              {createEmoji ? <Text style={styles.emojiPreview}>{createEmoji}</Text> : null}
              <TextInput
                style={styles.nameInput}
                placeholder="New category"
                placeholderTextColor={colors.quiet}
                value={createName}
                onChangeText={setCreateName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitCreate}
                maxLength={30}
              />
              <Pressable onPress={cancelCreate} hitSlop={8} style={styles.iconBtn}><X size={18} color={colors.quiet} /></Pressable>
              <Pressable onPress={submitCreate} disabled={!createName.trim() || busy} style={[styles.addBtn, !createName.trim() && styles.addBtnDisabled]}>
                <Check size={18} color={colors.white} />
              </Pressable>
            </View>
            <EmojiPalette value={createEmoji} onPick={setCreateEmoji} />
          </Card>
        ) : (
          <Pressable style={styles.newRow} onPress={startCreate}>
            <View style={styles.newIcon}><Plus size={16} color={colors.selectedText} /></View>
            <Text style={styles.newText}>New category</Text>
          </Pressable>
        )}

        {/* List */}
        <View style={styles.list}>
          {categories.map((c) =>
            editingId === c.id ? (
              <Card key={c.id} style={styles.editorCard}>
                <View style={styles.editorRow}>
                  {editEmoji ? <Text style={styles.emojiPreview}>{editEmoji}</Text> : null}
                  <TextInput
                    style={styles.nameInput}
                    placeholder="Category name"
                    placeholderTextColor={colors.quiet}
                    value={editName}
                    onChangeText={setEditName}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => submitEdit(c.id)}
                    maxLength={30}
                  />
                  <Pressable onPress={cancelEdit} hitSlop={8} style={styles.iconBtn}><X size={18} color={colors.quiet} /></Pressable>
                  <Pressable onPress={() => submitEdit(c.id)} disabled={!editName.trim() || busy} style={[styles.addBtn, !editName.trim() && styles.addBtnDisabled]}>
                    <Check size={18} color={colors.white} />
                  </Pressable>
                </View>
                <EmojiPalette value={editEmoji} onPick={setEditEmoji} />
                <Pressable style={styles.deleteLink} onPress={() => { cancelEdit(); setConfirmDelete(c); }} hitSlop={8}>
                  <Trash2 size={15} color={colors.error} />
                  <Text style={styles.deleteLinkText}>Delete category</Text>
                </Pressable>
              </Card>
            ) : (
              <Pressable key={c.id} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => startEdit(c)}>
                <Text style={styles.rowEmoji}>{c.emoji || '🏷️'}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.rowCount}>{counts[c.id] || 0} {counts[c.id] === 1 ? 'prayer' : 'prayers'}</Text>
                </View>
                <Pencil size={16} color={colors.quiet} />
              </Pressable>
            )
          )}
          {categories.length === 0 && !creating && (
            <Text style={styles.emptyText}>No categories yet. Create one to organize your prayers.</Text>
          )}
        </View>
      </ScrollView>

      {confirmDelete && (
        <View style={styles.confirmOverlay}>
          <Card style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>Delete “{confirmDelete.name}”?</Text>
            <Text style={styles.confirmDesc}>
              Your prayers stay — they’ll just become uncategorized.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancel} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmDelete} onPress={doDelete}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 20 : 56,
    paddingBottom: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  title: { marginBottom: 18 },

  newRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  newIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  newText: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.selectedText, letterSpacing: -0.2 },

  list: { gap: 10, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: { opacity: 0.92 },
  rowEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink, letterSpacing: -0.2 },
  rowCount: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },

  editorCard: { gap: 14, marginTop: 6, marginBottom: 4 },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emojiPreview: { fontSize: 18 },
  nameInput: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink, padding: 0, letterSpacing: -0.2 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  palette: { gap: 6, paddingRight: 4 },
  emojiBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  emojiBtnSel: { backgroundColor: colors.selectedBg, borderColor: colors.selectedText },
  emojiGlyph: { fontSize: 18 },
  deleteLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  deleteLinkText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.error },

  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.quiet, lineHeight: 21, paddingVertical: 12 },

  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25,24,33,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  confirmSheet: { width: '100%', maxWidth: 340, gap: 8 },
  confirmTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.ink, letterSpacing: -0.3 },
  confirmDesc: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 12 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmCancel: { flex: 1, height: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted },
  confirmDelete: { flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  confirmDeleteText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.white },
});
