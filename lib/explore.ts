/**
 * Explore — a bundled library of pre-written prayers.
 *
 * This solves cold start: a new user opens the app to an empty list and has
 * nothing to begin from. The Explore strip on the Prayers screen surfaces a few
 * categories of starter prayers; tapping one opens a browsable list, and any
 * prayer previews in full with a single "Use this prayer" action that pre-fills
 * the New Prayer form — so the user edits and owns it from day one.
 *
 * Content lives here, bundled with the app (not in Supabase) on purpose: it
 * works instantly, offline, with no migration. To grow the library, add entries
 * below — each prayer's `body` becomes the description and reads beautifully in
 * the Pray-along teleprompter (one thought per line).
 *
 * `categoryKey` maps a starter prayer to one of the app's built-in category
 * colours (see GROUP_COLORS) so that, when saved, the created category carries a
 * sensible hue. It is intentionally decoupled from the Explore section id.
 */
import type { GroupColorKey } from '@/lib/types';

export interface ExplorePrayer {
  id: string;
  title: string;
  /**
   * The prayer text. May be hand-broken into lines (one thought per line) or a
   * single classical paragraph — the teleprompter splits long lines on sentence
   * boundaries either way.
   */
  body: string;
  /** Short preview line shown in the category list. Optional for sourced prayers. */
  blurb?: string;
  /** Attribution for sourced/public-domain prayers, e.g. "John Wesley". */
  author?: string;
  /** Year or era of the source, e.g. "1662". */
  date?: string;
}

/**
 * The one-line subtitle shown beneath a prayer's title in lists and search.
 * Prefers a hand-written blurb; otherwise falls back to attribution.
 */
export function explorePrayerSubtitle(p: ExplorePrayer): string {
  if (p.blurb) return p.blurb;
  if (!p.author) return '';
  // Some authors already embed the year (e.g. "Book of Common Prayer, 1662");
  // only append the date when it isn't already part of the attribution.
  if (p.date && !p.author.includes(p.date)) return `${p.author} · ${p.date}`;
  return p.author;
}

export interface ExploreCategory {
  id: string;
  /** Display name, e.g. "Morning". */
  name: string;
  emoji: string;
  /** One-line description shown on the category card. */
  tagline: string;
  /** Built-in colour key applied to the category if the user saves a prayer from here. */
  categoryKey: GroupColorKey;
  prayers: ExplorePrayer[];
}

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  {
    id: 'morning',
    name: 'Morning',
    emoji: '🌅',
    tagline: 'Begin the day with intention',
    categoryKey: 'amber',
    prayers: [
      {
        id: 'morning_001',
        title: 'Collect for Grace',
        author: 'Book of Common Prayer, 1662',
        date: '1662',
        body: 'O Lord our heavenly Father, Almighty and everlasting God, who hast safely brought us to the beginning of this day: Defend us in the same with thy mighty power; and grant that this day we fall into no sin, neither run into any kind of danger; but that all our doings may be ordered by thy governance, to do always that is righteous in thy sight; through Jesus Christ our Lord. Amen.',
      },
      {
        id: 'morning_002',
        title: 'Collect for Peace',
        author: 'Book of Common Prayer, 1662',
        date: '1662',
        body: 'O God, who art the author of peace and lover of concord, in knowledge of whom standeth our eternal life, whose service is perfect freedom: Defend us thy humble servants in all assaults of our enemies; that we, surely trusting in thy defence, may not fear the power of any adversaries; through the might of Jesus Christ our Lord. Amen.',
      },
      {
        id: 'morning_003',
        title: 'The Covenant Prayer',
        author: 'John Wesley',
        date: '1755',
        body: 'I am no longer my own, but thine. Put me to what thou wilt, rank me with whom thou wilt; put me to doing, put me to suffering; let me be employed for thee or laid aside for thee, exalted for thee or brought low for thee; let me be full, let me be empty; let me have all things, let me have nothing; I freely and heartily yield all things to thy pleasure and disposal. And now, O glorious and blessed God, Father, Son, and Holy Ghost, thou art mine, and I am thine. So be it. And the covenant which I have made on earth, let it be ratified in heaven. Amen.',
      },
      {
        id: 'morning_004',
        title: 'Prayer Before the Day',
        author: 'John Calvin',
        date: '1542',
        body: 'My God, my Father and Preserver, who of thy goodness hast watched over me during the past night, and brought me to this day, grant also that I may spend it wholly in the worship and service of thy most holy deity. Let me not think, or say, or do a single thing which tends not to thy service and submission to thy will, that thus all my actions may aim at thy glory and the salvation of my brethren, while they are taught by my example to serve thee. And as thou art giving light to this world for the purposes of external life by the rays of the sun, so enlighten my mind by the effulgence of thy Spirit, that he may guide me in the way of thy righteousness. To whatever purpose I apply my mind, may the end which I ever propose to myself be thy honour and service. May I expect all happiness from thy grace and goodness only. Let me not attempt any thing whatever that is not pleasing to thee. Hear me, O God, Father and Preserver, through Jesus Christ thy Son. Amen.',
      },
      {
        id: 'morning_005',
        title: 'Monday Morning Prayer',
        author: 'John Wesley',
        date: 'c. 1745',
        body: 'We humble ourselves, O Lord of heaven and earth, before thy glorious majesty. We acknowledge thy eternal power, wisdom, goodness, and truth; and desire to render thee unfeigned thanks for all the benefits thou pourest upon us, but above all, for thine inestimable love in the redemption of the world by our Lord Jesus Christ. We implore thy tender mercies in the forgiveness of all our sins, whereby we have offended either in thought, word, or deed. We desire to be truly sorry for all our misdoings, and utterly to renounce whatsoever is contrary to thy will. We desire to devote our whole man, body, soul, and spirit, to thee. Thou hast mercifully kept us the last night; blessed be thy continued goodness. Receive us likewise into thy protection this day. Guide and assist us in all our thoughts, words, and actions. Make us willing to do and suffer what thou pleasest; waiting for the mercy of our Lord, Christ Jesus, unto eternal life. Amen.',
      },
      {
        id: 'morning_006',
        title: 'A Morning Hymn',
        author: 'Thomas Ken',
        date: '1674',
        body: "Awake, my soul, and with the sun thy daily stage of duty run; shake off dull sloth, and joyful rise to pay thy morning sacrifice. Thy precious time misspent redeem; each present day thy last esteem; improve thy talent with due care; for the great day thyself prepare. By influence of the light divine let thy own light to others shine; reflect all heaven's propitious ways in ardent love and cheerful praise. Wake, and lift up thyself, my heart, and with the angels bear thy part, who all night long unwearied sing high praise to the eternal King. Lord, I my vows to thee renew; disperse my sins as morning dew; guard my first springs of thought and will, and with thyself my spirit fill. Direct, control, suggest, this day, all I design, or do, or say; that all my powers, with all their might, in thy sole glory may unite. Amen.",
      },
      {
        id: 'morning_007',
        title: 'Psalm 57:7–8',
        author: 'King James Version, 1611',
        date: '1611',
        body: 'My heart is fixed, O God, my heart is fixed: I will sing and give praise. Awake up, my glory; awake, psaltery and harp: I myself will awake early.',
      },
      {
        id: 'morning_008',
        title: 'Friday Morning Prayer',
        author: 'John Wesley',
        date: 'c. 1745',
        body: 'O Lord God, merciful and gracious, long-suffering, and abundant in goodness and truth; thou keepest mercy for thousands; thou pardonest iniquity, and transgression, and sin. And now that thou hast renewed our lives and thy mercies to us this morning, help us to renew our desires and resolutions and endeavors to live in obedience to thy holy will. O restrain us from the sins into which we are most prone to fall, and quicken us to the duties we are most averse to perform. And grant that we may think, and speak, and will, and do, the things becoming the children of our heavenly Father. Through Jesus Christ our Savior. Amen.',
      },
      {
        id: 'morning_009',
        title: "St. Patrick's Breastplate",
        author: 'Attributed to St. Patrick, trans. Cecil Frances Alexander',
        date: 'Original c. 5th century; translation 1889',
        body: "I arise today through a mighty strength, the invocation of the Trinity, through belief in the Threeness, through confession of the Oneness of the Creator of creation. I arise today through the strength of Christ's birth with His baptism, through the strength of His crucifixion with His burial, through the strength of His resurrection with His ascension, through the strength of His descent for the judgment of doom. I arise today through God's strength to pilot me, God's might to uphold me, God's wisdom to guide me, God's eye to look before me, God's ear to hear me, God's word to speak for me, God's hand to guard me, God's way to lie before me, God's shield to protect me. Christ with me, Christ before me, Christ behind me, Christ in me, Christ beneath me, Christ above me, Christ on my right, Christ on my left, Christ when I sit down, Christ when I arise, Christ in the heart of every man who thinks of me, Christ in the mouth of everyone who speaks of me, Christ in every eye that sees me, Christ in every ear that hears me. Amen.",
      },
      {
        id: 'morning_010',
        title: 'Saturday Morning Prayer',
        author: 'John Wesley',
        date: 'c. 1745',
        body: 'We present ourselves before thee, O Lord our God, to pay our tribute of prayer and thanksgiving; desiring thee mercifully to accept us and our services, at the hands of Jesus Christ. In his great name we come to beg thy pardon and peace, the increase of thy grace, and the tokens of thy love; for we are not worthy of the least of thy mercies. O teach us to know thee, our God, and Jesus Christ whom thou hast sent; and enable us to do thy will on earth, as it is done in heaven. Give us to fear thee and to love thee, to trust and delight in thee, and to cleave to thee with full purpose of heart. Day by day we magnify thee, O Lord, who makest every day an addition to thy mercies. We bless thee for preserving us during the night past, and for the rest thou gavest us therein. O cause us to hear thy loving-kindness in the morning, for in thee do we trust. Through Jesus Christ our Lord. Amen.',
      },
    ],
  },
  {
    id: 'evening',
    name: 'Evening',
    emoji: '🌙',
    tagline: 'Rest and release the day',
    categoryKey: 'slate',
    prayers: [
      {
        id: 'evening_001',
        title: 'Collect for Peace (Evening Prayer)',
        author: 'Book of Common Prayer, 1662',
        date: '1662',
        body: 'O God, from whom all holy desires, all good counsels, and all just works do proceed: give unto thy servants that peace which the world cannot give, that both our hearts may be set to obey thy commandments, and also that by thee we being defended from the fear of our enemies, may pass our time in rest and quietness, through the merits of Jesus Christ our Saviour. Amen.',
      },
      {
        id: 'evening_002',
        title: 'Collect for Aid Against All Perils (Evening Prayer)',
        author: 'Book of Common Prayer, 1662',
        date: '1662',
        body: 'Lighten our darkness, we beseech thee, O Lord, and by thy great mercy defend us from all perils and dangers of this night, for the love of thy only Son, our Saviour Jesus Christ. Amen.',
      },
      {
        id: 'evening_003',
        title: 'General Confession (Evening Prayer)',
        author: 'Book of Common Prayer, 1662',
        date: '1662',
        body: 'Almighty and most merciful Father, we have erred and strayed from thy ways like lost sheep. We have followed too much the devices and desires of our own hearts. We have offended against thy holy laws. We have left undone those things which we ought to have done, and we have done those things which we ought not to have done, and there is no health in us. But thou, O Lord, have mercy upon us miserable offenders; spare thou them, O God, which confess their faults; restore thou them that are penitent, according to thy promises declared unto mankind in Christ Jesu our Lord. And grant, O most merciful Father, for his sake, that we may hereafter live a godly, righteous, and sober life, to the glory of thy holy Name. Amen.',
      },
      {
        id: 'evening_004',
        title: 'An Evening Hymn',
        author: 'Thomas Ken',
        date: '1674',
        body: 'Glory to thee, my God, this night, for all the blessings of the light; keep me, O keep me, King of kings, beneath thine own almighty wings. Forgive me, Lord, for thy dear Son, the ill that I this day have done, that with the world, myself, and thee, I, ere I sleep, at peace may be. Teach me to live, that I may dread the grave as little as my bed; teach me to die, that so I may rise glorious at the judgment day. O may my soul on thee repose, and with sweet sleep mine eyelids close; sleep that may me more vigorous make to serve my God when I awake. Amen.',
      },
      {
        id: 'evening_005',
        title: 'Sunday Evening Prayer',
        author: 'John Wesley',
        date: 'c. 1745',
        body: 'O thou high and holy One that inhabitest eternity, thou art to be feared and loved by all thy servants. We thank thee for thy marvellous love in Christ Jesus, by whom thou hast reconciled the world to thyself. We offer up again our souls and bodies to thee, to be governed, not by our will, but by thine. O let it be ever the ease and joy of our hearts to be under the conduct of thy unerring wisdom, to follow thy counsels, and to be ruled in all things by thy holy will. And let us never distrust thy abundant kindness and tender care over us, whatsoever it is that thou wouldst have us to do or to suffer in this world. Through Jesus Christ our Lord. Amen.',
      },
      {
        id: 'evening_006',
        title: 'Monday Evening Prayer',
        author: 'John Wesley',
        date: 'c. 1745',
        body: 'Almighty and most merciful Father, in whom we live, move, and have our being; to whose tender compassions we owe our safety in the day past, together with all the comforts of this life, and the hopes of that which is to come: we praise thee, O Lord, we bow ourselves before thee, acknowledging that we have nothing but what we receive from thee. Blessed be thy goodness for our health, for our food and raiment, for our peace and safety, for the love of our friends, for all blessings in this life, and for our desire to attain that life which is immortal. And now that we are going to lay ourselves down to sleep, take us into thy gracious protection, and settle our spirits in quiet and thankful thoughts, that whether we wake or sleep, we may live together with him. Through Jesus Christ our Lord. Amen.',
      },
      {
        id: 'evening_007',
        title: 'Tuesday Evening Prayer',
        author: 'John Wesley',
        date: 'c. 1745',
        body: 'Almighty and everlasting God, the sovereign Lord of all creatures in heaven and earth, we acknowledge that our being, and all the comforts of it, depend on thee, the fountain of all good. To thee therefore be given by us, and by all creatures whom thou hast made, all honour and praise, all love and obedience, as long as we have any being. We pray thee to increase every good desire which we feel already in our hearts; and let us always live as becomes thy creatures, as becomes the disciples of Jesus Christ. Accept likewise our thanks for thy merciful preservation of us during this day. We are bold again to commit ourselves unto thee this night. Defend us from all the powers of darkness, and raise up our spirits together with our bodies in the morning, to such a vigorous sense of thy continued goodness, as may provoke us all the day long to an unwearied diligence in well-doing. Through Jesus Christ our Lord. Amen.',
      },
      {
        id: 'evening_008',
        title: "Calvin's Prayer After the Day",
        author: 'John Calvin',
        date: '1542',
        body: 'O Lord God, who hast given man the night for rest, as thou hast created the day in which he may employ himself in labour: grant, I pray, that my body may so rest during this night, that my mind cease not to be awake to thee, nor my heart faint or be overcome with torpor, preventing it from adhering steadfastly to the love of thee. While laying aside my cares to relax and relieve my mind, may I not, in the meantime, forget thee, nor may the remembrance of thy goodness and grace, which ought always to be deeply engraven on my memory, escape me. In like manner, also, as my body rests, may my conscience enjoy repose. Amen.',
      },
      {
        id: 'evening_009',
        title: 'Nunc Dimittis (Song of Simeon)',
        author: 'Book of Common Prayer, 1662',
        date: '1662',
        body: 'Lord, now lettest thou thy servant depart in peace, according to thy word. For mine eyes have seen thy salvation, which thou hast prepared before the face of all people; to be a light to lighten the Gentiles, and to be the glory of thy people Israel. Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.',
      },
      {
        id: 'evening_010',
        title: 'Wednesday Evening Prayer',
        author: 'John Wesley',
        date: 'c. 1745',
        body: 'O Lord, how manifold are thy works; in wisdom hast thou made them all. The day is thine, the night also is thine; thou hast prepared the light and the sun. We render thee thanks for all the benefits which thou hast bestowed on the whole world, and especially on us, whom thou hast called to the knowledge of thy grace in Christ Jesus. Into thy hands we commend both our souls and bodies, which thou hast mercifully preserved this day. O continue these holy thoughts and desires in us till we fall asleep, that we may receive the light of the morning with a new joy in thee, and with thankful affection to thee. Through Jesus Christ our Lord. Amen.',
      },
    ],
  },
  {
    id: 'healing',
    name: 'Healing',
    emoji: '🕊️',
    tagline: 'For body, mind, and heart',
    categoryKey: 'sky',
    prayers: [
      {
        id: 'healing-for-the-body',
        title: 'For healing of the body',
        blurb: 'When you or someone you love is unwell.',
        body: [
          'Lord, you are the healer.',
          'I bring this hurting body to you —',
          'every ache, every fear, every unknown.',
          '',
          'Bring your healing where it is needed.',
          'Steady the hands of those who care for us.',
          'Give patience for the slow days',
          'and hope when healing feels far off.',
          '',
          'Whatever comes, hold us close.',
          'Amen.',
        ].join('\n'),
      },
      {
        id: 'healing-anxious-heart',
        title: 'For an anxious heart',
        blurb: 'A prayer for peace over worry.',
        body: [
          'God, my mind is racing',
          'and my heart feels tight with worry.',
          '',
          'You invite me to cast my cares on you,',
          'because you care for me.',
          'So I do — I hand you what I cannot fix.',
          '',
          'Breathe your peace into me,',
          'the peace that passes understanding.',
          'Guard my heart and my mind.',
          'Amen.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'family',
    name: 'Family',
    emoji: '🏡',
    tagline: 'For the people closest to you',
    categoryKey: 'rose',
    prayers: [
      {
        id: 'family-over-my-home',
        title: 'Over my home',
        blurb: 'A blessing for your household.',
        body: [
          'Lord, let your peace rest on this home.',
          '',
          'Where there is tension, bring patience.',
          'Where there is distance, draw us close.',
          'Where there is love, make it deeper still.',
          '',
          'Watch over each person under this roof.',
          'Let this be a place of grace,',
          'where we are known and safe and kind.',
          'Amen.',
        ].join('\n'),
      },
      {
        id: 'family-for-my-children',
        title: 'For my children',
        blurb: 'Lifting up the ones you love.',
        body: [
          'Father, I lift my children to you.',
          'You love them even more than I do.',
          '',
          'Guard their hearts and their steps.',
          'Give them wisdom for their choices,',
          'good friends who lift them up,',
          'and a deep sense of being loved.',
          '',
          'When I cannot be with them,',
          'you are. Thank you.',
          'Amen.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'gratitude',
    name: 'Gratitude',
    emoji: '🙏',
    tagline: 'Give thanks in all things',
    categoryKey: 'emerald',
    prayers: [
      {
        id: 'gratitude-simple-thanks',
        title: 'Simple thanks',
        blurb: 'A short prayer of thankfulness.',
        body: [
          'Thank you, Lord.',
          '',
          'For life and breath,',
          'for grace I did not earn,',
          'for being met exactly where I am —',
          'thank you.',
          '',
          'Let my life say thank you',
          'in how I live today.',
          'Amen.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'strength',
    name: 'Strength',
    emoji: '⛰️',
    tagline: 'For hard seasons and heavy days',
    categoryKey: 'stone',
    prayers: [
      {
        id: 'strength-for-today',
        title: 'Strength for today',
        blurb: 'When you feel you have nothing left.',
        body: [
          'God, I am tired,',
          'and the road ahead feels long.',
          '',
          'You promise that those who hope in you',
          'will renew their strength —',
          'that we will run and not grow weary,',
          'walk and not faint.',
          '',
          'I am leaning on that promise now.',
          'Carry me through today.',
          'Amen.',
        ].join('\n'),
      },
    ],
  },
];

export function findExploreCategory(id: string | undefined): ExploreCategory | undefined {
  return EXPLORE_CATEGORIES.find((c) => c.id === id);
}

/** A library prayer paired with its category — the unit returned by search. */
export interface ExploreHit {
  category: ExploreCategory;
  prayer: ExplorePrayer;
}

/**
 * Search the whole bundled library by free text. Matches a prayer's title,
 * blurb, author, body, or its category name, so "morning" surfaces the Morning
 * set, "wesley" surfaces his prayers, and "anxious" surfaces the prayer
 * regardless of which category holds it.
 */
export function searchExplore(query: string): ExploreHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: ExploreHit[] = [];
  for (const category of EXPLORE_CATEGORIES) {
    const catMatch = category.name.toLowerCase().includes(q);
    for (const prayer of category.prayers) {
      if (
        catMatch ||
        prayer.title.toLowerCase().includes(q) ||
        (prayer.blurb || '').toLowerCase().includes(q) ||
        (prayer.author || '').toLowerCase().includes(q) ||
        prayer.body.toLowerCase().includes(q)
      ) {
        hits.push({ category, prayer });
      }
    }
  }
  return hits;
}

export function findExplorePrayer(
  categoryId: string | undefined,
  prayerId: string | undefined,
): { category: ExploreCategory; prayer: ExplorePrayer } | undefined {
  const category = findExploreCategory(categoryId);
  const prayer = category?.prayers.find((p) => p.id === prayerId);
  if (!category || !prayer) return undefined;
  return { category, prayer };
}
