/**
 * Circle settings — rename, share the invite code, mute, see members, leave.
 *
 * Flat by design (no roles surfaced at Circle scale): any member can rename,
 * everyone is equal, and there's no moderation surface. The invite code is the
 * only way in, shared via the OS share sheet.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, Share, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Share2, LogOut, Check } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Kicker } from '@/components/ui';
import { SettingsGroup, SettingsRow } from '@/components/SettingsGroup';
import { Avatar } from '@/components/circle/CircleBits';
import { useToast } from '@/components/Toast';
import { listMyCircles, getCircle, listMembers, renameCircle, setMuted, leaveCircle } from '@/lib/circles';
import { errorMessage } from '@/lib/writeSafety';
import type { Circle, CircleMember } from '@/lib/types';

export default function CircleSettingsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { showError, showToast } = useToast();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [name, setName] = useState('');
  const [muted, setMutedState] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const mine = await listMyCircles();
      if (mine.length === 0) { router.replace('/(tabs)/together'); return; }
      const active = mine[0];
      const [c, mem] = await Promise.all([getCircle(active.id), listMembers(active.id)]);
      setCircle(c);
      setMembers(mem);
      setName(c?.name || '');
      setMutedState(mem.find((m) => m.user_id === user.id)?.muted ?? false);
    } catch {
      // transient
    }
  }, [user, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveName = async () => {
    if (!circle || !name.trim() || name.trim() === circle.name) return;
    try {
      await renameCircle(circle.id, name);
      setCircle({ ...circle, name: name.trim() });
      showToast('Circle renamed');
    } catch (error) {
      showError(errorMessage(error, 'Could not rename the circle.'));
    }
  };

  const shareCode = async () => {
    if (!circle) return;
    try {
      await Share.share({
        message: `Join my prayer circle "${circle.name}" — open the app, tap Together → Join, and enter code ${circle.invite_code}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const toggleMute = async (value: boolean) => {
    if (!circle || !user) return;
    setMutedState(value);
    try {
      await setMuted(circle.id, user.id, value);
    } catch (error) {
      setMutedState(!value);
      showError(errorMessage(error, 'Could not update notifications.'));
    }
  };

  const confirmLeave = () => {
    if (!circle || !user) return;
    const doLeave = async () => {
      setBusy(true);
      try {
        await leaveCircle(circle.id, user.id);
        router.replace('/(tabs)/together');
      } catch (error) {
        showError(errorMessage(error, 'Could not leave the circle.'));
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') { void doLeave(); return; }
    Alert.alert('Leave this circle?', 'You’ll stop seeing its prayers. You can rejoin with the code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: doLeave },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.nameField}>
          <Kicker style={styles.nameKicker}>Circle name</Kicker>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            returnKeyType="done"
            maxLength={40}
          />
        </View>

        {/* Invite code — the only way in */}
        <Pressable style={styles.codeCard} onPress={shareCode} accessibilityRole="button" accessibilityLabel="Share invite code">
          <View style={styles.codeText}>
            <Kicker>Invite code</Kicker>
            <Text style={styles.code}>{circle?.invite_code || '······'}</Text>
            <Text style={styles.codeHint}>Anyone with this code can join. Share it only with people you trust.</Text>
          </View>
          <View style={styles.shareIcon}><Share2 size={18} color={colors.selectedText} /></View>
        </Pressable>

        <SettingsGroup label="Notifications">
          <SettingsRow label="Mute this circle" toggle on={muted} onToggle={toggleMute} />
        </SettingsGroup>

        <View style={styles.membersSection}>
          <Kicker style={styles.membersKicker}>{members.length} {members.length === 1 ? 'member' : 'members'}</Kicker>
          {members.map((m) => (
            <View key={m.user_id} style={styles.memberRow}>
              <Avatar name={m.display_name} size={36} />
              <View style={styles.memberText}>
                <Text style={styles.memberName}>{m.display_name}{m.user_id === user?.id ? ' · you' : ''}</Text>
                {m.role === 'leader' ? <Text style={styles.memberRole}>Created the circle</Text> : null}
              </View>
              {m.user_id === user?.id ? <Check size={16} color={colors.quiet} /> : null}
            </View>
          ))}
        </View>

        <Pressable onPress={confirmLeave} disabled={busy} style={styles.leaveBtn} accessibilityRole="button">
          <LogOut size={18} color={colors.red} />
          <Text style={styles.leaveText}>Leave circle</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 18 : 56,
    paddingBottom: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 80, gap: 22 },

  nameField: { gap: 8 },
  nameKicker: { marginLeft: 2 },
  nameInput: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: -0.6,
    paddingVertical: 4,
  },

  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
  },
  codeText: { flex: 1, gap: 4 },
  code: { fontFamily: fonts.sansBold, fontSize: 26, letterSpacing: 4, color: colors.ink },
  codeHint: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.quiet, lineHeight: 18, marginTop: 2 },
  shareIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.selectedBg,
    alignItems: 'center', justifyContent: 'center',
  },

  membersSection: { gap: 4 },
  membersKicker: { marginLeft: 2, marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  memberText: { flex: 1, gap: 2 },
  memberName: { fontFamily: fonts.sansSemiBold, fontSize: 15.5, color: colors.ink, letterSpacing: -0.2 },
  memberRole: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.quiet },

  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 8 },
  leaveText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.red, letterSpacing: -0.2 },
});
