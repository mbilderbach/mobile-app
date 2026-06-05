import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Play, Pencil, Trash2, Calendar, Repeat, BookOpen, Sparkles, ChevronRight } from 'lucide-react-native';
import { fonts, spacing, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Prayer, Session } from '@/lib/types';
import { Kicker, Card, ActionRow, PrimaryButton } from '@/components/ui';
import { cancelPrayerNotification, schedulePrayerNotification } from '@/lib/notifications';
import { errorMessage, isOfflineError, throwIfError } from '@/lib/writeSafety';
import { useToast } from '@/components/Toast';
import { LoadingState, ErrorState, type LoadStatus } from '@/components/ScreenState';
import { hapticSuccess } from '@/lib/haptics';

/** How many lines of the prayer body to show before the "Show full prayer" toggle. */
const COLLAPSED_BODY_LINES = 8;

function relativeDay(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfThat.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

function timeOfDay(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function durationLabel(secs: number): string {
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)} min`;
}

function totalTimeLabel(secs: number): string {
  const m = Math.round(secs / 60);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export default function PrayerDetailScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { showError, showUndo, showToast } = useToast();
  const [prayer, setPrayer] = useState<Prayer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAnsweredSheet, setShowAnsweredSheet] = useState(false);
  const [answerNote, setAnswerNote] = useState('');
  const [savingAnswered, setSavingAnswered] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [offline, setOffline] = useState(false);
  // Collapsible prayer body: measure total lines once, then clamp long bodies.
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyLineCount, setBodyLineCount] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !id) return;

    try {
      const pRes = await supabase
        .from('prayers')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (pRes.error) throw pRes.error;
      setPrayer(pRes.data);

      const sRes = await supabase
        .from('sessions')
        .select('*')
        .eq('prayer_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (sRes.error) throw sRes.error;
      setSessions(sRes.data || []);

      setStatus('ready');
    } catch (error) {
      setOffline(isOfflineError(error));
      setStatus('error');
    }
  }, [user, id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // Soft-delete: mark `deleted_at`, cancel any pending reminder, keep the prayer
  // and its sessions intact so Undo can fully restore them.
  const handleDelete = async () => {
    if (!prayer || deleting) return;
    setDeleting(true);
    const target = prayer;
    try {
      await cancelPrayerNotification(target.notification_id);
      throwIfError(
        await supabase
          .from('prayers')
          .update({ deleted_at: new Date().toISOString(), notification_id: null, updated_at: new Date().toISOString() })
          .eq('id', target.id),
        'Could not delete this prayer. Please try again.'
      );
      setShowDeleteConfirm(false);
      showUndo('Prayer deleted', () => restorePrayer(target));
      router.back();
    } catch (error) {
      showError(errorMessage(error, 'Could not delete this prayer. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  // Undo a soft-delete: clear `deleted_at` and re-arm the reminder if it was scheduled.
  const restorePrayer = async (target: Prayer) => {
    try {
      let notificationId: string | null = null;
      if (target.schedule_date && target.status === 'active') {
        notificationId = await schedulePrayerNotification({
          title: target.title,
          scheduleDate: target.schedule_date,
          scheduleTime: target.schedule_time,
        });
      }
      throwIfError(
        await supabase
          .from('prayers')
          .update({ deleted_at: null, notification_id: notificationId, updated_at: new Date().toISOString() })
          .eq('id', target.id),
        'Could not restore this prayer.'
      );
    } catch (error) {
      showError(errorMessage(error, 'Could not restore this prayer.'));
    }
  };

  const handleAnswered = async () => {
    if (!prayer) return;
    setSavingAnswered(true);
    const answeredAt = new Date().toISOString();
    try {
      await cancelPrayerNotification(prayer.notification_id);
      throwIfError(
        await supabase
          .from('prayers')
          .update({
            status: 'answered',
            answered_at: answeredAt,
            answer_note: answerNote.trim() || null,
            schedule_date: null,
            schedule_time: null,
            recurrence: 'none',
            next_fire: null,
            notification_id: null,
            updated_at: answeredAt,
          })
          .eq('id', prayer.id),
        'Could not mark this prayer answered. Your note is still here.'
      );
      hapticSuccess();
      setShowAnsweredSheet(false);
      setAnswerNote('');
      showToast('🙏 Marked as answered');
      await fetchData();
    } catch (error) {
      showError(errorMessage(error, 'Could not mark this prayer answered. Your note is still here.'));
    } finally {
      setSavingAnswered(false);
    }
  };

  // Remove a logged session (with Undo). Optimistic: drop locally, re-insert on undo.
  const handleDeleteSession = async (session: Session) => {
    setExpandedSession(null);
    try {
      throwIfError(
        await supabase.from('sessions').delete().eq('id', session.id),
        'Could not remove this session. Please try again.'
      );
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      showUndo('Session removed', () => restoreSession(session));
    } catch (error) {
      showError(errorMessage(error, 'Could not remove this session. Please try again.'));
    }
  };

  const restoreSession = async (session: Session) => {
    try {
      throwIfError(
        await supabase.from('sessions').insert({
          id: session.id,
          user_id: session.user_id,
          prayer_id: session.prayer_id,
          duration_seconds: session.duration_seconds,
          reflection: session.reflection,
          created_at: session.created_at,
        }),
        'Could not restore this session.'
      );
      fetchData();
    } catch (error) {
      showError(errorMessage(error, 'Could not restore this session.'));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (status !== 'ready' || !prayer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
        </View>
        {status === 'loading' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <ErrorState offline={offline} onRetry={fetchData} />
        ) : (
          <View style={styles.notFound}>
            <Text style={styles.notFoundText}>This prayer couldn't be found.</Text>
          </View>
        )}
      </View>
    );
  }

  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push({ pathname: '/edit-prayer', params: { id: prayer.id } })} hitSlop={12} accessibilityRole="button" accessibilityLabel="Edit prayer">
            <Pencil size={18} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => setShowDeleteConfirm(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete prayer">
            <Trash2 size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <Text style={styles.title}>{prayer.title}</Text>
          {prayer.description ? (
            <View style={styles.descWrap}>
              <View>
                <Text
                  style={styles.description}
                  numberOfLines={bodyExpanded ? undefined : COLLAPSED_BODY_LINES}
                >
                  {prayer.description}
                </Text>
                {/* Hidden twin measures the full line count so the toggle only
                    appears when the body actually overflows the clamp. */}
                <Text
                  style={[styles.description, styles.measure]}
                  onTextLayout={(e) => { if (bodyLineCount === null) setBodyLineCount(e.nativeEvent.lines.length); }}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {prayer.description}
                </Text>
                {!bodyExpanded && (bodyLineCount ?? 0) > COLLAPSED_BODY_LINES && (
                  <LinearGradient
                    colors={['rgba(248,248,250,0)', colors.paper]}
                    style={styles.bodyFade}
                    pointerEvents="none"
                  />
                )}
              </View>
              {(bodyLineCount ?? 0) > COLLAPSED_BODY_LINES && (
                <Pressable
                  onPress={() => setBodyExpanded((v) => !v)}
                  hitSlop={8}
                  style={styles.bodyToggle}
                  accessibilityRole="button"
                  accessibilityLabel={bodyExpanded ? 'Show less' : 'Show full prayer'}
                >
                  <Text style={styles.bodyToggleText}>{bodyExpanded ? 'Show less' : 'Show full prayer'}</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        {prayer.status === 'answered' && (
          <View style={styles.section}>
            <View style={styles.keepsake}>
              <View style={styles.keepsakeBadge}>
                <Sparkles size={18} color={colors.success} fill={colors.success} />
              </View>
              <Text style={styles.keepsakeKicker}>
                Answered{prayer.answered_at ? ` · ${relativeDay(prayer.answered_at)}` : ''}
              </Text>
              <Text style={styles.keepsakeTitle}>This prayer was answered.</Text>
              {prayer.answer_note ? (
                <Text style={styles.keepsakeNote}>“{prayer.answer_note}”</Text>
              ) : null}
            </View>
          </View>
        )}

        {(prayer.schedule_date || (prayer.recurrence && prayer.recurrence !== 'none')) && (
          <View style={styles.section}>
            <Kicker style={styles.sectionKicker}>Schedule</Kicker>
            <Card style={styles.groupCard}>
              {prayer.schedule_date && (
                <ActionRow
                  icon={<Calendar size={17} color={colors.muted} />}
                  label="Scheduled"
                  value={`${formatDate(prayer.schedule_date)}${prayer.schedule_time ? ` · ${formatTime(prayer.schedule_time)}` : ''}`}
                />
              )}
              {prayer.recurrence && prayer.recurrence !== 'none' && (
                <ActionRow
                  icon={<Repeat size={17} color={colors.muted} />}
                  label="Repeats"
                  value={prayer.recurrence}
                />
              )}
            </Card>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Kicker>Journey</Kicker>
            {sessions.length > 0 && (
              <Text style={styles.historySummary}>
                {sessions.length} session{sessions.length === 1 ? '' : 's'} · {totalTimeLabel(totalSeconds)}
              </Text>
            )}
          </View>

          {sessions.length === 0 ? (
            <View style={styles.timelineEmpty}>
              <Text style={styles.timelineEmptyTitle}>No sessions yet</Text>
              <Text style={styles.timelineEmptyBody}>Each time you pray, it'll be remembered here.</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {sessions.map((session, i) => {
                const expanded = expandedSession === session.id;
                const isLast = i === sessions.length - 1;
                const hasReflection = !!session.reflection?.trim();
                return (
                  <Pressable
                    key={session.id}
                    style={styles.tlRow}
                    onPress={() => setExpandedSession(expanded ? null : session.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Session ${relativeDay(session.created_at)}, ${durationLabel(session.duration_seconds)}`}
                  >
                    <View style={styles.tlRail}>
                      {!isLast && <View style={styles.tlLine} />}
                      <View style={[styles.tlDot, hasReflection ? styles.tlDotFull : styles.tlDotHollow]} />
                    </View>
                    <View style={[styles.tlContent, isLast && styles.tlContentLast]}>
                      <View style={styles.tlTopline}>
                        <Text style={styles.tlDay}>{relativeDay(session.created_at)}</Text>
                        <Text style={styles.tlMeta}>
                          {timeOfDay(session.created_at)} · {durationLabel(session.duration_seconds)}
                        </Text>
                      </View>
                      {hasReflection ? (
                        <Text style={styles.tlReflection} numberOfLines={expanded ? undefined : 2}>
                          {session.reflection}
                        </Text>
                      ) : (
                        <Text style={styles.tlReflectionMuted}>A quiet moment.</Text>
                      )}
                      {expanded && (
                        <Pressable
                          style={styles.tlRemove}
                          hitSlop={8}
                          onPress={() => handleDeleteSession(session)}
                          accessibilityRole="button"
                          accessibilityLabel="Remove this session"
                        >
                          <Trash2 size={13} color={colors.red} />
                          <Text style={styles.tlRemoveText}>Remove session</Text>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* A gentle invitation, surfaced after the journey rather than a buried icon. */}
        {prayer.status !== 'answered' && (
          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [styles.invite, pressed && styles.invitePressed]}
              onPress={() => setShowAnsweredSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Mark as answered"
            >
              <View style={styles.inviteBadge}>
                <Sparkles size={16} color={colors.success} />
              </View>
              <View style={styles.inviteBody}>
                <Text style={styles.inviteTitle}>Has this been answered?</Text>
                <Text style={styles.inviteSub}>Mark it answered and keep the testimony.</Text>
              </View>
              <ChevronRight size={18} color={colors.quiet} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {prayer.description?.trim() && prayer.read_along ? (
          <>
            <PrimaryButton
              label="Pray along"
              icon={<BookOpen size={16} color={colors.onPrimary} />}
              onPress={() => router.push({ pathname: '/pray-along', params: { prayerId: prayer.id, prayerTitle: prayer.title } })}
            />
            <Pressable
              style={styles.quietAction}
              hitSlop={8}
              onPress={() => router.push({ pathname: '/session', params: { prayerId: prayer.id, prayerTitle: prayer.title } })}
            >
              <Text style={styles.quietActionText}>Or sit with a quiet timer</Text>
            </Pressable>
          </>
        ) : (
          <PrimaryButton
            label="Pray now"
            icon={<Play size={16} color={colors.onPrimary} fill={colors.onPrimary} />}
            onPress={() => router.push({ pathname: '/session', params: { prayerId: prayer.id, prayerTitle: prayer.title } })}
          />
        )}
      </View>

      {showAnsweredSheet && (
        <KeyboardAvoidingView
          style={styles.confirmOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Card style={styles.answeredSheet}>
            <View style={styles.answeredHeader}>
              <View style={styles.answeredBadge}>
                <Sparkles size={22} color={colors.success} fill={colors.success} />
              </View>
              <Text style={styles.answeredSheetTitle}>A prayer answered</Text>
              <Text style={styles.answeredSheetSub}>
                Capture what happened. It'll move to your Answered collection in Browse — a record you can return to.
              </Text>
            </View>
            <TextInput
              style={styles.answerInput}
              placeholder="What happened? A short testimony…"
              placeholderTextColor={colors.quiet}
              value={answerNote}
              onChangeText={setAnswerNote}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <PrimaryButton
              label={savingAnswered ? 'Saving…' : 'Mark as answered'}
              onPress={handleAnswered}
              disabled={savingAnswered}
              loading={savingAnswered}
            />
            <Pressable style={styles.answeredNotYet} hitSlop={8} onPress={() => setShowAnsweredSheet(false)} accessibilityRole="button" accessibilityLabel="Not yet">
              <Text style={styles.answeredNotYetText}>Not yet</Text>
            </Pressable>
          </Card>
        </KeyboardAvoidingView>
      )}

      {showDeleteConfirm && (
        <View style={styles.confirmOverlay}>
          <Card style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>Delete prayer?</Text>
            <Text style={styles.confirmDesc}>
              {sessions.length > 0
                ? `Its ${sessions.length} logged session${sessions.length > 1 ? 's' : ''} stay with it. You can undo right after.`
                : 'You can undo right after.'}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={({ pressed }) => [styles.confirmCancel, pressed && styles.confirmCancelPressed]} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.confirmDelete, pressed && styles.confirmDeletePressed]} onPress={handleDelete} disabled={deleting}>
                <Text style={styles.confirmDeleteText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    paddingBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  notFoundText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: 'center' },
  heroSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  description: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
    marginTop: 10,
  },
  descWrap: { marginTop: 0 },
  // Absolutely-stacked twin used only to measure full line count; never visible.
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  bodyFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 52 },
  bodyToggle: { marginTop: 12, alignSelf: 'flex-start' },
  bodyToggleText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.selectedText, letterSpacing: -0.1 },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionKicker: {
    marginBottom: 12,
    marginLeft: 4,
  },
  groupCard: {
    gap: 8,
  },
  // Answered keepsake — a soft, success-tinted testimony card.
  keepsake: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.18)',
  },
  keepsakeBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(52,199,89,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  keepsakeKicker: {
    fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    color: colors.success,
  },
  keepsakeTitle: {
    fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: -0.5, lineHeight: 28, marginTop: 6,
  },
  keepsakeNote: {
    fontFamily: fonts.serifItalic, fontSize: 16, color: colors.inkSoft, lineHeight: 25, marginTop: 12,
  },

  // Journey / session-history timeline.
  historyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, marginLeft: 4,
  },
  historySummary: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, letterSpacing: -0.1 },
  timelineEmpty: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 4, ...shadow.card,
  },
  timelineEmptyTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, letterSpacing: -0.2 },
  timelineEmptyBody: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, lineHeight: 20 },
  timeline: { paddingLeft: 4 },
  tlRow: { flexDirection: 'row', gap: 14 },
  tlRail: { width: 12, alignItems: 'center' },
  tlLine: { position: 'absolute', top: 8, bottom: -4, width: 1.5, backgroundColor: colors.divider },
  tlDot: { width: 11, height: 11, borderRadius: 6, marginTop: 3 },
  tlDotFull: { backgroundColor: colors.muted },
  tlDotHollow: { backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.divider },
  tlContent: { flex: 1, paddingBottom: 22 },
  tlContentLast: { paddingBottom: 0 },
  tlTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tlDay: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, letterSpacing: -0.2 },
  tlMeta: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.quiet },
  tlReflection: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 6 },
  tlReflectionMuted: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.faint, marginTop: 5, fontStyle: 'italic' },
  tlRemove: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  tlRemoveText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.red, letterSpacing: -0.1 },

  // Answered invitation row.
  invite: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, ...shadow.card,
  },
  invitePressed: { opacity: 0.94 },
  inviteBadge: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(52,199,89,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  inviteBody: { flex: 1, gap: 2 },
  inviteTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15.5, color: colors.ink, letterSpacing: -0.2 },
  inviteSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
    paddingTop: 12,
  },
  quietAction: { alignSelf: 'center', paddingVertical: 12, marginTop: 4 },
  quietActionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted, letterSpacing: -0.1 },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25,24,33,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  confirmSheet: {
    width: '100%',
    maxWidth: 320,
    padding: spacing.lg,
  },
  confirmTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  confirmDesc: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
  },
  confirmCancelPressed: {
    backgroundColor: colors.fill,
  },
  confirmCancelText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.ink,
  },
  answerInput: {
    minHeight: 112,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    padding: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
  },
  // Answered "moment" sheet.
  answeredSheet: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.lg,
    gap: spacing.md,
  },
  answeredHeader: { alignItems: 'center', gap: 8 },
  answeredBadge: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(52,199,89,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  answeredSheetTitle: {
    fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.6, textAlign: 'center',
  },
  answeredSheetSub: {
    fontFamily: fonts.sans, fontSize: 14, color: colors.muted, lineHeight: 20, textAlign: 'center', paddingHorizontal: 6,
  },
  answeredNotYet: { alignSelf: 'center', paddingVertical: 6 },
  answeredNotYetText: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.muted, letterSpacing: -0.1 },
  confirmDelete: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  confirmDeletePressed: {
    opacity: 0.9,
  },
  confirmDeleteText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.white,
  },
});
