import { World, Talent, DynamicTalent, GameEvent, GameStats } from './types';

export const WORLDS: World[] = [
  { id: 'modern', name: '现代都市', desc: '科技与钢铁的丛林，充满机遇和内卷。', baseStats: { health: 10, int: 10, cha: 10, wealth: 10, luck: 10, str: 10 } },
  { id: 'cultivation', name: '九洲仙界', desc: '强者为尊，夺天地造化。一朝悟道可白日飞升。', baseStats: { health: 15, int: 8, cha: 10, wealth: 5, luck: 12, str: 15 } },
  { id: 'cyber', name: '赛博夜之城', desc: '高科技，低生活。巨型企业暗中掌控所有人的命运。', baseStats: { health: 8, int: 15, cha: 8, wealth: 5, luck: 8, str: 12 } }
];

export const INITIAL_TALENTS: Talent[] = [
  // --- Beauty ---
  { id: 't1', name: '倾国倾城', desc: '容貌足以引发战争。', rarity: 'legendary', effects: { cha: 12 }, exclusiveTags: ['beauty'] },
  { id: 't8', name: '小家碧玉', desc: '长相清秀可人。', rarity: 'common', effects: { cha: 4 }, exclusiveTags: ['beauty'] },
  { id: 't13', name: '貌若潘安', desc: '惊世骇俗的美男子。', rarity: 'epic', effects: { cha: 8 }, exclusiveTags: ['beauty'] },

  // --- Luck ---
  { id: 't2', name: '天命之子', desc: '老天爷似乎特别偏爱你。', rarity: 'legendary', effects: { luck: 15, int: 5, str: 5 } },
  { id: 't7', name: '霉神附体', desc: '喝凉水都能塞牙。', rarity: 'common', effects: { luck: -8 } },

  // --- Wealth ---
  { id: 't3', name: '首富私生子', desc: '赢在起跑线上。', rarity: 'epic', effects: { wealth: 15 }, worldIds: ['modern', 'cyber'] },
  { id: 't14', name: '寒门学子', desc: '家境贫寒，但心志远大。', rarity: 'common', effects: { wealth: -5, int: 5 }, worldIds: ['modern'] },
  { id: 't15', name: '大世家子', desc: '出身名门，资源无数。', rarity: 'epic', effects: { wealth: 10, luck: 5 }, worldIds: ['cultivation'] },

  // --- Body / Health ---
  { id: 't4', name: '天生病弱', desc: '娘胎里带出来的病根。', rarity: 'common', effects: { health: -5, str: -3 }, exclusiveTags: ['constitution'] },
  { id: 't5', name: '四肢发达', desc: '头脑简单，打架没输过。', rarity: 'rare', effects: { str: 8, int: -4 } },
  { id: 't11', name: '铜皮铁骨', desc: '十分抗揍。', rarity: 'rare', effects: { health: 8, str: 5 }, exclusiveTags: ['constitution'] },
  { id: 't16', name: '无漏金身', desc: '万中无一的圣体。', rarity: 'legendary', effects: { health: 20, str: 10 }, worldIds: ['cultivation'], exclusiveTags: ['constitution'] },

  // --- Intelligence / Skills ---
  { id: 't6', name: '过目不忘', desc: '看一遍就能牢记一切。', rarity: 'epic', effects: { int: 10 } },
  { id: 't9', name: '武学奇才', desc: '绝佳的练武苗子。', rarity: 'epic', effects: { str: 8, luck: 3 }, worldIds: ['cultivation'] },
  { id: 't10', name: '骇客本能', desc: '对代码有天生的敏感。', rarity: 'rare', effects: { int: 6, cha: -2 }, worldIds: ['cyber'] },
  { id: 't17', name: '全干工程师', desc: '一个人顶一个团队。', rarity: 'rare', effects: { int: 5, wealth: 3 }, worldIds: ['modern'] },
  { id: 't18', name: '数据飞升', desc: '意识可以跨越数字深渊。', rarity: 'epic', effects: { int: 12, health: -5 }, worldIds: ['cyber'] },
  { id: 't19', name: '草木之亲', desc: '对药材有着天然的感知力。', rarity: 'rare', effects: { int: 4, luck: 4 }, worldIds: ['cultivation'] },

  // --- Generic ---
  { id: 't12', name: '平平无奇', desc: '真的就只是平平无奇而已。', rarity: 'common', effects: { } },
  { id: 't20', name: '乐天派', desc: '总是能苦中作乐。', rarity: 'common', effects: { health: 3, luck: 2 } },
];

export const DYNAMIC_TALENTS: DynamicTalent[] = [
  { id: 'dt1', name: '卷王之王', desc: '只要卷不死，就往死里卷！', rarity: 'epic', condition: (f) => (f['study'] || 0) >= 3, effects: { int: 8, health: -3 } },
  { id: 'dt2', name: '赛博精神病', desc: '机械飞升。理智濒临崩溃。', rarity: 'legendary', condition: (f) => (f['cyberware'] || 0) >= 3, effects: { str: 15, int: -8, cha: -5 } },
  { id: 'dt3', name: '筑基修士', desc: '踏入仙途，寿元大增。', rarity: 'epic', condition: (f) => (f['cultivate'] || 0) >= 3, effects: { health: 25, str: 10, luck: 3 } },
  { id: 'dt4', name: '商业巨头', desc: '敏锐嗅觉总能抓住风口。', rarity: 'rare', condition: (f) => (f['business'] || 0) >= 3, effects: { wealth: 15 } },
  { id: 'dt5', name: '街头霸王', desc: '在街头杀出赫赫威名。', rarity: 'rare', condition: (f) => (f['fight'] || 0) >= 3, effects: { str: 8, cha: -3 } },
  { id: 'dt6', name: '躺平大师', desc: '人生的终极奥义：不干了！', rarity: 'epic', condition: (f) => (f['slack'] || 0) >= 3, effects: { health: 12, int: -3, wealth: -3, luck: 5 } }
];

export const EVENTS: GameEvent[] = [
  {
    id: 'birth_1', worldIds: [], minAge: 0, maxAge: 0,
    text: '你降临在这个充斥着未知的世界。',
    choices: [
      { text: '大声嚎哭', statChanges: { str: 1, health: 1 }, logText: '你哇哇大哭，体质极佳。' },
      { text: '安静观察', statChanges: { int: 2 }, logText: '你不哭不闹，观察四周显得很聪慧。' }
    ]
  },
  {
    id: 'age3_modern', worldIds: ['modern'], minAge: 3, maxAge: 3,
    text: '父母为你准备了抓周仪式。',
    choices: [
      { text: '抓书本', statChanges: { int: 2 }, flagChanges: { study: 1 }, logText: '你抱着书，父母觉得你会是个学霸。' },
      { text: '抓算盘和钱', statChanges: { wealth: 2 }, flagChanges: { business: 1 }, logText: '你两眼放光，显露财迷属性。' },
      { text: '睡觉', statChanges: { health: 1 }, flagChanges: { slack: 1 }, logText: '你直接躺下呼呼大睡。' }
    ]
  },
  {
    id: 'age3_cult', worldIds: ['cultivation'], minAge: 3, maxAge: 3,
    text: '到了测试灵根的年纪。',
    choices: [
      { text: '注入气息', statChanges: { str: 2 }, flagChanges: { cultivate: 1 }, logText: '测出你有不错的修炼资质！' },
      { text: '乱摸周围', statChanges: { luck: 2 }, flagChanges: { slack: 1 }, logText: '你不小心摸到了垫着玉石的古卷，好运加倍。' }
    ]
  },
  {
    id: 'age3_cyber', worldIds: ['cyber'], minAge: 3, maxAge: 3,
    text: '你在电子垃圾站发现了一块发光的旧芯片。',
    choices: [
      { text: '直连试试', statChanges: { int: 3, health: -1 }, flagChanges: { cyberware: 1 }, logText: '遭遇轻微电击，感受到网络深渊的呼唤。' },
      { text: '藏起来换钱', statChanges: { wealth: 1 }, flagChanges: { business: 1 }, logText: '你把它藏了起来打算换点营养膏。' }
    ]
  },
  {
    id: 'school_modern', worldIds: ['modern'], minAge: 7, maxAge: 17,
    text: '上学期间，面对繁重的课业，你打算怎么做？',
    choices: [
      { text: '疯狂内卷', statChanges: { int: 2, health: -1 }, flagChanges: { study: 1 }, logText: '成绩突飞猛进，但也近视了。' },
      { text: '称霸校园', statChanges: { str: 2, cha: -1 }, flagChanges: { fight: 1 }, logText: '成了小霸王，身体变强壮。' },
      { text: '上课摸鱼', statChanges: { health: 1, luck: 1 }, flagChanges: { slack: 1 }, logText: '睡大觉虚度光阴。' }
    ]
  },
  {
    id: 'train_cult', worldIds: ['cultivation'], minAge: 7, maxAge: 50,
    text: '修行之路漫长，这一年你决定：',
    choices: [
      { text: '闭死关', statChanges: { str: 3, luck: -1 }, flagChanges: { cultivate: 1 }, logText: '闭关苦修，修为精进。' },
      { text: '下山历险', statChanges: { luck: 2, wealth: 1 }, flagChanges: { fight: 1 }, logText: '遭遇凶险，收获天材地宝。' },
      { text: '炼丹画符', statChanges: { int: 2, wealth: 2 }, flagChanges: { business: 1 }, logText: '钻研百艺，灵石变多。' }
    ]
  },
  {
    id: 'cyber_streets', worldIds: ['cyber'], minAge: 7, maxAge: 25,
    text: '街头的阴影处暗流涌动。',
    choices: [
      { text: '植入二手义体', statChanges: { str: 3, health: -2 }, flagChanges: { cyberware: 1 }, logText: '忍痛植入机械臂，充满力量。' },
      { text: '网络潜游', statChanges: { int: 2, wealth: 2 }, flagChanges: { study: 1 }, logText: '盗取并变现了一批数据。' },
      { text: '逞凶斗狠', statChanges: { str: 1, cha: -1 }, flagChanges: { fight: 1 }, logText: '参与火拼保住了地盘。' }
    ]
  },
  {
    id: 'exam_modern', worldIds: ['modern'], minAge: 18, maxAge: 18,
    text: '高考到了。',
    choices: [
      { text: '全力以赴', statChanges: { int: 2, luck: 1 }, flagChanges: { study: 1 }, logText: '考上了理想大学！' },
      { text: '去打工', statChanges: { wealth: 2, int: -1 }, flagChanges: { slack: 1 }, logText: '提前感受社会毒打。' }
    ]
  },
  {
    id: 'market_modern', worldIds: ['modern'], minAge: 20, maxAge: 26,
    text: '初入社会，市场竞争激烈。',
    choices: [
      { text: '考编考公', statChanges: { int: 1, health: -1 }, flagChanges: { study: 1 }, logText: '继续卷，头发掉光。' },
      { text: '下海创业', statChanges: { wealth: 3, luck: -1 }, flagChanges: { business: 1 }, logText: '承担风险，搏出商机。' },
      { text: '躺平', statChanges: { health: 2, wealth: -2 }, flagChanges: { slack: 1 }, logText: '只要我不努力，资本家就剥削不到我。' }
    ]
  },
  {
    id: 'cultivate_crisis', worldIds: ['cultivation'], minAge: 30, maxAge: 60,
    text: '仇家暗中伏击，数十人将你包围！',
    choices: [
      { text: '血战到底', statChanges: { str: 3, health: -5 }, flagChanges: { fight: 1 }, logText: '杀出一条血路，身受重创。' },
      { text: '舍财求饶', statChanges: { wealth: -5, health: -1 }, flagChanges: { slack: 1 }, logText: '交出储物袋，忍辱逃离。' }
    ]
  },
  {
    id: 'cyber_corp', worldIds: ['cyber'], minAge: 18, maxAge: 40,
    text: '巨型企业荒坂公司向你抛出橄榄枝。',
    choices: [
      { text: '接受招安', statChanges: { wealth: 5, cha: 2, luck: -2 }, flagChanges: { business: 1 }, logText: '穿上西服，成了公司狗。' },
      { text: '拒绝', statChanges: { str: 2, wealth: -2 }, flagChanges: { fight: 1 }, logText: '选择自由的街头。' }
    ]
  },
  {
    id: 'late_health_crisis', worldIds: [], minAge: 50, maxAge: 70,
    text: '身体亮起了红灯，医生建议停止高强度活动。',
    choices: [
      { text: '开始养生', statChanges: { health: 3, wealth: -3 }, flagChanges: { slack: 1 }, logText: '花大价钱调理，感觉好多了。' },
      { text: '我还能干', statChanges: { wealth: 3, health: -5 }, flagChanges: { business: 1 }, logText: '带病工作，透支生命力。' }
    ]
  }
];

export const getNextEvent = (age: number, worldId: string, flags: Record<string, number>, stats: GameStats): GameEvent => {
  const valid = EVENTS.filter(e => {
    if (age < e.minAge || age > e.maxAge) return false;
    if (e.worldIds.length > 0 && !e.worldIds.includes(worldId)) return false;
    if (e.condition && !e.condition(flags, stats)) return false;
    return true;
  });

  if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];

  return {
    id: 'fallback', worldIds: [], minAge: 0, maxAge: 999,
    text: '时间慢慢流逝，这一年没有什么特别的大事发生。',
    choices: [
      { text: '顺其自然', statChanges: { health: -1 }, logText: '安稳地度过了这一年。' },
      { text: '外出散心', statChanges: { health: 1, luck: 1, wealth: -1 }, logText: '花钱出去走走，心情舒畅了些。' }
    ]
  };
};
