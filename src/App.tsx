import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Brain, Sparkles, Coins, Star, Sword, Skull, RefreshCw, ChevronRight, Loader2, Users, Send, Save, Download, Trash2, User, UserPlus, Settings, LogOut } from 'lucide-react';
import { GameStats, Talent, World, Choice, GameEvent, DynamicTalent, NPC, Gender, LogEntry, LLMConfig } from './game/types';
import { WORLDS, INITIAL_TALENTS, DYNAMIC_TALENTS, getNextEvent } from './game/data';
import { generateDynamicEvent, processCustomInput, evaluateLife } from './game/gemini';

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY || '',
  baseUrl: '',
  model: 'gemini-3-flash-preview'
};

type Stage = 'MENU' | 'SAVES' | 'GENDER' | 'WORLD' | 'GACHA' | 'STATS' | 'LIFE' | 'DEATH' | 'SETTINGS';

interface SaveData {
  id: string;
  name: string;
  timestamp: number;
  world: World;
  talents: Talent[];
  stats: GameStats;
  flags: Record<string, number>;
  npcs: NPC[];
  age: number;
  logs: LogEntry[];
  gender: Gender;
}

export default function App() {
  const [stage, setStage] = useState<Stage>('MENU');
  const [gender, setGender] = useState<Gender>('unknown');
  const [world, setWorld] = useState<World | null>(null);
  const [talents, setTalents] = useState<Talent[]>([]);
  const [stats, setStats] = useState<GameStats>({ health: 0, int: 0, cha: 0, wealth: 0, luck: 0, str: 0 });
  const [flags, setFlags] = useState<Record<string, number>>({});
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [age, setAge] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [deathReason, setDeathReason] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [rerolls, setRerolls] = useState(3);
  const [extraPoints, setExtraPoints] = useState(20);
  const [allocatedStats, setAllocatedStats] = useState<GameStats>({ health: 0, int: 0, cha: 0, wealth: 0, luck: 0, str: 0 });
  const [customAction, setCustomAction] = useState('');
  const [saves, setSaves] = useState<SaveData[]>([]);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
  const [evaluation, setEvaluation] = useState<{dramaScore: number, achievementScore: number, meaningScore: number, epicCommentary: string} | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, currentEvent]);

  useEffect(() => {
    const savesStr = localStorage.getItem('sim_saves');
    if (savesStr) {
      try {
        setSaves(JSON.parse(savesStr));
      } catch (e) { }
    } else {
      // Migrate old single save if exists
      const oldSave = localStorage.getItem('sim_save');
      if (oldSave) {
        try {
          const parsed = JSON.parse(oldSave);
          const legacySave: SaveData = {
            ...parsed,
            id: 'legacy_save',
            name: `${parsed.age}岁 ${parsed.gender === 'male' ? '男' : parsed.gender === 'female' ? '女' : '未知'}在${parsed.world?.name || '未知世界'}`,
            timestamp: Date.now()
          };
          setSaves([legacySave]);
          localStorage.setItem('sim_saves', JSON.stringify([legacySave]));
          localStorage.removeItem('sim_save');
        } catch (e) { }
      }
    }
    
    const configSave = localStorage.getItem('sim_llm_config');
    if (configSave) {
      try {
        setLlmConfig(JSON.parse(configSave));
      } catch (e) { }
    }
  }, []);

  useEffect(() => {
    if (stage === 'DEATH' && world && !evaluation) {
      const fetchEvaluation = async () => {
        setIsGenerating(true);
        const evalResult = await evaluateLife(
          llmConfig,
          world,
          age,
          gender,
          stats,
          logs.map(l => l.text),
          deathReason
        );
        setEvaluation(evalResult);
        setIsGenerating(false);
      };
      fetchEvaluation();
    }
  }, [stage]);

  const saveGame = () => {
    if (!world || stage !== 'LIFE') return;
    const newSave: SaveData = {
      id: `save_${Date.now()}`,
      name: `${age}岁 ${gender === 'male' ? '男' : gender === 'female' ? '女' : '未知'}在${world.name}`,
      timestamp: Date.now(),
      world, talents, stats, flags, npcs, age, logs, gender
    };
    const newSaves = [newSave, ...saves];
    setSaves(newSaves);
    localStorage.setItem('sim_saves', JSON.stringify(newSaves));
    
    // Add visual feedback directly in log
    setLogs(prev => [...prev, { age, text: '💾 游戏已存档。' }]);
  };

  const loadGame = (saveId: string) => {
    try {
      const data = saves.find(s => s.id === saveId);
      if (!data) return;
      setWorld(data.world);
      setTalents(data.talents);
      setStats(data.stats);
      setFlags(data.flags);
      setNpcs(data.npcs || []);
      setAge(data.age);
      setLogs(data.logs);
      setGender(data.gender || 'unknown');
      setStage('LIFE');
      
      // We need to fetch the next event since we don't save the current event state
      fetchNextEvent(data.age, data.world, data.flags, data.stats, data.talents, data.npcs, data.gender, data.logs);
    } catch (e) {
      console.error('Failed to load save:', e);
      alert('读档失败！');
    }
  };

  const deleteSave = (saveId: string) => {
    const newSaves = saves.filter(s => s.id !== saveId);
    setSaves(newSaves);
    localStorage.setItem('sim_saves', JSON.stringify(newSaves));
  };

  const fetchNextEvent = async (nextAge: number, currentWorld: World, newFlags: Record<string, number>, newStats: GameStats, currentTalents: Talent[], currentNpcs: NPC[], currentGender: string, newLogs: LogEntry[]) => {
    setIsGenerating(true);
    setCurrentEvent(null);
    try {
      const historyStrings = newLogs.map(l => `${l.age}岁：${l.text}`);
      const gEvent = await generateDynamicEvent(llmConfig, currentWorld, nextAge, currentGender, newStats, currentTalents, newFlags, historyStrings, currentNpcs);
      
      // Update NPCs if any new ones introduced in the response
      if (gEvent.newNPCs && gEvent.newNPCs.length > 0) {
        setNpcs(prev => {
          let updated = [...prev];
          gEvent.newNPCs!.forEach(nn => {
            const index = updated.findIndex(pn => pn.id === nn.id);
            if (index >= 0) {
              updated[index] = { ...updated[index], ...nn };
            } else {
              updated.push(nn);
            }
          });
          return updated;
        });
      }

      setCurrentEvent(gEvent);
    } catch (e) {
      console.error(e);
      // fallback to static event
      setCurrentEvent(getNextEvent(nextAge, currentWorld.id, newFlags, newStats));
    } finally {
      setIsGenerating(false);
    }
  };

  const startGame = () => {
    setStage('WORLD');
  };

  const selectWorld = (w: World) => {
    setWorld(w);
    setRerolls(3);
    setTalents([]);
    setStage('GACHA');
  };

  const rollTalents = () => {
    if (!world) return;
    
    // Filter by world
    let available = INITIAL_TALENTS.filter(t => 
      !t.worldIds || t.worldIds.length === 0 || t.worldIds.includes(world.id)
    );

    const selected: Talent[] = [];
    const usedTags = new Set<string>();

    const shuffle = [...available].sort(() => 0.5 - Math.random());
    
    for (const t of shuffle) {
      if (selected.length >= 3) break;
      
      const hasExclusiveConflict = t.exclusiveTags?.some(tag => usedTags.has(tag));
      if (!hasExclusiveConflict) {
        selected.push(t);
        t.exclusiveTags?.forEach(tag => usedTags.add(tag));
      }
    }

    setTalents(selected);
    if (rerolls > 0) setRerolls(prev => prev - 1);
  };

  const goToStats = () => {
    setExtraPoints(20);
    setAllocatedStats({ health: 0, int: 0, cha: 0, wealth: 0, luck: 0, str: 0 });
    setStage('STATS');
  };

  const startLife = () => {
    if (!world) return;
    
    // Calculate initial stats: World Base + Talent Effects + Allocated Points
    const initialStats = { ...world.baseStats };
    
    // Add Talent Effects
    talents.forEach(t => {
      if (t.effects) {
        (Object.keys(t.effects) as Array<keyof GameStats>).forEach(key => {
          initialStats[key] = (initialStats[key] || 0) + (t.effects![key] || 0);
        });
      }
    });

    // Add Allocated Points
    (Object.keys(allocatedStats) as Array<keyof GameStats>).forEach(key => {
      initialStats[key] += allocatedStats[key];
    });

    setStats(initialStats);
    setFlags({});
    setNpcs([]);
    setAge(0);
    setLogs([{ age: 0, text: '你出生了...' }]);
    setDeathReason('');
    
    fetchNextEvent(0, world, {}, initialStats, talents, [], gender, [{ age: 0, text: '你降生在这个世界。' }]);
    setStage('LIFE');
  };

  const handleCustomAction = async () => {
    if (!customAction.trim() || !world || !currentEvent || isGenerating) return;
    const input = customAction;
    setCustomAction('');
    setIsGenerating(true);
    try {
      const choice = await processCustomInput(llmConfig, input, world, age, gender, stats, talents, flags, npcs, currentEvent);
      applyChoice(choice);
    } catch (e) {
      console.error(e);
      setIsGenerating(false);
    }
  };

  const applyChoice = (choice: Choice) => {
    if (!world || !currentEvent) return;

    // 1. Update stats and flags
    const newStats = { ...stats };
    if (choice.statChanges) {
      (Object.keys(choice.statChanges) as Array<keyof GameStats>).forEach(k => {
        newStats[k] += choice.statChanges![k] || 0;
      });
    }

    const newFlags = { ...flags };
    if (choice.flagChanges) {
      Object.keys(choice.flagChanges).forEach(k => {
        newFlags[k] = (newFlags[k] || 0) + (choice.flagChanges![k] || 0);
      });
    }

    // 2. NPC Interaction
    let currentNpcs = [...npcs];
    if (choice.npcInteraction) {
      currentNpcs = currentNpcs.map(n => {
        if (n.id === choice.npcInteraction?.npcId) {
          return { ...n, relation: Math.min(100, Math.max(-100, n.relation + choice.npcInteraction.relationChange)) };
        }
        return n;
      });
      setNpcs(currentNpcs);
    }

    // 3. Base logs
    const newLogs = [...logs];
    newLogs.push({ age, text: `经历：${currentEvent.text}` });
    newLogs.push({ age, text: `行动：${choice.logText}${choice.npcInteraction ? ` (${choice.npcInteraction.logDetail})` : ''}` });

    // 4. Dynamic Talents check
    const currentTalentIds = new Set(talents.map(t => t.id));
    const newUnlockedTalents: DynamicTalent[] = [];
    
    DYNAMIC_TALENTS.forEach(dt => {
      if (!currentTalentIds.has(dt.id) && dt.condition(newFlags, newStats)) {
        newUnlockedTalents.push(dt);
        newLogs.push({ age, text: `✨ 顿悟！解锁动态天赋：【${dt.name}】` });
        
        // apply dynamic talent stats immediately
        if (dt.effects) {
          (Object.keys(dt.effects) as Array<keyof GameStats>).forEach(k => {
            newStats[k] += dt.effects![k] || 0;
          });
        }
      }
    });

    let activeTalents = [...talents];
    if (newUnlockedTalents.length > 0) {
      activeTalents = [...talents, ...newUnlockedTalents];
      setTalents(activeTalents);
    }

    // Apply finalized state
    setStats(newStats);
    setFlags(newFlags);
    setLogs(newLogs);
    
    const nextAge = age < 16 && Math.random() > 0.3 ? age + 2 : age + 1;
    setAge(nextAge);

    // 5. Death check
    if (newStats.health <= 0) {
      setDeathReason('健康值归零，不幸离世。');
      setStage('DEATH');
      return;
    }

    const deathThreshold = 60 + newStats.health * 2;
    if (nextAge > deathThreshold && Math.random() < (nextAge - deathThreshold) * 0.05) {
      setDeathReason('大限已至，寿终正寝。');
      setStage('DEATH');
      return;
    }

    // 6. Next Event
    fetchNextEvent(nextAge, world, newFlags, newStats, activeTalents, currentNpcs, gender, newLogs);
  };

  // --- Render Helpers ---

  const renderStats = (currentStats: GameStats) => {
    const items = [
      { key: 'health', icon: Heart, color: 'text-red-400', label: '健康' },
      { key: 'int', icon: Brain, color: 'text-blue-400', label: '智力' },
      { key: 'cha', icon: Sparkles, color: 'text-pink-400', label: '颜值' },
      { key: 'wealth', icon: Coins, color: 'text-yellow-400', label: '家境' },
      { key: 'luck', icon: Star, color: 'text-purple-400', label: '运气' },
      { key: 'str', icon: Sword, color: 'text-orange-400', label: '体质' },
    ];

    return (
      <div className="grid grid-cols-3 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-2 bg-neutral-800/50 p-2 rounded-lg border border-neutral-700">
            <item.icon size={18} className={item.color} />
            <div className="flex flex-col">
              <span className="text-xs text-neutral-400">{item.label}</span>
              <span className="font-mono text-sm">{currentStats[item.key as keyof GameStats]}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getRarityColor = (rarity: string) => {
    switch(rarity) {
      case 'legendary': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.2)]';
      case 'epic': return 'text-purple-400 border-purple-500/30 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.2)]';
      case 'rare': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      default: return 'text-neutral-300 border-neutral-600 bg-neutral-800';
    }
  };

  // --- Screens ---

  const renderMenu = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full space-y-8 p-12 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tighter bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent pb-2">
          模拟人生
        </h1>
        <p className="text-neutral-400 max-w-md mx-auto text-lg">
          无尽的平行世界，无数种可能的人生。你的每一次选择都将通往不同的结局。
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => setStage('GENDER')}
          className="px-8 py-3 bg-white text-black rounded-full font-medium hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
        >
          开启轮回 <ChevronRight size={18} />
        </button>
        {saves.length > 0 && (
          <button 
            onClick={() => setStage('SAVES')}
            className="flex-1 px-8 py-3 bg-neutral-800 text-white rounded-full font-medium hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2 border border-neutral-700"
          >
            <Download size={18} /> 读取存档
          </button>
        )}
        <button 
          onClick={() => setStage('SETTINGS')}
          className="px-8 py-3 bg-neutral-900 text-neutral-400 rounded-full font-medium hover:text-white hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 border border-neutral-800"
        >
          <Settings size={18} /> 模型设置
        </button>
      </div>
    </motion.div>
  );

  const renderSaves = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full p-8 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">存档记录</h2>
        <p className="text-neutral-400">选择要继续的人生轨迹</p>
      </div>
      
      <div className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto space-y-4 pr-2">
        {saves.map(save => (
          <div key={save.id} className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-600 transition-colors">
            <div className="flex-1 w-full flex flex-col justify-center text-left">
              <h3 className="font-bold text-lg text-white mb-1">{save.name}</h3>
              <p className="text-sm text-neutral-500">{new Date(save.timestamp).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => loadGame(save.id)}
                className="flex-1 sm:flex-none px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
              >
                加载
              </button>
              <button 
                onClick={() => deleteSave(save.id)}
                className="p-2 bg-red-950/30 text-red-500 rounded-lg border border-red-900/50 hover:bg-red-900/50 hover:text-red-400 transition-colors"
                title="删除存档"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {saves.length === 0 && (
          <div className="text-center text-neutral-500 py-12">
            暂无存档记录
          </div>
        )}
      </div>
      
      <div className="flex justify-center shrink-0">
        <button 
          onClick={() => setStage('MENU')}
          className="px-8 py-3 text-neutral-400 hover:text-white transition-colors border border-transparent hover:border-neutral-800 rounded-xl"
        >
          返回主菜单
        </button>
      </div>
    </motion.div>
  );

  const renderGenderSelect = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full p-8 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">选择你的初始性别</h2>
        <p className="text-neutral-400">这可能会影响某些世界的开局发展</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 max-w-2xl w-full">
        {[
          { id: 'male', label: '男性', icon: User },
          { id: 'female', label: '女性', icon: User },
          { id: 'unknown', label: '随机 / 听天由命', icon: UserPlus },
        ].map(g => (
          <motion.button
            key={g.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              let selectedGender = g.id as Gender;
              if (selectedGender === 'unknown') {
                selectedGender = Math.random() > 0.5 ? 'male' : 'female';
              }
              setGender(selectedGender);
              setStage('WORLD');
            }}
            className="flex flex-col items-center gap-4 p-8 bg-neutral-900 border border-neutral-800 hover:border-neutral-500 rounded-2xl transition-all"
          >
            <g.icon size={48} className="text-neutral-400" />
            <span className="text-lg font-bold">{g.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );

  const renderSettings = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full p-8 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">模型设置</h2>
        <p className="text-neutral-400">配置您想要使用的 AI 模型</p>
      </div>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-400">API 提供商</label>
          <select 
            value={llmConfig.provider}
            onChange={(e) => setLlmConfig({...llmConfig, provider: e.target.value as LLMConfig['provider']})}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-neutral-500 transition-colors"
          >
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI 兼容接口</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-400">模型名称 (Model)</label>
          <input 
            type="text"
            value={llmConfig.model}
            onChange={(e) => setLlmConfig({...llmConfig, model: e.target.value})}
            placeholder={llmConfig.provider === 'gemini' ? 'gemini-3-flash-preview' : 'deepseek-chat'}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-400">API Key</label>
          <input 
            type="password"
            value={llmConfig.apiKey}
            onChange={(e) => setLlmConfig({...llmConfig, apiKey: e.target.value})}
            placeholder="sk-..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        {llmConfig.provider !== 'gemini' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-400">Base URL (可选)</label>
            <input 
              type="text"
              value={llmConfig.baseUrl}
              onChange={(e) => setLlmConfig({...llmConfig, baseUrl: e.target.value})}
              placeholder={llmConfig.provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-neutral-500 transition-colors"
            />
          </div>
        )}

        <button 
          onClick={() => {
            localStorage.setItem('sim_llm_config', JSON.stringify(llmConfig));
            setStage('MENU');
          }}
          className="w-full px-4 py-3 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
        >
          保存并返回
        </button>
      </div>
    </motion.div>
  );

  const renderWorldSelect = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full p-8 space-y-6">
      <h2 className="text-3xl font-bold text-center">选择你要转生的世界</h2>
      <div className="grid gap-4 md:grid-cols-3 flex-1">
        {WORLDS.map((w, idx) => (
          <motion.button
            key={w.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => selectWorld(w)}
            className="group relative flex flex-col items-start text-left p-6 bg-neutral-900 border border-neutral-800 hover:border-neutral-500 rounded-2xl transition-all hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neutral-800/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-xl font-bold mb-2 relative z-10">{w.name}</h3>
            <p className="text-sm text-neutral-400 mb-6 flex-1 relative z-10">{w.desc}</p>
            <div className="w-full space-y-2 relative z-10">
              <p className="text-xs text-neutral-500 font-medium">初始属性偏向：</p>
              {renderStats(w.baseStats)}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );

  const renderGacha = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full p-8 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">抽取转生天赋</h2>
        <p className="text-neutral-400">随机赋予三个初始天赋组合（剩余重抽次数：{rerolls}）</p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 min-h-[220px] w-full max-w-4xl justify-center">
        <AnimatePresence mode="wait">
          {talents.length > 0 ? talents.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: 'spring' }}
              className={`flex-1 p-6 rounded-2xl border flex flex-col items-center justify-center text-center space-y-3 ${getRarityColor(t.rarity)}`}
            >
              <h3 className="text-xl font-bold">{t.name}</h3>
              <p className="text-xs font-medium opacity-60 uppercase tracking-widest">{t.rarity}</p>
              <p className="text-sm opacity-80">{t.desc}</p>
            </motion.div>
          )) : (
            <div className="flex-1 flex items-center justify-center text-neutral-600 border-2 border-dashed border-neutral-800 rounded-2xl">
              待抽取...
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={rollTalents} 
          disabled={rerolls === 0 && talents.length > 0}
          className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full font-medium transition-colors flex items-center gap-2 border border-neutral-600"
        >
          <RefreshCw size={18} className={rerolls > 0 ? 'animate-spin-slow' : ''} /> 
          {talents.length === 0 ? '开始抽取' : `重新抽取 (${rerolls})`}
        </button>
        
        {talents.length > 0 && (
          <motion.button 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            onClick={goToStats} 
            className="px-8 py-3 bg-white text-black rounded-full font-medium hover:bg-neutral-200 transition-colors"
          >
            就这些了
          </motion.button>
        )}
      </div>
    </motion.div>
  );

  const renderStatAllocation = () => {
    const items = [
      { key: 'health', icon: Heart, color: 'text-red-400', label: '健康' },
      { key: 'int', icon: Brain, color: 'text-blue-400', label: '智力' },
      { key: 'cha', icon: Sparkles, color: 'text-pink-400', label: '颜值' },
      { key: 'wealth', icon: Coins, color: 'text-yellow-400', label: '家境' },
      { key: 'luck', icon: Star, color: 'text-purple-400', label: '运气' },
      { key: 'str', icon: Sword, color: 'text-orange-400', label: '体质' },
    ];

    const adjust = (key: keyof GameStats, val: number) => {
      if (val > 0 && extraPoints <= 0) return;
      if (val < 0 && allocatedStats[key] <= 0) return;
      
      setAllocatedStats(prev => ({ ...prev, [key]: prev[key] + val }));
      setExtraPoints(prev => prev - val);
    };

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full p-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">分配初始点数</h2>
          <p className="text-neutral-400">还可以分配 {extraPoints} 点数到你的核心素质</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div className="flex items-center gap-3">
                <item.icon size={20} className={item.color} />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-neutral-500">
                    世界基础: {world?.baseStats[item.key as keyof GameStats]}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => adjust(item.key as keyof GameStats, -1)}
                  className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-lg hover:bg-neutral-700 disabled:opacity-30"
                >
                  -
                </button>
                <span className="font-mono text-xl w-6 text-center">{allocatedStats[item.key as keyof GameStats]}</span>
                <button 
                  onClick={() => adjust(item.key as keyof GameStats, 1)}
                  className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-lg hover:bg-neutral-700 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={startLife}
          className="px-10 py-3 bg-white text-black rounded-full font-bold hover:bg-neutral-200 transition-all shadow-xl shadow-white/5 active:scale-95"
        >
          正式投胎
        </button>
      </motion.div>
    );
  };

  const renderLife = () => (
    <div className="flex flex-col md:flex-row h-full">
      {/* Left Sidebar: Status */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-1">{age} 岁 {gender === 'male' ? '♂' : gender === 'female' ? '♀' : ''}</h2>
            <p className="text-sm text-neutral-500">当前世界：{world?.name}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={saveGame}
              title="保存进度"
              className="p-2 border border-neutral-700 bg-neutral-800 rounded-lg hover:bg-neutral-700 hover:text-white text-neutral-400 transition-colors"
            >
              <Save size={16} />
            </button>
            <button 
              onClick={() => {
                if(window.confirm('确定要返回主菜单吗？未保存的进度将会丢失。')) {
                   setStage('MENU');
                }
              }}
              title="返回主菜单"
              className="p-2 border border-neutral-700 bg-neutral-800 rounded-lg hover:bg-red-900/50 hover:text-red-400 hover:border-red-900/50 text-neutral-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2"><Heart size={14}/> 核心属性</h3>
          {renderStats(stats)}
        </div>

        {npcs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2"><Users size={14}/> 人际关系</h3>
            <div className="space-y-2">
              {npcs.map(npc => (
                <div key={npc.id} className="p-2 bg-neutral-800/40 rounded-lg border border-neutral-700/50">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold">{npc.name}</span>
                    <span className={`text-[10px] px-1.5 rounded-full ${npc.status === 'dead' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                      {npc.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-neutral-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${npc.relation >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.abs(npc.relation)}%`, marginLeft: npc.relation < 0 ? 'auto' : '0' }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500">{npc.relation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2"><Sparkles size={14}/> 已激活天赋</h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {talents.map(t => (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  key={t.id} 
                  className={`text-xs px-2.5 py-1 rounded-full border ${getRarityColor(t.rarity)}`}
                  title={t.desc}
                >
                  {t.name}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right Content: Event Log & Current Actions */}
      <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
        
        {/* Scrollable logs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence initial={false}>
            {logs.map((log, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-4 text-sm"
              >
                <div className="w-12 shrink-0 text-neutral-500 font-mono text-right pt-0.5">{log.age}岁</div>
                <div className={`flex-1 ${log.text.startsWith('✨') ? 'text-yellow-400 font-medium' : log.text.startsWith('行动：') ? 'text-neutral-400 italic' : 'text-neutral-200'}`}>
                  {log.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={logEndRef} />
        </div>

        {/* Action Panel */}
        <div className="p-6 border-t border-neutral-800 bg-neutral-900 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
          <AnimatePresence mode="wait">
            {currentEvent ? (
              <motion.div key={currentEvent.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-lg leading-relaxed mb-6 font-medium">
                  {currentEvent.text}
                </p>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-3">
                    {currentEvent.choices.map((choice, i) => (
                      <button
                        key={i}
                        disabled={isGenerating}
                        onClick={() => applyChoice(choice)}
                        className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors border border-neutral-700 flex-1 min-w-[200px]"
                      >
                        {choice.text}
                      </button>
                    ))}
                  </div>
                  
                  {/* Custom Action Input */}
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={customAction}
                      onChange={(e) => setCustomAction(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomAction()}
                      placeholder="或者，输入你自己的行动..."
                      disabled={isGenerating}
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-neutral-500 transition-colors disabled:opacity-50"
                    />
                    <button 
                      onClick={handleCustomAction}
                      disabled={isGenerating || !customAction.trim()}
                      className="p-2.5 bg-white text-black rounded-lg hover:bg-neutral-200 disabled:opacity-30 transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : isGenerating ? (
              <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-24 flex items-center justify-center text-neutral-400 gap-3">
                <Loader2 size={18} className="animate-spin text-neutral-500" />
                <span className="animate-pulse">命运正在推演中...</span>
              </motion.div>
            ) : (
              <div className="h-24 flex items-center justify-center text-neutral-500 animate-pulse">
                岁月的齿轮开始转动...
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );

  const renderDeath = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-start h-full p-8 md:p-12 text-center bg-black/50 overflow-y-auto">
      <Skull size={64} className="text-neutral-500 mb-6 shrink-0 pt-8" />
      <div className="space-y-4 mb-8">
        <h2 className="text-4xl font-bold bg-gradient-to-b from-white to-neutral-600 bg-clip-text text-transparent">人生落幕</h2>
        <p className="text-xl font-mono text-neutral-400">享年 {age} 岁</p>
        <p className="text-neutral-300 max-w-md mx-auto">{deathReason}</p>
      </div>

      {!evaluation ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Loader2 size={32} className="animate-spin text-neutral-500" />
          <p className="text-neutral-400 animate-pulse">命运正在结算你的一生...</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
              <p className="text-neutral-400 text-sm">戏剧性</p>
              <p className="text-3xl font-bold text-white">{evaluation.dramaScore}</p>
            </div>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
              <p className="text-neutral-400 text-sm">成就度</p>
              <p className="text-3xl font-bold text-white">{evaluation.achievementScore}</p>
            </div>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
              <p className="text-neutral-400 text-sm">意义感</p>
              <p className="text-3xl font-bold text-white">{evaluation.meaningScore}</p>
            </div>
          </div>
          
          <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl italic text-lg text-neutral-300 leading-relaxed mx-auto shadow-inner relative text-left">
             <div className="absolute top-0 left-0 w-1 h-full bg-neutral-700 rounded-l-xl"></div>
            “{evaluation.epicCommentary}”
          </div>
          
          <div className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4 text-left shadow-2xl">
            <h3 className="text-sm font-medium text-neutral-400 border-b border-neutral-800 pb-2">最终属性</h3>
            {renderStats(stats)}
          </div>

          <div className="pt-4 pb-12 w-full flex justify-center">
            <button 
              onClick={() => {
                setEvaluation(null);
                setStage('MENU');
              }}
              className="px-12 py-4 bg-white text-black rounded-full font-bold hover:bg-neutral-200 transition-colors shadow-xl"
            >
              再次轮回
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-sans p-4 sm:p-8 flex items-center justify-center selection:bg-white/30 selection:text-white">
      <div className="w-full max-w-5xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden h-[85vh] min-h-[600px] flex flex-col relative ring-1 ring-white/5">
        
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 opacity-20 pointer-events-none" />
        
        <div className="relative h-full flex-1 w-full z-10 flex flex-col">
          {['GENDER', 'WORLD', 'GACHA', 'STATS'].includes(stage) && (
            <div className="absolute top-4 left-4 z-50">
              <button
                onClick={() => {
                  if(window.confirm('确定要返回主界面吗？当前的设置将会丢失。')) {
                    setStage('MENU');
                  }
                }}
                className="px-3 py-2 border border-neutral-800 bg-neutral-900 rounded-lg hover:bg-neutral-800 hover:text-white text-neutral-400 transition-colors flex items-center gap-2 text-sm shadow-lg"
              >
                <LogOut size={14} /> 返回主界面
              </button>
            </div>
          )}
          {stage === 'MENU' && renderMenu()}
          {stage === 'SAVES' && renderSaves()}
          {stage === 'SETTINGS' && renderSettings()}
          {stage === 'GENDER' && renderGenderSelect()}
          {stage === 'WORLD' && renderWorldSelect()}
          {stage === 'GACHA' && renderGacha()}
          {stage === 'STATS' && renderStatAllocation()}
          {stage === 'LIFE' && renderLife()}
          {stage === 'DEATH' && renderDeath()}
        </div>
        
      </div>
    </div>
  );
}
