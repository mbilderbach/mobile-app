/**
 * Request detail — the emotional center of Together.
 *
 * For a carrier: the named presence line + a carry hero ("I'm praying for
 * Daniel" → "Praying with you"), plus Pray-along if there's body text, and a
 * "remind me" for a time-bound moment with the quiet convergence line.
 *
 * For the owner: the same, plus posting updates and marking it answered (which
 * settles the request into a kept, warm record rather than deleting it).
 *
 * The rule, made literal in a footnote: your name, no count. Carriers earn
 * nothing and cannot post free text.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Clock, Check, Heart, BookOpen, Bell, BellRing } from 'lucide-react-native';
import { fonts, spacing, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Kicker, PrimaryButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/circle/CircleBits';
import { hapticSuccess, hapticSelection } from '@/lib/haptics';
import {
  getRequest, listCarriers, listUpdates, listMomentReminders,
  carry, uncarry, assuranceLine, answerRequest, withdrawRequest,
  postUpdate, setMomentReminder, clearMomentReminder,
} from '@/lib/circles';
import { errorMessage } from '@/lib/writeSafety';
import type { SharedPrayerCard, CarryCard, SharedPrayerUpdate, CarryReminderCard } from '@/lib/types';

function momentLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} · ${time}`;
}

export default function CircleRequestScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { showError, showToast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [request, setRequest] = useState<SharedPrayerCard | null>(null);
  const [carriers, setCarriers] = useState<CarryCard[]>([]);
  const [updates, setUpdates] = useState<SharedPrayerUpdate[]>([]);
  const [reminders, setReminders] = useState<CarryReminderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updateDraft, setUpdateDraft] = useState('');
  const [gratitudeDraft, setGratitudeDraft] = useState('');
  const [answering, setAnswering] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [r, c, u, rem] = await Promise.all([
        getRequest(id), listCarriers(id), listUpdates(id), listMomentReminders(id),
      ]);
      setRequest(r);
      setCarriers(c);
      setUpdates(u);
      setReminders(rem);
    } catch {
      // leave prior state; a toast would be noise on a transient refocus
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !request) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
        </View>
        {!loading ? (
          <View style={styles.missing}><Text style={styles.missingText}>This prayer isn’t available.</Text></View>
        ) : null}
      </View>
    );
  }

  const iCarry = request.i_carried;
  const mine = request.is_mine;
  const answered = request.status === 'answered';
  const who = request.anonymous ? 'Someone' : request.owner_name || (mine ? 'You' : 'Someone');
  const firstName = (request.owner_name || 'them').split(' ')[0];
  const myReminder = reminders.find((r) => r.is_me);
  const otherReminders = reminders.filter((r) => !r.is_me);

  const toggleCarry = async () => {
    if (busy || !user || answered) return;
    setBusy(true);
    try {
      if (iCarry) {
        await uncarry(id, user.id);
      } else {
        await carry(id, user.id);
        hapticSuccess();
      }
      await load();
    } catch (error) {
      showError(errorMessage(error, 'Could not update. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // Deep carry: record the carry, then open Pray-along with this request's text.
  const prayAlong = async () => {
    if (!user) return;
    try { if (!iCarry) { await carry(id, user.id); } } catch { /* still let them pray */ }
    router.push({
      pathname: '/pray-along',
      params: { sharedTitle: request.title, sharedBody: request.body || '' },
    });
  };

  const toggleReminder = async () => {
    if (!user || !request.moment_at) return;
    setBusy(true);
    try {
      if (myReminder) {
        await clearMomentReminder(id, user.id);
      } else {
        await setMomentReminder({ requestId: id, userId: user.id, momentAt: request.moment_at, ownerName: request.owner_name });
        hapticSelection();
      }
      await load();
    } catch (error) {
      showError(errorMessage(error, 'Could not set the reminder.'));
    } finally {
      setBusy(false);
    }
  };

  const submitUpdate = async () => {
    if (!user || !updateDraft.trim() || busy) return;
    setBusy(true);
    try {
      await postUpdate(id, user.id, updateDraft);
      setUpdateDraft('');
      await load();
    } catch (error) {
      showError(errorMessage(error, 'Could not post the update.'));
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await answerRequest(id, gratitudeDraft);
      hapticSuccess();
      showToast('🙏 Marked answered — kept for your circle');
      await load();
      setAnswering(false);
    } catch (error) {
      showError(errorMessage(error, 'Could not mark answered.'));
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await withdrawRequest(id);
      router.back();
    } catch (error) {
      showError(errorMessage(error, 'Could not withdraw.'));
      setBusy(false);
    }
  };

  const reminderConvergence = () => {
    if (!request.moment_at) return null;
    const names = otherReminders.map((r) => r.member_name || 'Someone');
    if (myReminder && names.length === 0) return 'You’ll be reminded to pray then.';
    if (names.length === 0) return null;
    const lead = myReminder ? ['You', ...names] : names;
    if (lead.length === 1) return `${lead[0]} plans to pray then.`;
    if (lead.length === 2) return `${lead[0]} & ${lead[1]} plan to pray then.`;
    return `${lead[0]} & ${lead.length - 1} others plan to pray then.`;
  };

  const convergence = reminderConvergence();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Asker */}
          <View style={styles.askerRow}>
            <Avatar name={request.anonymous ? null : request.owner_name} size={40} dim={request.anonymous} />
            <View style={styles.askerText}>
              <Text style={styles.askerName}>{who}{mine ? ' · you' : ''}</Text>
              <Text style={styles.askerMeta}>{new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </View>
            {answered ? (
              <View style={styles.answeredTag}>
                <Check size={13} color={colors.quiet} />
                <Text style={styles.answeredTagText}>Answered</Text>
              </View>
            ) : null}
          </View>

          {request.category ? <Kicker style={styles.cat}>{request.category}</Kicker> : null}
          <Text style={styles.title}>{request.title}</Text>
          {request.body ? <Text style={styles.body}>{request.body}</Text> : null}

          {/* Time-bound moment */}
          {request.moment_at && !answered ? (
            <View style={styles.momentCard}>
              <View style={styles.momentHead}>
                <Clock size={16} color={colors.selectedText} />
                <Text style={styles.momentWhen}>{momentLabel(request.moment_at)}</Text>
              </View>
              <Pressable
                style={[styles.remindBtn, myReminder && styles.remindBtnOn]}
                onPress={toggleReminder}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={myReminder ? 'Cancel reminder' : 'Remind me to pray then'}
              >
                {myReminder ? <BellRing size={16} color={colors.selectedText} /> : <Bell size={16} color={colors.muted} />}
                <Text style={[styles.remindText, myReminder && styles.remindTextOn]}>
                  {myReminder ? 'Reminder set' : 'Remind me to pray then'}
                </Text>
              </Pressable>
              {convergence ? <Text style={styles.convergence}>{convergence}</Text> : null}
            </View>
          ) : null}

          {/* Presence — the named assurance */}
          <View style={styles.presenceCard}>
            <Text style={styles.presenceLine}>{assuranceLine(carriers)}</Text>
            {carriers.length > 0 ? (
              <View style={styles.carrierAvatars}>
                {carriers.slice(0, 6).map((c) => (
                  <View key={c.user_id} style={styles.carrierAvatar}>
                    <Avatar name={c.carrier_name} size={28} />
                  </View>
                ))}
              </View>
            ) : null}
            {!answered ? <Text style={styles.footnote}>Your name, no count. Carrying is its own quiet gift.</Text> : null}
          </View>

          {/* Gratitude (answered) */}
          {answered && request.gratitude_note ? (
            <View style={styles.gratitudeCard}>
              <Heart size={16} color={colors.selectedText} />
              <Text style={styles.gratitudeText}>“{request.gratitude_note}”</Text>
            </View>
          ) : null}

          {/* Updates thread (owner-authored only) */}
          {updates.length > 0 ? (
            <View style={styles.updates}>
              <Kicker style={styles.updatesKicker}>Updates</Kicker>
              {updates.map((u) => (
                <View key={u.id} style={styles.updateItem}>
                  <Text style={styles.updateBody}>{u.body}</Text>
                  <Text style={styles.updateMeta}>{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Owner: post an update */}
          {mine && !answered ? (
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                placeholder="Post an update for your circle…"
                placeholderTextColor={colors.quiet}
                value={updateDraft}
                onChangeText={setUpdateDraft}
                multiline
              />
              <Pressable
                style={[styles.composerSend, !updateDraft.trim() && styles.composerSendOff]}
                onPress={submitUpdate}
                disabled={!updateDraft.trim() || busy}
                accessibilityRole="button"
                accessibilityLabel="Post update"
              >
                <Text style={styles.composerSendText}>Post</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Owner: answer / gratitude */}
          {mine && !answered ? (
            answering ? (
              <View style={styles.answerCard}>
                <Kicker>How was it answered?</Kicker>
                <TextInput
                  style={styles.gratitudeInput}
                  placeholder="A line of gratitude (optional)…"
                  placeholderTextColor={colors.quiet}
                  value={gratitudeDraft}
                  onChangeText={setGratitudeDraft}
                  multiline
                  autoFocus
                />
                <PrimaryButton label="Mark answered" onPress={submitAnswer} loading={busy} />
                <Pressable onPress={() => setAnswering(false)} hitSlop={8} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Not yet</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setAnswering(true)} style={styles.answerLink} accessibilityRole="button">
                <Check size={16} color={colors.selectedText} />
                <Text style={styles.answerLinkText}>Mark as answered</Text>
              </Pressable>
            )
          ) : null}
        </ScrollView>

        {/* Carry hero (non-owner, open request) */}
        {!mine && !answered ? (
          <View style={styles.footer}>
            {request.body ? (
              <Pressable style={styles.prayAlong} onPress={prayAlong} accessibilityRole="button" accessibilityLabel="Read and pray along">
                <BookOpen size={18} color={colors.selectedText} />
                <Text style={styles.prayAlongText}>Read & pray along</Text>
              </Pressable>
            ) : null}
            <PrimaryButton
              label={iCarry ? 'Praying with you' : `I’m praying for ${firstName}`}
              icon={iCarry ? <Heart size={18} color={colors.onPrimary} fill={colors.onPrimary} /> : undefined}
              onPress={toggleCarry}
              loading={busy}
            />
          </View>
        ) : null}

        {/* Owner withdraw (open request) */}
        {mine && !answered ? (
          <View style={styles.footer}>
            <Pressable onPress={doWithdraw} hitSlop={8} style={styles.withdrawBtn} accessibilityRole="button">
              <Text style={styles.withdrawText}>Stop sharing this</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 18 : 56,
    paddingBottom: 4,
  },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 24, gap: 16 },

  askerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  askerText: { flex: 1, gap: 2 },
  askerName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, letterSpacing: -0.2 },
  askerMeta: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.quiet },
  answeredTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  answeredTagText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.quiet, textTransform: 'uppercase', letterSpacing: 0.2 },

  cat: { marginTop: 4 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 16.5, lineHeight: 26, color: colors.inkSoft, letterSpacing: -0.2 },

  momentCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow.card },
  momentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  momentWhen: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, letterSpacing: -0.2 },
  remindBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: radius.pill, backgroundColor: colors.fill,
  },
  remindBtnOn: { backgroundColor: colors.selectedBg },
  remindText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.muted, letterSpacing: -0.1 },
  remindTextOn: { color: colors.selectedText },
  convergence: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 },

  presenceCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, gap: 12, ...shadow.card },
  presenceLine: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.selectedText, letterSpacing: -0.3 },
  carrierAvatars: { flexDirection: 'row' },
  carrierAvatar: { marginRight: -8 },
  footnote: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.quiet, lineHeight: 18 },

  gratitudeCard: { flexDirection: 'row', gap: 10, backgroundColor: colors.selectedBg, borderRadius: radius.lg, padding: 16 },
  gratitudeText: { flex: 1, fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 24, color: colors.ink },

  updates: { gap: 10 },
  updatesKicker: { marginLeft: 2 },
  updateItem: { backgroundColor: colors.fill, borderRadius: radius.md, padding: 14, gap: 4 },
  updateBody: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.ink },
  updateMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.quiet },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.fill, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.sans, fontSize: 15, color: colors.ink,
  },
  composerSend: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primary },
  composerSendOff: { opacity: 0.4 },
  composerSendText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.onPrimary },

  answerLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  answerLinkText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.selectedText, letterSpacing: -0.2 },
  answerCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, gap: 12, ...shadow.card },
  gratitudeInput: {
    minHeight: 80, backgroundColor: colors.fill, borderRadius: radius.md, padding: 14,
    fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top',
  },
  linkBtn: { alignSelf: 'center', paddingVertical: 6 },
  linkText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },

  footer: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 20 : 36,
  },
  prayAlong: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: radius.pill, backgroundColor: colors.selectedBg,
  },
  prayAlongText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.selectedText, letterSpacing: -0.2 },
  withdrawBtn: { alignSelf: 'center', paddingVertical: 8 },
  withdrawText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.red },

  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontFamily: fonts.sans, fontSize: 14, color: colors.quiet },
});
